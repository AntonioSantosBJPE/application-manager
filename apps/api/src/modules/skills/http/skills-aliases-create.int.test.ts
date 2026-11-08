import { aliasSchema, normalizeSkillKey, type Skill } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../../test/api.js';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';

type Api = Awaited<ReturnType<typeof startApi>>;

describe('POST /skills/:id/aliases', () => {
  let database: TestDatabase;
  let api: Api;
  let admin: TestAccount;
  let ana: TestAccount;
  let alfa: string;
  let beta: string;
  let privateGama: string;

  const post = (account: TestAccount, id: string, body: unknown): Promise<Response> =>
    fetch(`${api.baseUrl}/skills/${id}/aliases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...asAccount(account) },
      body: JSON.stringify(body),
    });
  const insert = async (owner: TestAccount | null, name: string): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      "insert into skills.skills (name, normalized_key, category, owner_user_id) values ($1, $2, 'tool', $3) returning id",
      [name, normalizeSkillKey(name), owner?.id ?? null],
    );
    return row!.id;
  };
  const aliases = () =>
    query<{ id: string; skill_id: string; alias: string; normalized_alias: string }>(
      database.url,
      'select id, skill_id, alias, normalized_alias from skills.skill_aliases where skill_id = any($1) order by normalized_alias',
      [[alfa, beta, privateGama]],
    );
  const search = async (q: string): Promise<Skill[]> =>
    (await (await fetch(`${api.baseUrl}/skills?q=${encodeURIComponent(q)}`, { headers: asAccount(ana) })).json()) as Skill[];

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_alias_create');
    api = await startApi(database.url);
    admin = await createAccount(database.url, api.baseUrl, 'admin.alias@example.com', 'admin');
    ana = await createAccount(database.url, api.baseUrl, 'ana.alias@example.com', 'member');
    alfa = await insert(null, 'Skill Fictícia Alfa');
    beta = await insert(null, 'Skill Fictícia Beta');
    privateGama = await insert(ana, 'Skill Fictícia Gama');
  }, 120_000);

  afterAll(async () => {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-26 saves the alias as typed, with its normalized key, and answers 201 with { id, alias }', async () => {
    const response = await post(admin, alfa, { alias: '  Alfa   Fictícia ' });

    expect(response.status).toBe(201);
    const body = aliasSchema.parse(await response.json());
    expect(Object.keys(body).sort()).toEqual(['alias', 'id']);
    expect(body.alias).toBe('Alfa Fictícia');
    expect(await aliases()).toEqual([{ id: body.id, skill_id: alfa, alias: 'Alfa Fictícia', normalized_alias: 'alfaficticia' }]);
  });

  it('SKL-27 lets the search of a member find the skill by the alias and answer the official name', async () => {
    expect((await search('alfaficticia')).map((skill) => skill.name)).toEqual(['Skill Fictícia Alfa']);
    expect((await search('ALFA FICTÍCIA')).map((skill) => skill.id)).toEqual([alfa]);
  });

  it('SKL-28 answers 409 in Problem Details and saves nothing for the key of a global, the skill own key or the alias of another skill', async () => {
    const before = await aliases();
    const attempts: Array<[string, string]> = [
      [beta, 'skill ficticia alfa'],
      [alfa, 'Skill Fictícia Alfa'],
      [alfa, 'SKILL-FICTICIA-ALFA'],
      [beta, 'alfa ficticia'],
    ];
    for (const [id, alias] of attempts) {
      const response = await post(admin, id, { alias });
      expect(response.status, alias).toBe(409);
      expect(response.headers.get('content-type'), alias).toContain('application/problem+json');
      expect(await response.json(), alias).toMatchObject({ title: 'Conflict', status: 409 });
    }
    expect(await aliases()).toEqual(before);
  });

  it('SKL-29 answers 200 with the existing alias when the skill already has it, without a second row', async () => {
    const [existing] = await aliases();

    const response = await post(admin, alfa, { alias: 'ALFA ficticia' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: existing!.id, alias: 'Alfa Fictícia' });
    expect(await aliases()).toEqual([existing]);
  });

  it('SKL-30 answers 422 with the title Unprocessable Content for a private skill and saves nothing', async () => {
    const before = await aliases();

    const response = await post(admin, privateGama, { alias: 'Gama Fictícia' });

    expect(response.status).toBe(422);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({ title: 'Unprocessable Content', status: 422 });
    expect(await aliases()).toEqual(before);
  });

  it('SKL-31 answers 404 for an unknown skill and 400 for an empty, long or keyless alias, saving nothing', async () => {
    const before = await aliases();

    for (const id of ['0198a5b0-0000-7000-8000-000000000000', 'not-a-uuid']) {
      const response = await post(admin, id, { alias: 'Qualquer Fictícia' });
      expect(response.status, id).toBe(404);
      expect(await response.json(), id).toMatchObject({ title: 'Not Found', status: 404 });
    }
    const invalid = [
      { alias: '' },
      { alias: '   ' },
      { alias: 'a'.repeat(61) },
      { alias: '...' },
      {},
      { alias: 5 },
      { alias: 'Beta\u0000Fictícia' },
      { alias: 'Beta\u0007Fictícia' },
    ];
    for (const body of invalid) {
      const response = await post(admin, beta, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      const problem = (await response.json()) as { errors: { path: string }[] };
      expect(problem.errors.map((e) => e.path), JSON.stringify(body)).toContain('alias');
    }
    expect(await aliases()).toEqual(before);
  });

  it('SKL-22 answers 403 to a member on the alias route and on GET /admin/skills, saving nothing', async () => {
    const before = await aliases();

    const created = await post(ana, beta, { alias: 'Beta Fictícia' });
    const listed = await fetch(`${api.baseUrl}/admin/skills`, { headers: asAccount(ana) });

    expect(created.status).toBe(403);
    expect(listed.status).toBe(403);
    expect(await aliases()).toEqual(before);
  });
});

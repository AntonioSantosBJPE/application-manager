import { normalizeSkillKey, skillSchema, type Skill } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../../test/api.js';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';

type Api = Awaited<ReturnType<typeof startApi>>;

interface Row {
  id: string;
  name: string;
  normalized_key: string;
  category: string;
  owner_user_id: string | null;
}

describe('PATCH /skills/:id', () => {
  let database: TestDatabase;
  let api: Api;
  let admin: TestAccount;
  let ana: TestAccount;

  const patch = (id: string, body: unknown, account: TestAccount = admin): Promise<Response> =>
    fetch(`${api.baseUrl}/skills/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...asAccount(account) },
      body: JSON.stringify(body),
    });
  const insert = async (owner: TestAccount | null, name: string, category = 'tool'): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      'insert into skills.skills (name, normalized_key, category, owner_user_id) values ($1, $2, $3, $4) returning id',
      [name, normalizeSkillKey(name), category, owner?.id ?? null],
    );
    return row!.id;
  };
  const addAlias = (skillId: string, alias: string) =>
    query(database.url, 'insert into skills.skill_aliases (skill_id, alias, normalized_alias) values ($1, $2, $3)', [
      skillId,
      alias,
      normalizeSkillKey(alias),
    ]);
  const row = async (id: string): Promise<Row | undefined> =>
    (
      await query<Row>(database.url, 'select id, name, normalized_key, category, owner_user_id from skills.skills where id = $1', [id])
    )[0];
  const aliasCount = async (skillId: string): Promise<number> =>
    Number((await query<{ count: string }>(database.url, 'select count(*) from skills.skill_aliases where skill_id = $1', [skillId]))[0]!.count);
  const search = async (q: string): Promise<Skill[]> =>
    (await (await fetch(`${api.baseUrl}/skills?q=${encodeURIComponent(q)}`, { headers: asAccount(ana) })).json()) as Skill[];

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_update');
    api = await startApi(database.url);
    admin = await createAccount(database.url, api.baseUrl, 'admin.update@example.com', 'admin');
    ana = await createAccount(database.url, api.baseUrl, 'ana.update@example.com', 'member');
  }, 120_000);

  afterAll(async () => {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-62 updates name and category of a global skill, keeps the id, recalculates the key and answers 200', async () => {
    const id = await insert(null, 'Skill Fictícia Alfa', 'tool');

    const both = await patch(id, { name: ' Skill  Fictícia Alfa Nova ', category: 'practice' });
    expect(both.status).toBe(200);
    expect(skillSchema.parse(await both.json())).toEqual({ id, name: 'Skill Fictícia Alfa Nova', category: 'practice', scope: 'global' });
    expect(await row(id)).toEqual({
      id,
      name: 'Skill Fictícia Alfa Nova',
      normalized_key: 'skillficticiaalfanova',
      category: 'practice',
      owner_user_id: null,
    });

    const onlyCategory = await patch(id, { category: 'language' });
    expect(await onlyCategory.json()).toEqual({ id, name: 'Skill Fictícia Alfa Nova', category: 'language', scope: 'global' });
    const onlyName = await patch(id, { name: 'Skill Fictícia Alfa Final' });
    expect(await onlyName.json()).toEqual({ id, name: 'Skill Fictícia Alfa Final', category: 'language', scope: 'global' });
    expect((await row(id))?.normalized_key).toBe('skillficticiaalfafinal');
  });

  it('SKL-63 finds the new name, no longer finds the old one, and creates no alias', async () => {
    const id = await insert(null, 'Skill Fictícia Beta');
    expect((await search('skill ficticia beta')).map((skill) => skill.id)).toEqual([id]);

    expect((await patch(id, { name: 'Zeta Fictícia Renomeada' })).status).toBe(200);

    expect((await search('zeta ficticia renomeada')).map((skill) => skill.id)).toEqual([id]);
    expect(await search('skill ficticia beta')).toEqual([]);
    expect(await aliasCount(id)).toBe(0);
  });

  it('SKL-64 answers 409 and changes nothing for the key of another global or of any alias, and accepts the same key in another spelling', async () => {
    const drizzle = await insert(null, 'Drizzle ORM de Teste', 'database');
    const other = await insert(null, 'Skill Fictícia Gama');
    const withAlias = await insert(null, 'Skill Fictícia Delta');
    await addAlias(withAlias, 'Delta Fictícia');
    await addAlias(drizzle, 'Drizzle Teste');

    const refused: Array<[string, string]> = [
      [drizzle, 'skill ficticia gama'],
      [drizzle, 'DELTA-FICTICIA'],
      [drizzle, 'drizzle teste'],
      [other, 'Drizzle ORM de Teste'],
    ];
    for (const [id, name] of refused) {
      const before = await row(id);
      const response = await patch(id, { name, category: 'language' });
      expect(response.status, name).toBe(409);
      expect(response.headers.get('content-type'), name).toContain('application/problem+json');
      expect(await response.json(), name).toMatchObject({ title: 'Conflict', status: 409 });
      expect(await row(id), name).toEqual(before);
    }

    const respelled = await patch(drizzle, { name: 'Drizzle-ORM de Teste' });
    expect(respelled.status).toBe(200);
    expect(await respelled.json()).toEqual({ id: drizzle, name: 'Drizzle-ORM de Teste', category: 'database', scope: 'global' });
    expect((await row(drizzle))?.normalized_key).toBe('drizzleormdeteste');
  });

  it('SKL-65 answers 422 with the title Unprocessable Content for a private skill and changes nothing', async () => {
    const id = await insert(ana, 'Skill Fictícia Épsilon');
    const before = await row(id);

    const response = await patch(id, { name: 'Épsilon Fictícia Nova', category: 'language' });

    expect(response.status).toBe(422);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({ title: 'Unprocessable Content', status: 422 });
    expect(await row(id)).toEqual(before);
  });

  it('SKL-66 answers 400 for an empty body, a bad name or a bad category, and 404 for an unknown id, changing nothing', async () => {
    const id = await insert(null, 'Skill Fictícia Zeta');
    const before = await row(id);

    const invalid: unknown[] = [{}, { name: '' }, { name: '   ' }, { name: 'a'.repeat(61) }, { name: '...' }, { name: 5 }, { category: 'bogus' }];
    for (const body of invalid) {
      const response = await patch(id, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.headers.get('content-type'), JSON.stringify(body)).toContain('application/problem+json');
    }
    for (const name of ['Zeta\u0000Fictícia', 'Zeta\u0007Fictícia']) {
      const response = await patch(id, { name });
      expect(response.status, JSON.stringify(name)).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      const problem = (await response.json()) as { errors: { path: string }[] };
      expect(problem.errors.map((e) => e.path), JSON.stringify(name)).toContain('name');
    }
    for (const unknown of ['0198a5b0-0000-7000-8000-000000000000', 'not-a-uuid']) {
      const response = await patch(unknown, { name: 'Qualquer Fictícia' });
      expect(response.status, unknown).toBe(404);
      expect(await response.json(), unknown).toMatchObject({ title: 'Not Found', status: 404 });
    }
    expect(await row(id)).toEqual(before);
  });
});

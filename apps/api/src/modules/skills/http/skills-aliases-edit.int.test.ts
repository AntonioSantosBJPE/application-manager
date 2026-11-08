import { aliasSchema, normalizeSkillKey, type Skill } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../../test/api.js';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';

type Api = Awaited<ReturnType<typeof startApi>>;

interface AliasRow {
  id: string;
  skill_id: string;
  alias: string;
  normalized_alias: string;
}

describe('PATCH and DELETE /skills/:id/aliases/:aliasId', () => {
  let database: TestDatabase;
  let api: Api;
  let admin: TestAccount;
  let ana: TestAccount;
  let alfa: string;
  let beta: string;
  let aliasAlfa: string;
  let aliasAlfaTwo: string;
  let aliasBeta: string;

  const send = (method: 'PATCH' | 'DELETE', skillId: string, aliasId: string, body?: unknown, account: TestAccount = admin) =>
    fetch(`${api.baseUrl}/skills/${skillId}/aliases/${aliasId}`, {
      method,
      headers: { 'content-type': 'application/json', ...asAccount(account) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const patch = (skillId: string, aliasId: string, body: unknown, account?: TestAccount) => send('PATCH', skillId, aliasId, body, account);
  const insertSkill = async (name: string): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      "insert into skills.skills (name, normalized_key, category) values ($1, $2, 'tool') returning id",
      [name, normalizeSkillKey(name)],
    );
    return row!.id;
  };
  const insertAlias = async (skillId: string, alias: string): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      'insert into skills.skill_aliases (skill_id, alias, normalized_alias) values ($1, $2, $3) returning id',
      [skillId, alias, normalizeSkillKey(alias)],
    );
    return row!.id;
  };
  const aliases = () =>
    query<AliasRow>(
      database.url,
      'select id, skill_id, alias, normalized_alias from skills.skill_aliases where skill_id = any($1) order by normalized_alias',
      [[alfa, beta]],
    );
  const search = async (q: string): Promise<Skill[]> =>
    (await (await fetch(`${api.baseUrl}/skills?q=${encodeURIComponent(q)}`, { headers: asAccount(ana) })).json()) as Skill[];

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_alias_edit');
    api = await startApi(database.url);
    admin = await createAccount(database.url, api.baseUrl, 'admin.aliasedit@example.com', 'admin');
    ana = await createAccount(database.url, api.baseUrl, 'ana.aliasedit@example.com', 'member');
    alfa = await insertSkill('Skill Fictícia Alfa');
    beta = await insertSkill('Skill Fictícia Beta');
    aliasAlfa = await insertAlias(alfa, 'Alfa Fictícia');
    aliasAlfaTwo = await insertAlias(alfa, 'Alfa Dois');
    aliasBeta = await insertAlias(beta, 'Beta Fictícia');
  }, 120_000);

  afterAll(async () => {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-67 changes the text and the key of the alias and answers 200 with its id and new text', async () => {
    const response = await patch(alfa, aliasAlfa, { alias: '  Alfa   Fictícia Core ' });

    expect(response.status).toBe(200);
    const body = aliasSchema.parse(await response.json());
    expect(body).toEqual({ id: aliasAlfa, alias: 'Alfa Fictícia Core' });
    expect(Object.keys(body).sort()).toEqual(['alias', 'id']);
    expect((await aliases()).find((row) => row.id === aliasAlfa)).toEqual({
      id: aliasAlfa,
      skill_id: alfa,
      alias: 'Alfa Fictícia Core',
      normalized_alias: 'alfaficticiacore',
    });
    // The search follows the new alias.
    expect((await search('alfaficticiacore')).map((skill) => skill.id)).toEqual([alfa]);
  });

  it('SKL-68 answers 409 for the key of a global or of an alias, 400 for an invalid alias and 404 for a missing or foreign one, changing nothing; the same key in another spelling is accepted', async () => {
    const before = await aliases();

    const conflicts = ['skill ficticia beta', 'SKILL-FICTICIA-ALFA', 'beta ficticia', 'alfa dois'];
    for (const alias of conflicts) {
      const response = await patch(alfa, aliasAlfa, { alias });
      expect(response.status, alias).toBe(409);
      expect(response.headers.get('content-type'), alias).toContain('application/problem+json');
      expect(await response.json(), alias).toMatchObject({ title: 'Conflict', status: 409 });
    }
    const invalid = [
      { alias: '' },
      { alias: '   ' },
      { alias: 'a'.repeat(61) },
      { alias: '...' },
      {},
      { alias: 5 },
      { alias: 'Alfa\u0000Fictícia' },
      { alias: 'Alfa\u0007Fictícia' },
    ];
    for (const body of invalid) {
      const response = await patch(alfa, aliasAlfa, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      const problem = (await response.json()) as { errors: { path: string }[] };
      expect(problem.errors.map((e) => e.path), JSON.stringify(body)).toContain('alias');
    }
    const missing = '0198a5b0-0000-7000-8000-000000000000';
    for (const [skillId, aliasId] of [
      [missing, aliasAlfa],
      [alfa, missing],
      [alfa, 'not-a-uuid'],
      ['not-a-uuid', aliasAlfa],
      // The alias of another skill is not found through this one.
      [alfa, aliasBeta],
    ] as const) {
      const response = await patch(skillId, aliasId, { alias: 'Qualquer Fictícia' });
      expect(response.status, `${skillId} ${aliasId}`).toBe(404);
      expect(await response.json()).toMatchObject({ title: 'Not Found', status: 404 });
    }
    expect(await aliases()).toEqual(before);

    const respelled = await patch(alfa, aliasAlfa, { alias: 'ALFA-FICTÍCIA-CORE' });
    expect(respelled.status).toBe(200);
    expect(await respelled.json()).toEqual({ id: aliasAlfa, alias: 'ALFA-FICTÍCIA-CORE' });
    expect((await aliases()).find((row) => row.id === aliasAlfa)?.normalized_alias).toBe('alfaficticiacore');
  });

  it('SKL-69 deletes the alias, answers 204 with no body and the search for it stops finding the skill', async () => {
    expect((await search('alfa dois')).map((skill) => skill.id)).toEqual([alfa]);

    const response = await send('DELETE', alfa, aliasAlfaTwo);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect((await aliases()).map((row) => row.id)).not.toContain(aliasAlfaTwo);
    expect(await search('alfa dois')).toEqual([]);
  });

  it('SKL-70 answers 404 to an alias already deleted, an unknown skill or an alias of another skill, deleting nothing', async () => {
    const before = await aliases();
    const missing = '0198a5b0-0000-7000-8000-000000000000';

    for (const [skillId, aliasId] of [
      [alfa, aliasAlfaTwo],
      [missing, aliasAlfa],
      [alfa, missing],
      ['not-a-uuid', aliasAlfa],
      [alfa, 'not-a-uuid'],
      [alfa, aliasBeta],
    ] as const) {
      const response = await send('DELETE', skillId, aliasId);
      expect(response.status, `${skillId} ${aliasId}`).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      expect(await response.json()).toMatchObject({ title: 'Not Found', status: 404 });
    }
    expect(await aliases()).toEqual(before);
  });

  it('SKL-71 answers 403 to a member on PATCH /skills/:id, PATCH and DELETE of an alias, changing nothing', async () => {
    const before = await aliases();
    const skills = await query(database.url, 'select id, name, category from skills.skills where id = any($1) order by id', [[alfa, beta]]);

    const responses = await Promise.all([
      fetch(`${api.baseUrl}/skills/${alfa}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...asAccount(ana) },
        body: JSON.stringify({ name: 'Skill Fictícia Alfa Nova' }),
      }),
      patch(alfa, aliasAlfa, { alias: 'Alfa Membro' }, ana),
      send('DELETE', alfa, aliasAlfa, undefined, ana),
    ]);

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403]);
    expect(await aliases()).toEqual(before);
    expect(await query(database.url, 'select id, name, category from skills.skills where id = any($1) order by id', [[alfa, beta]])).toEqual(skills);
  });
});

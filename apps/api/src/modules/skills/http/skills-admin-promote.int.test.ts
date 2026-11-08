import { skillSchema, normalizeSkillKey, type Skill } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../../test/api.js';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';

type Api = Awaited<ReturnType<typeof startApi>>;

interface Row {
  id: string;
  name: string;
  category: string;
  owner_user_id: string | null;
}

describe('POST /skills/:id/promote', () => {
  let database: TestDatabase;
  let api: Api;
  let admin: TestAccount;
  let ana: TestAccount;
  let bruno: TestAccount;

  const promote = (account: TestAccount, id: string): Promise<Response> =>
    fetch(`${api.baseUrl}/skills/${id}/promote`, { method: 'POST', headers: asAccount(account) });

  const insert = async (owner: TestAccount | null, name: string, category = 'tool'): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      'insert into skills.skills (name, normalized_key, category, owner_user_id) values ($1, $2, $3, $4) returning id',
      [name, normalizeSkillKey(name), category, owner?.id ?? null],
    );
    return row!.id;
  };
  const row = async (id: string): Promise<Row | undefined> =>
    (await query<Row>(database.url, 'select id, name, category, owner_user_id from skills.skills where id = $1', [id]))[0];
  const count = async (): Promise<number> =>
    Number((await query<{ count: string }>(database.url, 'select count(*) from skills.skills'))[0]!.count);
  const search = async (account: TestAccount, q: string): Promise<Skill[]> =>
    (await (await fetch(`${api.baseUrl}/skills?q=${encodeURIComponent(q)}`, { headers: asAccount(account) })).json()) as Skill[];

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_promote');
    api = await startApi(database.url);
    admin = await createAccount(database.url, api.baseUrl, 'admin.promote@example.com', 'admin');
    ana = await createAccount(database.url, api.baseUrl, 'ana.promote@example.com', 'member');
    bruno = await createAccount(database.url, api.baseUrl, 'bruno.promote@example.com', 'member');
  }, 120_000);

  afterAll(async () => {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-17 makes the private skill global, keeping id, name and category, and answers 200 with scope global', async () => {
    const id = await insert(ana, 'Drizzle ORM de Teste', 'database');

    const response = await promote(admin, id);

    expect(response.status).toBe(200);
    expect(skillSchema.parse(await response.json())).toEqual({
      id,
      name: 'Drizzle ORM de Teste',
      category: 'database',
      scope: 'global',
    });
    expect(await row(id)).toEqual({ id, name: 'Drizzle ORM de Teste', category: 'database', owner_user_id: null });
  });

  it('SKL-18 makes the search of any member return the promoted skill as global with the same id', async () => {
    const id = await insert(ana, 'Skill Fictícia Gama', 'tool');
    expect(await search(bruno, 'ficticia gama')).toEqual([]);

    await promote(admin, id);

    expect(await search(bruno, 'ficticia gama')).toEqual([{ id, name: 'Skill Fictícia Gama', category: 'tool', scope: 'global' }]);
    expect(await search(ana, 'ficticia gama')).toEqual([{ id, name: 'Skill Fictícia Gama', category: 'tool', scope: 'global' }]);
  });

  it('SKL-19 answers 409 in Problem Details and leaves the skill private when the key is a global key or an alias', async () => {
    await insert(null, 'Skill Fictícia Alfa');
    const globalBeta = await insert(null, 'Skill Fictícia Beta');
    await query(database.url, 'insert into skills.skill_aliases (skill_id, alias, normalized_alias) values ($1, $2, $3)', [
      globalBeta,
      'Beta Fictícia',
      'betaficticia',
    ]);
    const sameAsGlobal = await insert(ana, 'skill ficticia alfa');
    const sameAsAlias = await insert(bruno, 'BETA FICTICIA');

    for (const id of [sameAsGlobal, sameAsAlias]) {
      const response = await promote(admin, id);
      expect(response.status).toBe(409);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      expect(await response.json()).toMatchObject({ title: 'Conflict', status: 409 });
    }
    expect((await row(sameAsGlobal))?.owner_user_id).toBe(ana.id);
    expect((await row(sameAsAlias))?.owner_user_id).toBe(bruno.id);
  });

  it('SKL-20 answers 200 without changing anything when the skill is already global', async () => {
    const id = await insert(null, 'Skill Fictícia Delta', 'practice');
    const before = await count();

    const response = await promote(admin, id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id, name: 'Skill Fictícia Delta', category: 'practice', scope: 'global' });
    expect(await row(id)).toEqual({ id, name: 'Skill Fictícia Delta', category: 'practice', owner_user_id: null });
    expect(await count()).toBe(before);
  });

  it('SKL-21 answers 404 in Problem Details for an id that is not a uuid and for one that does not exist', async () => {
    for (const id of ['not-a-uuid', '0198a5b0-0000-7000-8000-000000000000']) {
      const response = await promote(admin, id);
      expect(response.status, id).toBe(404);
      expect(response.headers.get('content-type'), id).toContain('application/problem+json');
      expect(await response.json(), id).toMatchObject({ title: 'Not Found', status: 404 });
    }
  });

  it('SKL-22 answers 403 to a member on the promotion and leaves the skill private', async () => {
    const id = await insert(ana, 'Skill Fictícia Épsilon');

    const response = await promote(bruno, id);

    expect(response.status).toBe(403);
    expect((await row(id))?.owner_user_id).toBe(ana.id);
    const own = await promote(ana, id);
    expect(own.status).toBe(403);
    expect((await row(id))?.owner_user_id).toBe(ana.id);
  });

  it('SKL-24 promotes exactly one of two privates with the same key at the same time and answers the other 409', async () => {
    const names = ['Skill Fictícia Alfa Dois', 'Skill Fictícia Beta Dois', 'Drizzle ORM de Teste Dois'];
    for (const name of names) {
      const first = await insert(ana, name);
      const second = await insert(bruno, name.toLowerCase());

      const responses = await Promise.all([promote(admin, first), promote(admin, second)]);

      expect(responses.map((response) => response.status).sort(), name).toEqual([200, 409]);
      const key = normalizeSkillKey(name);
      const rows = await query<{ owner_user_id: string | null }>(
        database.url,
        'select owner_user_id from skills.skills where normalized_key = $1 order by owner_user_id nulls first',
        [key],
      );
      // One global and one private are left; no global key repeats anywhere in the catalog.
      expect(rows.map((r) => r.owner_user_id === null), name).toEqual([true, false]);
      expect(
        await query(database.url, 'select normalized_key from skills.skills where owner_user_id is null group by 1 having count(*) > 1'),
        name,
      ).toEqual([]);
    }
  });
});

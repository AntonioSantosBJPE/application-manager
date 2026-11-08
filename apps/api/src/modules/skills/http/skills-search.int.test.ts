import { normalizeSkillKey, skillSchema, type Skill } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../../test/api.js';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { readSeedSkills } from '../seed/global-skills.js';

type Api = Awaited<ReturnType<typeof startApi>>;

const seed = readSeedSkills();
const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** What the spec says a search returns, worked out from the seed list and not from the API. */
function expectedNames(q: string, extra: { name: string }[] = []): string[] {
  const key = normalizeSkillKey(q);
  const entries = [
    ...seed.map((s) => ({ name: s.name, key: normalizeSkillKey(s.name), aliasKeys: s.aliases.map(normalizeSkillKey) })),
    ...extra.map((s) => ({ name: s.name, key: normalizeSkillKey(s.name), aliasKeys: [] as string[] })),
  ];
  const byName = entries.filter((e) => e.key.includes(key)).sort(byKey);
  const byAlias = entries.filter((e) => !e.key.includes(key) && e.aliasKeys.some((a) => a.includes(key))).sort(byKey);
  return [...byName, ...byAlias].slice(0, 20).map((e) => e.name);
}

describe('GET /skills', () => {
  let database: TestDatabase;
  let api: Api;
  let ana: TestAccount;
  let bruno: TestAccount;

  const search = (account: TestAccount, q?: string): Promise<Response> =>
    fetch(`${api.baseUrl}/skills${q === undefined ? '' : `?q=${encodeURIComponent(q)}`}`, { headers: asAccount(account) });

  const names = async (account: TestAccount, q?: string): Promise<string[]> => {
    const response = await search(account, q);
    expect(response.status).toBe(200);
    return ((await response.json()) as Skill[]).map((skill) => skill.name);
  };

  const insertPrivate = (owner: TestAccount, name: string, category = 'tool') =>
    query(database.url, 'insert into skills.skills (name, normalized_key, category, owner_user_id) values ($1, $2, $3, $4)', [
      name,
      normalizeSkillKey(name),
      category,
      owner.id,
    ]);

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_search');
    api = await startApi(database.url);
    ana = await createAccount(database.url, api.baseUrl, 'ana.search@example.com', 'member');
    bruno = await createAccount(database.url, api.baseUrl, 'bruno.search@example.com', 'member');
    await insertPrivate(ana, 'Skill Fictícia Alfa');
    await insertPrivate(bruno, 'Skill Fictícia Beta', 'practice');
  }, 120_000);

  afterAll(async () => {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-05 answers 200 with an array of { id, name, category, scope } of the skills whose key contains the key of q', async () => {
    const response = await search(ana, 'node');

    expect(response.status).toBe(200);
    const items = (await response.json()) as unknown[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(Object.keys(item as object).sort()).toEqual(['category', 'id', 'name', 'scope']);
      expect(skillSchema.safeParse(item).success).toBe(true);
    }
    expect((items as Skill[]).map((s) => s.name)).toEqual(expectedNames('node'));
    expect(items).toContainEqual(expect.objectContaining({ name: 'Node.js', category: 'language', scope: 'global' }));
  });

  it('SKL-05 finds the same skill by "node", "nodejs" and "NODEJS", and by an accent-free or accented spelling', async () => {
    for (const q of ['node', 'nodejs', 'NodeJS']) {
      expect(await names(ana, q)).toContain('Node.js');
    }
    expect(await names(ana, 'comunicacao')).toContain('Comunicação');
    expect(await names(ana, 'COMUNICAÇÃO')).toContain('Comunicação');
  });

  it('SKL-05 answers an empty array for text that nothing matches', async () => {
    expect(await names(ana, 'zzzxyzzy')).toEqual([]);
  });

  it('SKL-05 returns at most 20 items', async () => {
    const found = await names(ana, 'e');

    expect(found).toHaveLength(20);
    expect(found).toEqual(expectedNames('e'));
  });

  it('SKL-06 lists the name matches first and then the alias-only matches, each group by key, with the official name', async () => {
    const found = await names(ana, 'react');

    // "TanStack Query" matches only through its alias "React Query" and comes after every name match.
    expect(found).toEqual(['React', 'React Hook Form', 'React Native', 'TanStack Query']);
    expect(found).toEqual(expectedNames('react'));
    expect(found).not.toContain('React Query');
  });

  it('SKL-06 returns the skill by its official name when only an alias matches', async () => {
    expect(await names(ana, 'golang')).toEqual(['Go']);
    expect(await names(ana, 'k8s')).toEqual(['Kubernetes']);
  });

  it('SKL-07 lists the first 20 visible skills in key order when q is absent, empty or has an empty key', async () => {
    const expected = expectedNames('', [{ name: 'Skill Fictícia Alfa' }]);

    expect(expected).toHaveLength(20);
    expect(await names(ana)).toEqual(expected);
    expect(await names(ana, '')).toEqual(expected);
    expect(await names(ana, ' .. ')).toEqual(expected);
  });

  it('SKL-08 never returns the private skill of another person', async () => {
    expect(await names(ana, 'ficticia')).toEqual(['Skill Fictícia Alfa']);
    expect(await names(bruno, 'ficticia')).toEqual(['Skill Fictícia Beta']);
    expect(await names(ana, 'beta')).toEqual([]);
    expect(await names(bruno, 'alfa')).toEqual([]);
  });

  it('SKL-09 answers 400 in Problem Details when q has more than 60 characters, and 200 at 60', async () => {
    const response = await search(ana, 'a'.repeat(61));

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({ status: 400, title: 'Bad Request' });
    expect((await search(ana, 'a'.repeat(60))).status).toBe(200);
  });

  it('SKL-10 marks a global skill as global and the own private skill as private', async () => {
    const response = await search(ana, 'ficticia');
    const own = (await response.json()) as Skill[];
    const globals = (await (await search(ana, 'postgres')).json()) as Skill[];

    expect(own).toEqual([
      { id: expect.any(String), name: 'Skill Fictícia Alfa', category: 'tool', scope: 'private' },
    ]);
    expect(globals.length).toBeGreaterThan(0);
    expect(globals.every((skill) => skill.scope === 'global')).toBe(true);
    expect(globals[0]).toMatchObject({ name: 'PostgreSQL', category: 'database', scope: 'global' });
  });

  it('answers 403 to an admin and 401 without a session', async () => {
    const admin = await createAccount(database.url, api.baseUrl, 'admin.search@example.com', 'admin');

    expect((await search(admin, 'node')).status).toBe(403);
    expect((await fetch(`${api.baseUrl}/skills?q=node`)).status).toBe(401);
  });
});

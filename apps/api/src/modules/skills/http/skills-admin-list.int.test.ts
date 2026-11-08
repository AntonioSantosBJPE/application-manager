import { adminSkillsPageSchema, normalizeSkillKey, type AdminSkillsPage } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../../test/api.js';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { readSeedSkills } from '../seed/global-skills.js';

type Api = Awaited<ReturnType<typeof startApi>>;

interface Expected {
  id: string;
  name: string;
  key: string;
  category: string;
  scope: 'global' | 'private';
  aliases: string[];
}

const seed = readSeedSkills();
const compare = (a: Expected, b: Expected): number =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

describe('GET /admin/skills', () => {
  let database: TestDatabase;
  let api: Api;
  let admin: TestAccount;
  let ana: TestAccount;
  let bruno: TestAccount;
  /** The whole catalog as the spec describes it, worked out from the seed and the rows the test inserted. */
  let catalog: Expected[];

  const get = (path: string): Promise<Response> => fetch(`${api.baseUrl}/admin/skills${path}`, { headers: asAccount(admin) });
  const page = async (path = ''): Promise<AdminSkillsPage> => {
    const response = await get(path);
    expect(response.status).toBe(200);
    return adminSkillsPageSchema.parse(await response.json());
  };
  const shape = (skill: Expected) => ({ id: skill.id, name: skill.name, category: skill.category, scope: skill.scope });
  const matching = (filter: { scope?: string; category?: string; q?: string }): Expected[] => {
    const key = normalizeSkillKey(filter.q ?? '');
    return catalog.filter(
      (skill) =>
        (filter.scope === undefined || filter.scope === 'all' || skill.scope === filter.scope) &&
        (filter.category === undefined || skill.category === filter.category) &&
        (key === '' || skill.key.includes(key) || skill.aliases.some((alias) => normalizeSkillKey(alias).includes(key))),
    );
  };

  const insertPrivate = async (owner: TestAccount, name: string, category: string): Promise<Expected> => {
    const [row] = await query<{ id: string }>(
      database.url,
      'insert into skills.skills (name, normalized_key, category, owner_user_id) values ($1, $2, $3, $4) returning id',
      [name, normalizeSkillKey(name), category, owner.id],
    );
    return { id: row!.id, name, key: normalizeSkillKey(name), category, scope: 'private', aliases: [] };
  };

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_admin_list');
    api = await startApi(database.url);
    admin = await createAccount(database.url, api.baseUrl, 'admin.list@example.com', 'admin');
    ana = await createAccount(database.url, api.baseUrl, 'ana.list@example.com', 'member');
    bruno = await createAccount(database.url, api.baseUrl, 'bruno.list@example.com', 'member');

    const globals = await query<{ id: string; name: string; normalized_key: string; category: string }>(
      database.url,
      'select id, name, normalized_key, category from skills.skills where owner_user_id is null',
    );
    const aliasRows = await query<{ skill_id: string; alias: string }>(database.url, 'select skill_id, alias from skills.skill_aliases');
    const privates = [
      await insertPrivate(ana, 'Skill Fictícia Alfa', 'tool'),
      // Same key as Ana's, another owner: two rows with the same key, ordered by id after it.
      await insertPrivate(bruno, 'skill ficticia alfa', 'database'),
      await insertPrivate(bruno, 'Skill Fictícia Beta', 'practice'),
    ];
    catalog = [
      ...globals.map((row) => ({
        id: row.id,
        name: row.name,
        key: row.normalized_key,
        category: row.category,
        scope: 'global' as const,
        aliases: aliasRows.filter((alias) => alias.skill_id === row.id).map((alias) => alias.alias),
      })),
      ...privates,
    ].sort(compare);
    expect(globals.length).toBe(seed.length);
  }, 120_000);

  afterAll(async () => {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-33 answers { items, nextCursor, counts } and every item has exactly id, name, category, scope and aliases, with no owner', async () => {
    const response = await get('?scope=private');
    expect(response.status).toBe(200);
    const body = (await response.json()) as AdminSkillsPage;

    expect(Object.keys(body).sort()).toEqual(['counts', 'items', 'nextCursor']);
    expect(body.items.map((item) => item.name)).toEqual(['Skill Fictícia Alfa', 'skill ficticia alfa', 'Skill Fictícia Beta'].sort(
      (a, b) => {
        const left = catalog.find((s) => s.name === a)!;
        const right = catalog.find((s) => s.name === b)!;
        return compare(left, right);
      },
    ));
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(['aliases', 'category', 'id', 'name', 'scope']);
      expect(item.scope).toBe('private');
    }
    // No value of the answer is the id or the e-mail of a person.
    const text = JSON.stringify(body);
    for (const person of [ana, bruno, admin]) {
      expect(text).not.toContain(person.id);
      expect(text).not.toContain(person.email);
    }

    // A global with aliases lists each as { id, alias }.
    const nodejs = (await page('?q=nodejs')).items.find((item) => item.name === 'Node.js')!;
    expect(nodejs.aliases).toEqual([{ id: expect.any(String), alias: 'Node' }]);
    expect(Object.keys(nodejs.aliases[0]!).sort()).toEqual(['alias', 'id']);
  });

  it('SKL-34 follows nextCursor to the end: 50 per page, alphabetical by key, every skill once, nextCursor null on the last page', async () => {
    const seen: Expected[] = [];
    const sizes: number[] = [];
    let cursors = 0;
    let next: string | null = null;
    do {
      const current: AdminSkillsPage = await page(next === null ? '' : `?cursor=${encodeURIComponent(next)}`);
      sizes.push(current.items.length);
      seen.push(...current.items.map((item) => catalog.find((skill) => skill.id === item.id)!));
      next = current.nextCursor;
      cursors += 1;
    } while (next !== null && cursors < 100);

    expect(next).toBeNull();
    expect(sizes.slice(0, -1).every((size) => size === 50)).toBe(true);
    expect(sizes.at(-1)).toBeGreaterThan(0);
    expect(sizes.at(-1)).toBeLessThanOrEqual(50);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(catalog.length);
    expect(seen.map(shape)).toEqual(catalog.map(shape));
    expect(new Set(seen.map((skill) => skill.id)).size).toBe(catalog.length);
  });

  it('SKL-35 returns only what matches scope, category and q together, where q matches the name or an alias', async () => {
    const combos = [
      { scope: 'private' },
      { scope: 'global', category: 'database' },
      { category: 'database', q: 'postgres' },
      { scope: 'global', category: 'database', q: 'sql' },
      { scope: 'all', q: 'nodejs' },
      { scope: 'global', category: 'language', q: 'node' },
      { scope: 'private', category: 'tool', q: 'FICTÍCIA' },
      { scope: 'private', category: 'language' },
    ];
    for (const combo of combos) {
      const params = new URLSearchParams(combo as Record<string, string>).toString();
      const expected = matching(combo);
      const received = await page(`?${params}`);
      expect(received.items.map((item) => item.id), params).toEqual(expected.slice(0, 50).map((skill) => skill.id));
      expect(received.nextCursor === null, params).toBe(expected.length <= 50);
    }
    // The filters are not vacuous: a combined filter is a strict subset of each of its parts.
    const combined = matching({ scope: 'global', category: 'database', q: 'sql' }).length;
    expect(combined).toBeGreaterThan(0);
    expect(combined).toBeLessThan(matching({ q: 'sql' }).length);
    expect(combined).toBeLessThan(matching({ scope: 'global', category: 'database' }).length);
    // A search through an alias finds the skill by its official name.
    expect((await page('?q=nodejs')).items.map((item) => item.name)).toContain('Node.js');
  });

  it('SKL-36 counts the whole catalog and its privates, the same with and without filters', async () => {
    const expected = { total: seed.length + 3, private: 3 };
    expect((await page()).counts).toEqual(expected);
    expect((await page('?scope=private')).counts).toEqual(expected);
    expect((await page('?scope=global&category=database&q=postgres')).counts).toEqual(expected);
    expect((await page('?q=zzzsemresultado')).items).toEqual([]);
    expect((await page('?q=zzzsemresultado')).counts).toEqual(expected);
  });

  it('SKL-37 answers 400 in Problem Details for an invalid scope, category or cursor', async () => {
    const textOf = (value: unknown): string => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
    const bad = [
      'scope=bogus',
      'category=bogus',
      'cursor=not-a-cursor!',
      `cursor=${Buffer.from('not json', 'utf8').toString('base64url')}`,
      `cursor=${textOf({ key: 'node' })}`,
      `cursor=${textOf({ key: 'node', id: 'not-a-uuid' })}`,
      'cursor=',
    ];
    for (const params of bad) {
      const response = await get(`?${params}`);
      expect(response.status, params).toBe(400);
      expect(response.headers.get('content-type'), params).toContain('application/problem+json');
      expect(await response.json(), params).toMatchObject({ title: 'Bad Request', status: 400 });
    }
  });
});

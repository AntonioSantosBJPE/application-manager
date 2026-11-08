import { normalizeSkillKey, skillCategorySchema } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { readSeedSkills } from './global-skills.js';

describe('seeded catalog', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_seed');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-02 holds at least 200 global skills, each with the normalization of its name as key', async () => {
    const globals = await query<{ name: string; normalized_key: string; category: string }>(
      database.url,
      'select name, normalized_key, category from skills.skills where owner_user_id is null',
    );

    expect(globals.length).toBeGreaterThanOrEqual(200);
    expect(globals).toHaveLength(readSeedSkills().length);
    for (const row of globals) {
      expect(row.normalized_key, row.name).toBe(normalizeSkillKey(row.name));
    }
    expect(new Set(globals.map((row) => row.category))).toEqual(new Set(skillCategorySchema.options));
  });

  it('SKL-02 stores every alias of the seed, with the normalization of its text, on its skill', async () => {
    const stored = await query<{ name: string; alias: string; normalized_alias: string }>(
      database.url,
      `select s.name, a.alias, a.normalized_alias
         from skills.skill_aliases a join skills.skills s on s.id = a.skill_id
        where s.owner_user_id is null order by s.name, a.alias`,
    );
    const expected = readSeedSkills().flatMap((skill) =>
      skill.aliases.map((alias) => ({ name: skill.name, alias, normalized_alias: normalizeSkillKey(alias) })),
    );
    const byName = (a: { name: string; alias: string }, b: { name: string; alias: string }) =>
      a.name.localeCompare(b.name) || a.alias.localeCompare(b.alias);

    expect(expected.length).toBeGreaterThan(0);
    expect([...stored].sort(byName)).toEqual([...expected].sort(byName));
  });
});

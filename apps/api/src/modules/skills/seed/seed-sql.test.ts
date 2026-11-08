import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSkillKey } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { API_ROOT, readSeedSkills } from './global-skills.js';
import { buildSeedSql, SEED_MIGRATION_PATH } from './seed-sql.js';

describe('seed migration', () => {
  it('SKL-02 matches, byte for byte, the SQL the generator builds from the list', () => {
    const committed = readFileSync(SEED_MIGRATION_PATH, 'utf8');

    expect(committed).toBe(buildSeedSql(readSeedSkills()));
  });

  it('SKL-02 is registered in the Drizzle journal as the entry after the skills schema', () => {
    const journal = JSON.parse(readFileSync(join(API_ROOT, 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: { idx: number; tag: string }[];
    };
    const tags = journal.entries.sort((a, b) => a.idx - b.idx).map((entry) => entry.tag);

    expect(tags.slice(-2)).toEqual(['0002_skills_schema', '0003_skills_seed']);
  });
});

describe('buildSeedSql', () => {
  const sql = buildSeedSql([
    { name: "Skill D'Teste", category: 'tool', aliases: ['Apelido "A"'] },
    { name: 'Node.js', category: 'language', aliases: [] },
  ]);

  it('inserts skills and aliases with ON CONFLICT DO NOTHING, split by a statement breakpoint', () => {
    const statements = sql.split('--> statement-breakpoint');

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('INSERT INTO "skills"."skills"');
    expect(statements[1]).toContain('INSERT INTO "skills"."skill_aliases"');
    for (const statement of statements) expect(statement).toContain('ON CONFLICT DO NOTHING;');
  });

  it('writes the key that normalizeSkillKey computes and doubles single quotes', () => {
    expect(sql).toContain(`('Node.js', '${normalizeSkillKey('Node.js')}', 'language')`);
    expect(sql).toContain("('Skill D''Teste', 'skilldteste', 'tool')");
    expect(sql).toContain(`('skilldteste', 'Apelido "A"', '${normalizeSkillKey('Apelido "A"')}')`);
  });
});

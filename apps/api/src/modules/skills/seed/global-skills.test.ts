import { normalizeSkillKey, skillCategorySchema, skillTextSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { readSeedSkills } from './global-skills.js';

const skills = readSeedSkills();

/** Names the skills tests create; they must stay outside the seed so a "new" skill stays new (design, Risks). */
const fixtureSkillNames = ['Skill Fictícia Alfa', 'Skill Fictícia Beta', 'Drizzle ORM de Teste'];

describe('global skills seed', () => {
  it('lists at least 200 skills with one of the seven categories', () => {
    expect(skills.length).toBeGreaterThanOrEqual(200);
    for (const skill of skills) {
      expect(skillCategorySchema.safeParse(skill.category).success, skill.name).toBe(true);
    }
    expect(new Set(skills.map((skill) => skill.category))).toEqual(new Set(skillCategorySchema.options));
  });

  it('writes every name and alias the way the contract accepts it', () => {
    for (const skill of skills) {
      expect(skillTextSchema.parse(skill.name), skill.name).toBe(skill.name);
      for (const alias of skill.aliases) expect(skillTextSchema.parse(alias), alias).toBe(alias);
    }
  });

  it('SKL-03 holds no two skills with the same normalized key', () => {
    const keys = skills.map((skill) => normalizeSkillKey(skill.name));
    const repeated = keys.filter((key, index) => keys.indexOf(key) !== index);

    expect(repeated).toEqual([]);
  });

  it('SKL-03 holds no alias whose key is a skill key or the key of another alias', () => {
    const skillKeys = new Set(skills.map((skill) => normalizeSkillKey(skill.name)));
    const aliasKeys = skills.flatMap((skill) => skill.aliases.map(normalizeSkillKey));

    expect(aliasKeys.filter((key) => skillKeys.has(key))).toEqual([]);
    expect(aliasKeys.filter((key, index) => aliasKeys.indexOf(key) !== index)).toEqual([]);
  });

  it('keeps the test fixture names out of the seed, by key and by alias', () => {
    const taken = new Set(skills.flatMap((skill) => [skill.name, ...skill.aliases].map(normalizeSkillKey)));

    for (const name of fixtureSkillNames) {
      expect(taken.has(normalizeSkillKey(name)), name).toBe(false);
    }
  });

  it('leaves the names the spec examples create and alias to the tests that do it', () => {
    const taken = new Set(skills.flatMap((skill) => [skill.name, ...skill.aliases].map(normalizeSkillKey)));

    // "Drizzle ORM" is the private skill of the spec's journeys; "nest" is the alias the admin adds to NestJS.
    expect(taken.has(normalizeSkillKey('Drizzle ORM'))).toBe(false);
    expect(taken.has(normalizeSkillKey('drizzle'))).toBe(false);
    expect(taken.has('nest')).toBe(false);
    expect(taken.has('reactjs')).toBe(false);
    expect(skills.find((skill) => skill.name === 'Node.js')?.aliases).toContain('Node');
    expect(skills.some((skill) => skill.name === 'NestJS')).toBe(true);
    expect(skills.some((skill) => skill.name === 'Comunicação')).toBe(true);
  });

  it('carries only technologies and competencies, with no email, url or digits-only entry', () => {
    for (const text of skills.flatMap((skill) => [skill.name, ...skill.aliases])) {
      expect(text, text).not.toMatch(/@|https?:|\/\/|^\d+$/);
    }
  });
});

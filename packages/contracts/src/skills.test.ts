import { describe, expect, it } from 'vitest';
import {
  adminSkillsPageSchema,
  adminSkillsQuerySchema,
  aliasRequestSchema,
  aliasSchema,
  createSkillRequestSchema,
  normalizeSkillKey,
  searchSkillsQuerySchema,
  skillSchema,
  skillTextSchema,
  updateSkillRequestSchema,
} from './skills.js';

const ok = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('normalizeSkillKey', () => {
  it('SKL-01 derives the key of the spec examples', () => {
    expect(normalizeSkillKey('Node.js')).toBe('nodejs');
    expect(normalizeSkillKey('C++')).toBe('c++');
    expect(normalizeSkillKey('C#')).toBe('c#');
    expect(normalizeSkillKey('Comunicação')).toBe('comunicacao');
    expect(normalizeSkillKey('.NET')).toBe('net');
  });

  it('SKL-01 ignores case, accents and separators, so spellings of one skill share a key', () => {
    expect(normalizeSkillKey('COMUNICAÇÃO')).toBe('comunicacao');
    expect(normalizeSkillKey('NODEJS')).toBe('nodejs');
    expect(normalizeSkillKey('Drizzle  ORM')).toBe(normalizeSkillKey('drizzle-orm'));
    expect(normalizeSkillKey('Node')).not.toBe(normalizeSkillKey('Node.js'));
  });

  it('SKL-01 keeps C, C++ and C# apart and gives an empty key to text with no letter or digit', () => {
    expect(new Set(['C', 'C++', 'C#'].map(normalizeSkillKey)).size).toBe(3);
    expect(normalizeSkillKey('...')).toBe('');
    expect(normalizeSkillKey('é')).toBe('e');
    expect(normalizeSkillKey('ｆｕｌｌ')).toBe('full');
  });
});

describe('skillTextSchema', () => {
  it('SKL-15 trims and collapses inner spaces', () => {
    expect(skillTextSchema.parse('  Drizzle   ORM  ')).toBe('Drizzle ORM');
    expect(skillTextSchema.parse('Node.js')).toBe('Node.js');
  });

  it('SKL-15 rejects an empty text, a blank one, one above 60 characters and one with an empty key', () => {
    expect(ok(skillTextSchema, '')).toBe(false);
    expect(ok(skillTextSchema, '   ')).toBe(false);
    expect(ok(skillTextSchema, 'a'.repeat(61))).toBe(false);
    expect(ok(skillTextSchema, '...')).toBe(false);
    expect(ok(skillTextSchema, 42)).toBe(false);
  });

  it('SKL-15 accepts 1 and 60 characters', () => {
    expect(skillTextSchema.parse('C')).toBe('C');
    expect(skillTextSchema.parse('a'.repeat(60))).toBe('a'.repeat(60));
  });

  it('SKL-31 applies the same limits to an alias', () => {
    expect(aliasRequestSchema.parse({ alias: ' nest  js ' })).toEqual({ alias: 'nest js' });
    expect(ok(aliasRequestSchema, { alias: '' })).toBe(false);
    expect(ok(aliasRequestSchema, { alias: 'a'.repeat(61) })).toBe(false);
    expect(ok(aliasRequestSchema, { alias: '!!' })).toBe(false);
    expect(ok(aliasRequestSchema, {})).toBe(false);
  });
});

describe('createSkillRequestSchema', () => {
  it('SKL-15 rejects a missing body field, an unknown category and a name that is not text', () => {
    expect(ok(createSkillRequestSchema, { category: 'tool' })).toBe(false);
    expect(ok(createSkillRequestSchema, { name: 'Skill Fictícia Alfa' })).toBe(false);
    expect(ok(createSkillRequestSchema, { name: 'Skill Fictícia Alfa', category: 'hobby' })).toBe(false);
    expect(ok(createSkillRequestSchema, { name: 7, category: 'tool' })).toBe(false);
    expect(ok(createSkillRequestSchema, undefined)).toBe(false);
  });

  it('SKL-15 accepts each of the seven categories', () => {
    for (const category of ['language', 'framework', 'database', 'cloud_devops', 'tool', 'practice', 'soft_skill']) {
      expect(createSkillRequestSchema.parse({ name: 'Skill Fictícia Alfa', category })).toEqual({
        name: 'Skill Fictícia Alfa',
        category,
      });
    }
  });

  it('SKL-16 drops ownerUserId and scope from the body', () => {
    const parsed = createSkillRequestSchema.parse({
      name: 'Skill Fictícia Alfa',
      category: 'tool',
      ownerUserId: '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60',
      scope: 'global',
    });

    expect(parsed).toEqual({ name: 'Skill Fictícia Alfa', category: 'tool' });
  });
});

describe('updateSkillRequestSchema', () => {
  it('SKL-66 needs at least one of name and category', () => {
    expect(ok(updateSkillRequestSchema, {})).toBe(false);
    expect(ok(updateSkillRequestSchema, { ownerUserId: 'x' })).toBe(false);
    expect(updateSkillRequestSchema.parse({ name: ' Nest.js ' })).toEqual({ name: 'Nest.js' });
    expect(updateSkillRequestSchema.parse({ category: 'framework' })).toEqual({ category: 'framework' });
    expect(updateSkillRequestSchema.parse({ name: 'Nest.js', category: 'framework' })).toEqual({
      name: 'Nest.js',
      category: 'framework',
    });
  });

  it('SKL-66 rejects an empty name, one above 60 characters, an empty key and an unknown category', () => {
    expect(ok(updateSkillRequestSchema, { name: '' })).toBe(false);
    expect(ok(updateSkillRequestSchema, { name: 'a'.repeat(61) })).toBe(false);
    expect(ok(updateSkillRequestSchema, { name: '---' })).toBe(false);
    expect(ok(updateSkillRequestSchema, { category: 'hobby' })).toBe(false);
  });
});

describe('searchSkillsQuerySchema', () => {
  it('SKL-09 accepts q of 60 characters and rejects 61', () => {
    expect(searchSkillsQuerySchema.parse({ q: 'a'.repeat(60) })).toEqual({ q: 'a'.repeat(60) });
    expect(ok(searchSkillsQuerySchema, { q: 'a'.repeat(61) })).toBe(false);
  });

  it('SKL-09 leaves q optional and untouched, even with an empty key', () => {
    expect(searchSkillsQuerySchema.parse({})).toEqual({});
    expect(searchSkillsQuerySchema.parse({ q: '  ..  ' })).toEqual({ q: '  ..  ' });
  });
});

describe('adminSkillsQuerySchema', () => {
  it('SKL-37 defaults scope to all and accepts the filters', () => {
    expect(adminSkillsQuerySchema.parse({})).toEqual({ scope: 'all' });
    expect(adminSkillsQuerySchema.parse({ scope: 'private', category: 'database', q: 'postgres', cursor: 'abc' })).toEqual({
      scope: 'private',
      category: 'database',
      q: 'postgres',
      cursor: 'abc',
    });
  });

  it('SKL-37 rejects an unknown scope and category', () => {
    expect(ok(adminSkillsQuerySchema, { scope: 'mine' })).toBe(false);
    expect(ok(adminSkillsQuerySchema, { category: 'hobby' })).toBe(false);
  });
});

describe('skill responses', () => {
  const id = '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60';

  it('SKL-33 accepts the admin page and the skill shape, with no owner field', () => {
    const skill = { id, name: 'Node.js', category: 'language', scope: 'global' };
    const page = {
      items: [{ ...skill, aliases: [{ id, alias: 'node' }] }],
      nextCursor: null,
      counts: { total: 1, private: 0 },
    };

    expect(skillSchema.parse(skill)).toEqual(skill);
    expect(adminSkillsPageSchema.parse(page)).toEqual(page);
    expect(aliasSchema.parse({ id, alias: 'node' })).toEqual({ id, alias: 'node' });
    expect(ok(skillSchema, { ...skill, scope: 'shared' })).toBe(false);
  });
});

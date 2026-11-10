import { normalizeSkillKey, type CreateSkillRequest, type Skill } from '@am/contracts';
import type { Outcome } from '../../../lib/bff';
import type { SkillsFieldApi } from '../../skills';
import { skillId } from './fixtures';

/** Skills of the global catalog the field can find, named `Skill Fictícia n` like the dictionary of the fixtures. */
export const catalogSkill = (n: number, overrides: Partial<Skill> = {}): Skill => ({
  id: skillId(n),
  name: `Skill Fictícia ${n}`,
  category: 'tool',
  scope: 'global',
  ...overrides,
});

/**
 * The skills api as the field of a bullet sees it: it finds the skills of `catalog` by name, and creates a
 * private one. `register` tells the resume api (`fakeResume(...).catalog`) about every skill it can find
 * or create, as the real api describes them through the skills module. `created` lists what was asked.
 */
export function fakeSkillsApi(catalog: Skill[], register: (skill: Skill) => void): SkillsFieldApi & { created: CreateSkillRequest[] } {
  for (const skill of catalog) register(skill);
  const created: CreateSkillRequest[] = [];
  return {
    created,
    search: (q: string): Promise<Outcome<Skill[]>> => {
      const key = normalizeSkillKey(q);
      return Promise.resolve({ ok: true, data: catalog.filter((skill) => normalizeSkillKey(skill.name).includes(key)) });
    },
    create: (body: CreateSkillRequest): Promise<Outcome<Skill>> => {
      created.push(body);
      const skill: Skill = { id: skillId(80 + created.length), name: body.name, category: body.category, scope: 'private' };
      register(skill);
      return Promise.resolve({ ok: true, data: skill });
    },
  };
}

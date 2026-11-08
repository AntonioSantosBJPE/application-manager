import { normalizeSkillKey, type CreateSkillRequest, type Skill } from '@am/contracts';
import type { Outcome } from '../../../lib/bff';
import { uuid } from './fixtures';

export const nest: Skill = { id: uuid(701), name: 'NestJS', category: 'framework', scope: 'global' };
export const node: Skill = { id: uuid(702), name: 'Node.js', category: 'tool', scope: 'global' };
export const react: Skill = { id: uuid(703), name: 'React', category: 'framework', scope: 'global' };
export const docker: Skill = { id: uuid(704), name: 'Docker', category: 'tool', scope: 'global' };

const aliases: Record<string, string[]> = { [node.id]: ['node', 'nodejs'] };

/** The names the fake api answers for the ids of these skills. */
export const skillNames = Object.fromEntries([nest, node, react, docker].map((skill) => [skill.id, skill.name]));

/**
 * The skills api as a field sees it: search by name or alias, and a create that answers a private skill.
 * `created` lists what was asked to be created, in order.
 */
export function fakeSkillsApi() {
  const catalog = [nest, node, react, docker];
  const created: CreateSkillRequest[] = [];
  return {
    created,
    search: (q: string): Promise<Outcome<Skill[]>> => {
      const key = normalizeSkillKey(q);
      const items = catalog.filter(
        (skill) =>
          normalizeSkillKey(skill.name).includes(key) ||
          (aliases[skill.id] ?? []).some((alias) => normalizeSkillKey(alias).includes(key)),
      );
      return Promise.resolve({ ok: true, data: items });
    },
    create: (body: CreateSkillRequest): Promise<Outcome<Skill>> => {
      created.push(body);
      const skill: Skill = { id: uuid(800 + created.length), name: body.name, category: body.category, scope: 'private' };
      return Promise.resolve({ ok: true, data: skill });
    },
  };
}

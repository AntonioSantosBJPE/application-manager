import type { PostingSkill } from '@am/contracts';

/** The row shows two skills (APP-44). */
export const ROW_SKILLS = 2;

/**
 * The skills drawn on a row: the first two required ones in the order received or, with none required,
 * the first two nice to have (spec: "Skills na linha").
 */
export function rowSkills(skills: readonly PostingSkill[]): PostingSkill[] {
  const required = skills.filter((skill) => skill.requirement === 'required');
  const pool = required.length > 0 ? required : skills.filter((skill) => skill.requirement === 'nice_to_have');
  return pool.slice(0, ROW_SKILLS);
}

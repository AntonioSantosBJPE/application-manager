/**
 * What the skills module asks of whoever knows how many job postings use a skill. The module declares the
 * port and never reads the data itself: the `applications` module implements it, so neither one reads the
 * schema of the other (AD-019).
 */
export interface SkillUsage {
  /** How many job postings of all people use each skill; a skill no posting uses is absent from the map. */
  countFor(skillIds: readonly string[]): Promise<Map<string, number>>;
}

/** The injection token of the `SkillUsage` implementation. */
export const SKILL_USAGE = Symbol('SKILL_USAGE');

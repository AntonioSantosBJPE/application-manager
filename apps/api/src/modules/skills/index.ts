/**
 * The public API of the skills module. Another module imports from here and nowhere else.
 */
export { SkillsModule } from './skills.module.js';
export { SkillsCatalog } from './application/skills-catalog.js';
export { SKILL_USAGE, type SkillUsage } from './domain/skill-usage.js';

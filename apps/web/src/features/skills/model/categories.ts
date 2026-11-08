import type { SkillCategory } from '@am/contracts';

/** The label of each category on the chip and on the row; `language` is just "Linguagem" (AD-015). */
export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: 'Linguagem',
  framework: 'Framework',
  database: 'Banco de dados',
  cloud_devops: 'Cloud/DevOps',
  tool: 'Ferramenta',
  practice: 'Prática',
  soft_skill: 'Soft skill',
};

/** The order of the seven chips, as the PageSkills card lays them out. */
export const CATEGORY_ORDER: readonly SkillCategory[] = [
  'language',
  'framework',
  'database',
  'cloud_devops',
  'tool',
  'practice',
  'soft_skill',
];

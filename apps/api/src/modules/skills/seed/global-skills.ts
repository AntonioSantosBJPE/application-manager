import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { skillCategorySchema, type SkillCategory } from '@am/contracts';
import { z } from 'zod';

export interface SeedSkill {
  name: string;
  category: SkillCategory;
  aliases: string[];
}

const seedSchema = z.array(
  z.object({
    name: z.string(),
    category: skillCategorySchema,
    aliases: z.array(z.string()),
  }),
);

/** `apps/api`, found the same way from `src/` and from `dist/`, which have the same depth. */
export const API_ROOT = join(import.meta.dirname, '../../../..');

/** The reviewed list of global skills; the SQL of the seed migration is generated from it. */
export function readSeedSkills(): SeedSkill[] {
  return seedSchema.parse(JSON.parse(readFileSync(join(API_ROOT, 'src/modules/skills/seed/global-skills.json'), 'utf8')));
}

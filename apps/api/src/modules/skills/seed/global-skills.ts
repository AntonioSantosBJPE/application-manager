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

/** The reviewed list of global skills; the SQL of the seed migration is generated from it. */
export function readSeedSkills(): SeedSkill[] {
  return seedSchema.parse(JSON.parse(readFileSync(join(import.meta.dirname, 'global-skills.json'), 'utf8')));
}

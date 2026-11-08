import { z } from 'zod';

/** A skill name or alias is 1 to 60 characters after trimming; the same bound limits the search text (SKL-09, SKL-15). */
export const SKILL_TEXT_MIN_LENGTH = 1;
export const SKILL_TEXT_MAX_LENGTH = 60;

/**
 * The normalized key that makes "Node.js", "nodejs" and "NODEJS" one skill: Unicode NFKD, combining
 * marks removed, lowercase, and only letters, digits, `+` and `#` kept (SKL-01). "C", "C++" and "C#"
 * stay three different keys.
 */
export function normalizeSkillKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#]/gu, '');
}

/** A name or an alias: trimmed, inner whitespace collapsed to one space, 1 to 60 characters, no control character (such as U+0000, which Postgres refuses), key not empty (SKL-15, SKL-31, SKL-66). */
export const skillTextSchema = z
  .string()
  .transform((text) => text.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(SKILL_TEXT_MIN_LENGTH)
      .max(SKILL_TEXT_MAX_LENGTH)
      .refine((text) => !/\p{Cc}/u.test(text), { message: 'Control characters are not allowed' })
      .refine((text) => normalizeSkillKey(text).length > 0, { message: 'The normalized key is empty' }),
  );

export const skillCategorySchema = z.enum([
  'language',
  'framework',
  'database',
  'cloud_devops',
  'tool',
  'practice',
  'soft_skill',
]);
export type SkillCategory = z.infer<typeof skillCategorySchema>;

export const skillScopeSchema = z.enum(['global', 'private']);
export type SkillScope = z.infer<typeof skillScopeSchema>;

export const skillSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  category: skillCategorySchema,
  scope: skillScopeSchema,
});
export type Skill = z.infer<typeof skillSchema>;

/** Unknown keys such as `ownerUserId` and `scope` are stripped: the owner comes only from the session (SKL-16). */
export const createSkillRequestSchema = z.object({
  name: skillTextSchema,
  category: skillCategorySchema,
});
export type CreateSkillRequest = z.infer<typeof createSkillRequestSchema>;

export const updateSkillRequestSchema = z
  .object({
    name: skillTextSchema.optional(),
    category: skillCategorySchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.category !== undefined, {
    message: 'At least one of name and category is required',
  });
export type UpdateSkillRequest = z.infer<typeof updateSkillRequestSchema>;

export const aliasRequestSchema = z.object({ alias: skillTextSchema });
export type AliasRequest = z.infer<typeof aliasRequestSchema>;

export const aliasSchema = z.object({ id: z.uuid(), alias: z.string() });
export type Alias = z.infer<typeof aliasSchema>;

/** The search text is not trimmed and may have an empty key: it then lists the first skills (SKL-07). */
export const searchSkillsQuerySchema = z.object({
  q: z.string().max(SKILL_TEXT_MAX_LENGTH).optional(),
});
export type SearchSkillsQuery = z.infer<typeof searchSkillsQuerySchema>;

export const skillScopeFilterSchema = z.enum(['all', 'global', 'private']);
export type SkillScopeFilter = z.infer<typeof skillScopeFilterSchema>;

export const adminSkillsQuerySchema = z.object({
  scope: skillScopeFilterSchema.default('all'),
  category: skillCategorySchema.optional(),
  q: z.string().max(SKILL_TEXT_MAX_LENGTH).optional(),
  cursor: z.string().min(1).optional(),
});
export type AdminSkillsQuery = z.infer<typeof adminSkillsQuerySchema>;

/** A catalog row for the admin; it never carries the owner of a private skill (SKL-33). */
export const adminSkillSchema = skillSchema.extend({ aliases: z.array(aliasSchema) });
export type AdminSkill = z.infer<typeof adminSkillSchema>;

export const adminSkillsPageSchema = z.object({
  items: z.array(adminSkillSchema),
  nextCursor: z.string().nullable(),
  counts: z.object({
    total: z.number().int().nonnegative(),
    private: z.number().int().nonnegative(),
  }),
});
export type AdminSkillsPage = z.infer<typeof adminSkillsPageSchema>;

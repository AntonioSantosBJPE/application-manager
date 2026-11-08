import { sql } from 'drizzle-orm';
import { index, pgSchema, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * The `skills` module owns its own schema: no foreign key leaves it, so `owner_user_id` is a plain
 * uuid and the module can be extracted without a rewrite (SKL-04).
 */
export const skillsSchema = pgSchema('skills');

export const skillCategory = skillsSchema.enum('skill_category', [
  'language',
  'framework',
  'database',
  'cloud_devops',
  'tool',
  'practice',
  'soft_skill',
]);

const id = () => uuid().primaryKey().default(sql`uuidv7()`);

export const skills = skillsSchema.table(
  'skills',
  {
    id: id(),
    /** The official name, already trimmed and with inner spaces collapsed. */
    name: text().notNull(),
    /** `normalizeSkillKey(name)`. */
    normalizedKey: text('normalized_key').notNull(),
    category: skillCategory().notNull(),
    /** Null means global; no foreign key, by design. */
    ownerUserId: uuid('owner_user_id'),
  },
  (table) => [
    uniqueIndex('skills_global_key_unique')
      .on(table.normalizedKey)
      .where(sql`owner_user_id is null`),
    uniqueIndex('skills_private_key_unique')
      .on(table.ownerUserId, table.normalizedKey)
      .where(sql`owner_user_id is not null`),
    index('skills_owner_user_id_index').on(table.ownerUserId),
  ],
);

export const skillAliases = skillsSchema.table('skill_aliases', {
  id: id(),
  skillId: uuid('skill_id')
    .notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
  /** The text as the admin typed it. */
  alias: text().notNull(),
  normalizedAlias: text('normalized_alias').notNull().unique(),
});

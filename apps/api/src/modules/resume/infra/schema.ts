import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * The `resume` module owns its own schema: no foreign key leaves it, so `user_id` and the ids in
 * `bullets.skill_ids` are plain uuids and the module can be extracted without a rewrite (RES-31).
 */
export const resumeSchema = pgSchema('resume');

export const languageLevel = resumeSchema.enum('language_level', ['basic', 'intermediate', 'advanced', 'fluent', 'native']);

const id = () => uuid().primaryKey().default(sql`uuidv7()`);
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
/** A month is stored as `date` on day 1 and travels as `YYYY-MM` (RES-11). */
const month = (name: string) => date(name, { mode: 'string' });

export const profiles = resumeSchema.table(
  'profiles',
  {
    id: id(),
    /** The owner; one profile per user (RES-06). */
    userId: uuid('user_id').notNull(),
    fullName: text('full_name').notNull().default(''),
    headline: text().notNull().default(''),
    email: text().notNull().default(''),
    phone: text(),
    location: text(),
    links: jsonb().$type<{ label: string; url: string }[]>().notNull().default(sql`'[]'::jsonb`),
    summary: text().notNull().default(''),
    locale: text().notNull().default('pt-BR'),
    updatedAt: instant('updated_at').notNull(),
  },
  (table) => [unique('profiles_user_id_unique').on(table.userId)],
);

export const experiences = resumeSchema.table(
  'experiences',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    role: text().notNull(),
    company: text().notNull(),
    location: text(),
    startDate: month('start_date').notNull(),
    endDate: month('end_date'),
    position: integer().notNull(),
  },
  (table) => [index('experiences_user_position_index').on(table.userId, table.position)],
);

export const projects = resumeSchema.table(
  'projects',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    name: text().notNull(),
    url: text(),
    description: text(),
    position: integer().notNull(),
  },
  (table) => [index('projects_user_position_index').on(table.userId, table.position)],
);

export const educations = resumeSchema.table(
  'educations',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    course: text().notNull(),
    institution: text().notNull(),
    startDate: month('start_date').notNull(),
    endDate: month('end_date'),
    position: integer().notNull(),
  },
  (table) => [index('educations_user_position_index').on(table.userId, table.position)],
);

export const certifications = resumeSchema.table(
  'certifications',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    name: text().notNull(),
    issuer: text(),
    issuedOn: month('issued_on'),
    url: text(),
    position: integer().notNull(),
  },
  (table) => [index('certifications_user_position_index').on(table.userId, table.position)],
);

export const languages = resumeSchema.table(
  'languages',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    language: text().notNull(),
    level: languageLevel().notNull(),
    position: integer().notNull(),
  },
  (table) => [index('languages_user_position_index').on(table.userId, table.position)],
);

export const bullets = resumeSchema.table(
  'bullets',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    experienceId: uuid('experience_id').references(() => experiences.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    text: text().notNull(),
    /** Skills of the `skills` module, validated through its public API; no foreign key, in the order they were marked (RES-23). */
    skillIds: uuid('skill_ids').array().notNull().default(sql`'{}'::uuid[]`),
    position: integer().notNull(),
  },
  (table) => [
    index('bullets_experience_position_index').on(table.experienceId, table.position),
    index('bullets_project_position_index').on(table.projectId, table.position),
    check('bullets_one_parent', sql`num_nonnulls(${table.experienceId}, ${table.projectId}) = 1`),
  ],
);

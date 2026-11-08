import { sql } from 'drizzle-orm';
import { check, index, pgSchema, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The `applications` module owns its own schema: no foreign key leaves it, so `user_id`, `skill_id` and
 * `submitted_document_id` are plain uuids and the module can be extracted without a rewrite (APP-07).
 */
export const applicationsSchema = pgSchema('applications');

export const applicationStatus = applicationsSchema.enum('application_status', [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
]);
export const jobLevel = applicationsSchema.enum('job_level', ['intern', 'junior', 'mid', 'senior', 'specialist']);
export const workModel = applicationsSchema.enum('work_model', ['remote', 'hybrid', 'onsite']);
export const skillRequirement = applicationsSchema.enum('skill_requirement', ['required', 'nice_to_have']);
export const eventKind = applicationsSchema.enum('event_kind', ['status_changed', 'stage', 'note']);
export const stage = applicationsSchema.enum('stage', ['screening', 'hr', 'technical', 'case', 'other']);

const id = () => uuid().primaryKey().default(sql`uuidv7()`);
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const jobPostings = applicationsSchema.table(
  'job_postings',
  {
    id: id(),
    /** The owner; a plain uuid, no foreign key (Key decision 1). */
    userId: uuid('user_id').notNull(),
    company: text().notNull(),
    title: text().notNull(),
    url: text(),
    description: text(),
    level: jobLevel().notNull(),
    location: text(),
    workModel: workModel('work_model'),
    /** `searchTextOf(company, title)`: what the search compares `q` with (APP-13). */
    searchText: text('search_text').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [index('job_postings_user_id_index').on(table.userId)],
);

export const jobPostingSkills = applicationsSchema.table(
  'job_posting_skills',
  {
    jobPostingId: uuid('job_posting_id')
      .notNull()
      .references(() => jobPostings.id, { onDelete: 'cascade' }),
    /** A skill of the `skills` module, validated through its public API; no foreign key (Key decision 2). */
    skillId: uuid('skill_id').notNull(),
    requirement: skillRequirement().notNull(),
    /** The order the skills were sent in (APP-30). */
    position: smallint().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.jobPostingId, table.skillId] }),
    index('job_posting_skills_skill_id_index').on(table.skillId),
  ],
);

export const applications = applicationsSchema.table(
  'applications',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    jobPostingId: uuid('job_posting_id')
      .notNull()
      .unique()
      .references(() => jobPostings.id, { onDelete: 'cascade' }),
    status: applicationStatus().notNull(),
    /** Stays unused until ResumeDocument exists (AD-017); no foreign key (Key decision 2). */
    submittedDocumentId: uuid('submitted_document_id'),
    lastActivityAt: instant('last_activity_at').notNull(),
    /** "Ainda não" on the ghost suggestion hides it until this instant (AD-020). */
    ghostSnoozedUntil: instant('ghost_snoozed_until'),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [
    index('applications_user_status_activity_index').on(table.userId, table.status, table.lastActivityAt.desc(), table.id),
    index('applications_user_status_created_index').on(table.userId, table.status, table.createdAt.desc(), table.id),
  ],
);

export const applicationEvents = applicationsSchema.table(
  'application_events',
  {
    id: id(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    kind: eventKind().notNull(),
    fromStatus: applicationStatus('from_status'),
    toStatus: applicationStatus('to_status'),
    stage: stage(),
    note: text(),
    occurredAt: instant('occurred_at').notNull(),
    /** Breaks the tie between events with the same `occurred_at` in the timeline. */
    createdAt: instant('created_at').notNull(),
  },
  (table) => [
    index('application_events_timeline_index').on(table.applicationId, table.occurredAt.desc(), table.createdAt.desc()),
    check('application_events_status_changed_has_to_status', sql`${table.kind} <> 'status_changed' or ${table.toStatus} is not null`),
    check('application_events_stage_has_stage', sql`${table.kind} <> 'stage' or ${table.stage} is not null`),
    check('application_events_note_has_note', sql`${table.kind} <> 'note' or ${table.note} is not null`),
  ],
);

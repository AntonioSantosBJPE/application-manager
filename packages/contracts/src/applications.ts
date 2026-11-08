import { z } from 'zod';
import { problemDetailsSchema } from './identity.js';
import { skillCategorySchema, skillScopeSchema } from './skills.js';

export const applicationStatusSchema = z.enum([
  'saved',
  'applied',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const jobLevelSchema = z.enum(['intern', 'junior', 'mid', 'senior', 'specialist']);
export type JobLevel = z.infer<typeof jobLevelSchema>;

export const workModelSchema = z.enum(['remote', 'hybrid', 'onsite']);
export type WorkModel = z.infer<typeof workModelSchema>;

export const skillRequirementSchema = z.enum(['required', 'nice_to_have']);
export type SkillRequirement = z.infer<typeof skillRequirementSchema>;

export const stageSchema = z.enum(['screening', 'hr', 'technical', 'case', 'other']);
export type Stage = z.infer<typeof stageSchema>;

export const eventKindSchema = z.enum(['status_changed', 'stage', 'note']);
export type EventKind = z.infer<typeof eventKindSchema>;

/** The statuses of the "Ativas" tab, then of the "Encerradas" tab (APP-11). */
export const ACTIVE_STATUSES = ['saved', 'applied', 'interviewing', 'offer'] as const satisfies readonly ApplicationStatus[];
export const CLOSED_STATUSES = ['accepted', 'rejected', 'withdrawn', 'ghosted'] as const satisfies readonly ApplicationStatus[];

/** From the most advanced status to the least in each tab, active first (APP-14). */
export const FUNNEL_ORDER = [
  'offer',
  'interviewing',
  'applied',
  'saved',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
] as const satisfies readonly ApplicationStatus[];

export const COMPANY_MAX_LENGTH = 200;
export const TITLE_MAX_LENGTH = 200;
export const LOCATION_MAX_LENGTH = 120;
export const URL_MAX_LENGTH = 2048;
export const DESCRIPTION_MAX_LENGTH = 20_000;
export const NOTE_MAX_LENGTH = 2_000;
export const SKILLS_PER_POSTING_MAX = 50;
export const SEARCH_MAX_LENGTH = 100;
/** An event may be dated at most this far in the future (APP-25). */
export const EVENT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Postgres refuses U+0000 in text, so a control character answers `400` instead of `500`. */
const noControl = (text: string) => !/[\p{Cc}]/u.test(text.replace(/[\n\r\t]/g, ' '));

/** A text trimmed to 1 to `max` characters with no control character (APP-04). */
const trimmedText = (max: number) =>
  z
    .string()
    .transform((text) => text.trim())
    .pipe(z.string().min(1).max(max).refine(noControl, { message: 'Control characters are not allowed' }));

/** A link starting with `http://` or `https://`, at most 2048 characters (APP-04). */
const linkSchema = z
  .string()
  .transform((text) => text.trim())
  .pipe(
    z
      .string()
      .max(URL_MAX_LENGTH)
      .refine((text) => /^https?:\/\/\S+$/i.test(text), { message: 'The link must start with http:// or https://' })
      .refine(noControl, { message: 'Control characters are not allowed' }),
  );

/** Free text kept as typed, without a control character other than line breaks and tabs. */
const freeText = (max: number) => z.string().max(max).refine(noControl, { message: 'Control characters are not allowed' });

const jobPostingFields = {
  company: trimmedText(COMPANY_MAX_LENGTH),
  title: trimmedText(TITLE_MAX_LENGTH),
  url: linkSchema,
  description: freeText(DESCRIPTION_MAX_LENGTH),
  level: jobLevelSchema,
  location: trimmedText(LOCATION_MAX_LENGTH),
  workModel: workModelSchema,
};

export const postingSkillInputSchema = z.object({
  skillId: z.string(),
  requirement: skillRequirementSchema,
});
export type PostingSkillInput = z.infer<typeof postingSkillInputSchema>;

/** Ids are checked by the API against the skills module, so a bad id answers `422`, not `400` (APP-05). */
export const postingSkillsSchema = z.array(postingSkillInputSchema).max(SKILLS_PER_POSTING_MAX);

/** Unknown keys such as `userId` are stripped: the owner comes only from the session (APP-06). */
export const createApplicationRequestSchema = z.object({
  jobPosting: z.object({
    company: jobPostingFields.company,
    title: jobPostingFields.title,
    url: jobPostingFields.url.optional(),
    description: jobPostingFields.description.optional(),
    level: jobPostingFields.level,
    location: jobPostingFields.location.optional(),
    workModel: jobPostingFields.workModel.optional(),
  }),
  skills: postingSkillsSchema.optional(),
  status: applicationStatusSchema.optional(),
});
export type CreateApplicationRequest = z.infer<typeof createApplicationRequestSchema>;

/** At least one field; `null` clears a field that is optional on the posting (APP-28, APP-29, APP-31). */
export const updateJobPostingRequestSchema = z
  .object({
    company: jobPostingFields.company.optional(),
    title: jobPostingFields.title.optional(),
    url: jobPostingFields.url.nullable().optional(),
    description: jobPostingFields.description.nullable().optional(),
    level: jobPostingFields.level.optional(),
    location: jobPostingFields.location.nullable().optional(),
    workModel: jobPostingFields.workModel.nullable().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'At least one field is required',
  });
export type UpdateJobPostingRequest = z.infer<typeof updateJobPostingRequestSchema>;

/** The body of `PUT /applications/:id/skills` is the list itself, in the order to keep (APP-30). */
export const replaceSkillsRequestSchema = postingSkillsSchema;
export type ReplaceSkillsRequest = z.infer<typeof replaceSkillsRequestSchema>;

export const changeStatusRequestSchema = z.object({
  status: applicationStatusSchema,
  note: freeText(NOTE_MAX_LENGTH).optional(),
});
export type ChangeStatusRequest = z.infer<typeof changeStatusRequestSchema>;

const occurredAtSchema = z.iso.datetime({ offset: true });

/** A note of a stage: trimmed, and a blank one is the same as none (APP-23). */
const stageNoteSchema = freeText(NOTE_MAX_LENGTH).transform((text) => (text.trim() === '' ? undefined : text.trim()));

/** A stage needs `stage`, a note needs `note`; `status_changed` is not created here (APP-23, APP-25). */
export const createEventRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stage'),
    stage: stageSchema,
    note: stageNoteSchema.optional(),
    occurredAt: occurredAtSchema.optional(),
  }),
  z.object({
    kind: z.literal('note'),
    note: z
      .string()
      .max(NOTE_MAX_LENGTH)
      .refine((text) => text.trim().length > 0, { message: 'The note is empty' })
      .refine(noControl, { message: 'Control characters are not allowed' }),
    occurredAt: occurredAtSchema.optional(),
  }),
]);
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;

/** A comma separated list: an empty part (`?level=`, `?level=a,`) is a value outside the enum, so it is refused (APP-17). */
const csv = <T extends z.ZodType<unknown, string>>(item: T) =>
  z
    .string()
    .transform((text): string[] => text.split(','))
    .pipe(z.array(item));

export const applicationsSortSchema = z.enum(['activity', 'created']);
export type ApplicationsSort = z.infer<typeof applicationsSortSchema>;

export const applicationsTabSchema = z.enum(['active', 'closed']);
export type ApplicationsTab = z.infer<typeof applicationsTabSchema>;

/** `status`, `level` and `workModel` are comma separated lists; `q` is at most 100 characters (APP-12, APP-17). */
export const listApplicationsQuerySchema = z.object({
  tab: applicationsTabSchema.default('active'),
  status: csv(applicationStatusSchema).optional(),
  level: csv(jobLevelSchema).optional(),
  workModel: csv(workModelSchema).optional(),
  q: z.string().max(SEARCH_MAX_LENGTH).optional(),
  sort: applicationsSortSchema.default('activity'),
  cursor: z.string().min(1).optional(),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;

export const postingSkillSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  scope: skillScopeSchema,
  requirement: skillRequirementSchema,
});
export type PostingSkill = z.infer<typeof postingSkillSchema>;

export const applicationSummarySchema = z.object({
  id: z.uuid(),
  status: applicationStatusSchema,
  company: z.string(),
  title: z.string(),
  level: jobLevelSchema,
  workModel: workModelSchema.nullable(),
  skills: z.array(postingSkillSchema),
  createdAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
  ghostSuggested: z.boolean(),
});
export type ApplicationSummary = z.infer<typeof applicationSummarySchema>;

export const applicationEventSchema = z.object({
  id: z.uuid(),
  kind: eventKindSchema,
  fromStatus: applicationStatusSchema.nullable(),
  toStatus: applicationStatusSchema.nullable(),
  stage: stageSchema.nullable(),
  note: z.string().nullable(),
  occurredAt: z.iso.datetime(),
});
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;

export const applicationDetailSchema = applicationSummarySchema.extend({
  url: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  skills: z.array(postingSkillSchema.extend({ category: skillCategorySchema })),
  events: z.array(applicationEventSchema),
});
export type ApplicationDetail = z.infer<typeof applicationDetailSchema>;

const countSchema = z.number().int().nonnegative();

export const applicationsPageSchema = z.object({
  items: z.array(applicationSummarySchema),
  nextCursor: z.string().nullable(),
  counts: z.object({
    active: countSchema,
    closed: countSchema,
    byStatus: z.object({
      saved: countSchema,
      applied: countSchema,
      interviewing: countSchema,
      offer: countSchema,
      accepted: countSchema,
      rejected: countSchema,
      withdrawn: countSchema,
      ghosted: countSchema,
    }),
  }),
});
export type ApplicationsPage = z.infer<typeof applicationsPageSchema>;

export const applicationsCountSchema = z.object({ total: countSchema });
export type ApplicationsCount = z.infer<typeof applicationsCountSchema>;

/** The `422` of a skill the member cannot use: Problem Details plus the ids that were refused (APP-05, APP-31). */
export const invalidSkillsProblemSchema = problemDetailsSchema.extend({ invalidSkillIds: z.array(z.string()) });
export type InvalidSkillsProblem = z.infer<typeof invalidSkillsProblemSchema>;

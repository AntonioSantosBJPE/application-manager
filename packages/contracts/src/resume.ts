import { z } from 'zod';
import { skillScopeSchema } from './skills.js';
import { noControl } from './text.js';

export const RESUME_ITEMS_MAX = 50;
export const BULLETS_PER_ITEM_MAX = 30;
export const SKILLS_PER_BULLET_MAX = 20;
export const PROFILE_LINKS_MAX = 5;
export const BULLET_TEXT_MAX_LENGTH = 500;
export const FULL_NAME_MAX_LENGTH = 120;
export const HEADLINE_MAX_LENGTH = 160;
export const EMAIL_MAX_LENGTH = 254;
export const PHONE_MAX_LENGTH = 40;
export const PROFILE_LOCATION_MAX_LENGTH = 120;
export const LINK_LABEL_MAX_LENGTH = 40;
export const RESUME_URL_MAX_LENGTH = 2048;
export const PROFILE_SUMMARY_MAX_LENGTH = 2_000;
export const RESUME_NAME_MAX_LENGTH = 160;
export const RESUME_DESCRIPTION_MAX_LENGTH = 2_000;
export const LANGUAGE_MAX_LENGTH = 60;

export const RESUME_SECTIONS = ['experiences', 'projects', 'educations', 'certifications', 'languages'] as const;
export const resumeSectionSchema = z.enum(RESUME_SECTIONS);
export type ResumeSection = z.infer<typeof resumeSectionSchema>;

export const languageLevelSchema = z.enum(['basic', 'intermediate', 'advanced', 'fluent', 'native']);
export type LanguageLevel = z.infer<typeof languageLevelSchema>;

/** `YYYY-MM`, month 01 to 12 (RES-11). */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'The month must be YYYY-MM' });
export type Month = z.infer<typeof monthSchema>;

/** A text trimmed to `min` to `max` characters with no control character. */
const text = (min: number, max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(min).max(max).refine(noControl, { message: 'Control characters are not allowed' }));

const required = (max: number) => text(1, max);
/** A text that may be empty while the profile is being filled. */
const optionalText = (max: number) => text(0, max);

const link = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .max(max)
        .refine((value) => /^https?:\/\/\S+$/i.test(value), { message: 'The link must start with http:// or https://' })
        .refine(noControl, { message: 'Control characters are not allowed' }),
    );

const emailOrEmpty = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .max(EMAIL_MAX_LENGTH)
      .refine((value) => value === '' || z.email().safeParse(value).success, { message: 'Invalid email' }),
  );

export const profileLinkSchema = z.object({
  label: required(LINK_LABEL_MAX_LENGTH),
  url: link(RESUME_URL_MAX_LENGTH),
});
export type ProfileLink = z.infer<typeof profileLinkSchema>;

const profileFields = {
  fullName: optionalText(FULL_NAME_MAX_LENGTH),
  headline: optionalText(HEADLINE_MAX_LENGTH),
  email: emailOrEmpty,
  phone: optionalText(PHONE_MAX_LENGTH).nullable(),
  location: optionalText(PROFILE_LOCATION_MAX_LENGTH).nullable(),
  links: z.array(profileLinkSchema).max(PROFILE_LINKS_MAX),
  summary: optionalText(PROFILE_SUMMARY_MAX_LENGTH),
  locale: z.literal('pt-BR'),
};

/** Every field may be empty: the profile is saved field by field (RES-04). Unknown keys such as `userId` are stripped (RES-28). */
export const saveProfileRequestSchema = z.object(profileFields);
export type SaveProfileRequest = z.infer<typeof saveProfileRequestSchema>;

export const profileSchema = z.object({
  fullName: z.string(),
  headline: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  summary: z.string(),
  locale: z.literal('pt-BR'),
});
export type Profile = z.infer<typeof profileSchema>;

const endAfterStart = (body: { startDate?: string; endDate?: string | null }) =>
  body.startDate === undefined || body.endDate === undefined || body.endDate === null || body.endDate >= body.startDate;
const endAfterStartIssue = { message: 'The end must not be before the start', path: ['endDate'] };

const optionalLink = link(RESUME_URL_MAX_LENGTH).nullable();
const optionalDescription = optionalText(RESUME_DESCRIPTION_MAX_LENGTH).nullable();

const experienceFields = {
  role: required(RESUME_NAME_MAX_LENGTH),
  company: required(RESUME_NAME_MAX_LENGTH),
  location: optionalText(PROFILE_LOCATION_MAX_LENGTH).nullable(),
  startDate: monthSchema,
  endDate: monthSchema.nullable(),
};
const projectFields = {
  name: required(RESUME_NAME_MAX_LENGTH),
  url: optionalLink,
  description: optionalDescription,
};
const educationFields = {
  course: required(RESUME_NAME_MAX_LENGTH),
  institution: required(RESUME_NAME_MAX_LENGTH),
  startDate: monthSchema,
  endDate: monthSchema.nullable(),
};
const certificationFields = {
  name: required(RESUME_NAME_MAX_LENGTH),
  issuer: optionalText(RESUME_NAME_MAX_LENGTH).nullable(),
  issuedOn: monthSchema.nullable(),
  url: optionalLink,
};
const languageFields = {
  language: required(LANGUAGE_MAX_LENGTH),
  level: languageLevelSchema,
};

/** Optional fields of a create body may be left out; the stored value is then null. */
const createExperience = z
  .object({ ...experienceFields, location: experienceFields.location.optional(), endDate: experienceFields.endDate.optional() })
  .refine(endAfterStart, endAfterStartIssue);
const createProject = z.object({
  ...projectFields,
  url: optionalLink.optional(),
  description: optionalDescription.optional(),
});
const createEducation = z
  .object({ ...educationFields, endDate: educationFields.endDate.optional() })
  .refine(endAfterStart, endAfterStartIssue);
const createCertification = z.object({
  ...certificationFields,
  issuer: certificationFields.issuer.optional(),
  issuedOn: certificationFields.issuedOn.optional(),
  url: optionalLink.optional(),
});
const createLanguage = z.object(languageFields);

/** An edit sends only the fields it changes; the end is checked against the start when both come (RES-08). */
const updateExperience = z.object(experienceFields).partial().refine(endAfterStart, endAfterStartIssue);
const updateProject = z.object(projectFields).partial();
const updateEducation = z.object(educationFields).partial().refine(endAfterStart, endAfterStartIssue);
const updateCertification = z.object(certificationFields).partial();
const updateLanguage = z.object(languageFields).partial();

export const createItemRequestSchemas = {
  experiences: createExperience,
  projects: createProject,
  educations: createEducation,
  certifications: createCertification,
  languages: createLanguage,
} as const;

export const updateItemRequestSchemas = {
  experiences: updateExperience,
  projects: updateProject,
  educations: updateEducation,
  certifications: updateCertification,
  languages: updateLanguage,
} as const;

export type CreateExperienceRequest = z.infer<typeof createExperience>;
export type CreateProjectRequest = z.infer<typeof createProject>;
export type CreateEducationRequest = z.infer<typeof createEducation>;
export type CreateCertificationRequest = z.infer<typeof createCertification>;
export type CreateLanguageRequest = z.infer<typeof createLanguage>;
export type UpdateExperienceRequest = z.infer<typeof updateExperience>;
export type UpdateProjectRequest = z.infer<typeof updateProject>;
export type UpdateEducationRequest = z.infer<typeof updateEducation>;
export type UpdateCertificationRequest = z.infer<typeof updateCertification>;
export type UpdateLanguageRequest = z.infer<typeof updateLanguage>;

/** Ids are checked by the API against the skills module, so a bad id answers `422`, not `400` (RES-20). */
const skillIdsSchema = z.array(z.string()).max(SKILLS_PER_BULLET_MAX);

export const createBulletRequestSchema = z.object({
  text: required(BULLET_TEXT_MAX_LENGTH),
  skillIds: skillIdsSchema,
});
export type CreateBulletRequest = z.infer<typeof createBulletRequestSchema>;

export const updateBulletRequestSchema = z
  .object({ text: required(BULLET_TEXT_MAX_LENGTH).optional(), skillIds: skillIdsSchema.optional() })
  .refine((body) => body.text !== undefined || body.skillIds !== undefined, { message: 'At least one field is required' });
export type UpdateBulletRequest = z.infer<typeof updateBulletRequestSchema>;

/** The list of ids in the order to keep; the API checks that it is the exact set (RES-27). */
export const orderRequestSchema = z.object({ ids: z.array(z.string()) });
export type OrderRequest = z.infer<typeof orderRequestSchema>;

export const bulletSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  skillIds: z.array(z.uuid()),
});
export type Bullet = z.infer<typeof bulletSchema>;

/** Each skill cited once, keyed by id (AD-028). */
export const skillDictionarySchema = z.record(z.uuid(), z.object({ name: z.string(), scope: skillScopeSchema }));
export type SkillDictionary = z.infer<typeof skillDictionarySchema>;

export const bulletResponseSchema = z.object({ bullet: bulletSchema, skills: skillDictionarySchema });
export type BulletResponse = z.infer<typeof bulletResponseSchema>;

export const experienceSchema = z.object({
  id: z.uuid(),
  role: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  startDate: monthSchema,
  endDate: monthSchema.nullable(),
});
export type ExperienceItem = z.infer<typeof experienceSchema>;
export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  url: z.string().nullable(),
  description: z.string().nullable(),
});
export type ProjectItem = z.infer<typeof projectSchema>;
export const educationSchema = z.object({
  id: z.uuid(),
  course: z.string(),
  institution: z.string(),
  startDate: monthSchema,
  endDate: monthSchema.nullable(),
});
export type Education = z.infer<typeof educationSchema>;
export const certificationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  issuer: z.string().nullable(),
  issuedOn: monthSchema.nullable(),
  url: z.string().nullable(),
});
export type Certification = z.infer<typeof certificationSchema>;
export const languageSchema = z.object({ id: z.uuid(), language: z.string(), level: languageLevelSchema });
export type Language = z.infer<typeof languageSchema>;

export const experienceWithBulletsSchema = experienceSchema.extend({ bullets: z.array(bulletSchema) });
export type Experience = z.infer<typeof experienceWithBulletsSchema>;
export const projectWithBulletsSchema = projectSchema.extend({ bullets: z.array(bulletSchema) });
export type Project = z.infer<typeof projectWithBulletsSchema>;

export const masterResumeSchema = z.object({
  profile: profileSchema,
  experiences: z.array(experienceWithBulletsSchema),
  projects: z.array(projectWithBulletsSchema),
  educations: z.array(educationSchema),
  certifications: z.array(certificationSchema),
  languages: z.array(languageSchema),
  skills: skillDictionarySchema,
});
export type MasterResume = z.infer<typeof masterResumeSchema>;

export const orderResponseSchema = z.object({ ids: z.array(z.uuid()) });
export type OrderResponse = z.infer<typeof orderResponseSchema>;

export const resumeSummarySchema = z.object({ ready: z.boolean() });
export type ResumeSummary = z.infer<typeof resumeSummarySchema>;

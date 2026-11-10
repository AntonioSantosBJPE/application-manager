import type {
  BulletResponse,
  Certification,
  CreateBulletRequest,
  CreateCertificationRequest,
  CreateEducationRequest,
  CreateExperienceRequest,
  CreateLanguageRequest,
  CreateProjectRequest,
  Education,
  ExperienceItem,
  Language,
  MasterResume,
  OrderResponse,
  Profile,
  ProjectItem,
  ResumeSection,
  ResumeSummary,
  SaveProfileRequest,
  UpdateBulletRequest,
  UpdateCertificationRequest,
  UpdateEducationRequest,
  UpdateExperienceRequest,
  UpdateLanguageRequest,
  UpdateProjectRequest,
} from '@am/contracts';
import {
  bulletResponseSchema,
  certificationSchema,
  createBulletRequestSchema,
  createItemRequestSchemas,
  educationSchema,
  experienceSchema,
  languageSchema,
  masterResumeSchema,
  orderRequestSchema,
  orderResponseSchema,
  profileSchema,
  projectSchema,
  resumeSectionSchema,
  resumeSummarySchema,
  saveProfileRequestSchema,
  updateBulletRequestSchema,
  updateItemRequestSchemas,
} from '@am/contracts';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { accepted, contextOfCurrentRequest, parsed, responseOptionsOfCurrentRequest, type Outcome } from '../../../lib/bff';
import { callApi, type ApiRequestContext } from '../../../lib/call-api';

/**
 * The eleven endpoints the browser reaches for the master resume (AD-007), one server function each, named
 * by its key. The pure functions below are what the tests drive; the `createServerFn` ones at the end only
 * add the input check.
 */
export const RESUME_ENDPOINTS = {
  getResume: { method: 'GET', path: '/resume' },
  getResumeSummary: { method: 'GET', path: '/resume/summary' },
  saveProfile: { method: 'PUT', path: '/resume/profile' },
  createResumeItem: { method: 'POST', path: '/resume/:section' },
  updateResumeItem: { method: 'PATCH', path: '/resume/:section/:id' },
  deleteResumeItem: { method: 'DELETE', path: '/resume/:section/:id' },
  orderResumeItems: { method: 'PUT', path: '/resume/:section/order' },
  createBullet: { method: 'POST', path: '/resume/:section/:id/bullets' },
  updateBullet: { method: 'PATCH', path: '/resume/:section/:id/bullets/:bulletId' },
  deleteBullet: { method: 'DELETE', path: '/resume/:section/:id/bullets/:bulletId' },
  orderBullets: { method: 'PUT', path: '/resume/:section/:id/bullets/order' },
} as const;

/** The sections whose items carry bullets. */
export type BulletSection = Extract<ResumeSection, 'experiences' | 'projects'>;

/** What a create sends, by section. */
export interface CreateItemBodies {
  experiences: CreateExperienceRequest;
  projects: CreateProjectRequest;
  educations: CreateEducationRequest;
  certifications: CreateCertificationRequest;
  languages: CreateLanguageRequest;
}

/** What an edit sends, by section: only the fields that changed. */
export interface UpdateItemBodies {
  experiences: UpdateExperienceRequest;
  projects: UpdateProjectRequest;
  educations: UpdateEducationRequest;
  certifications: UpdateCertificationRequest;
  languages: UpdateLanguageRequest;
}

/** What the api answers to a create or an edit, by section: the item without its bullets (AD-028). */
export interface ItemOf {
  experiences: ExperienceItem;
  projects: ProjectItem;
  educations: Education;
  certifications: Certification;
  languages: Language;
}
export type ResumeItem = ItemOf[ResumeSection];

const itemSchemas = {
  experiences: experienceSchema,
  projects: projectSchema,
  educations: educationSchema,
  certifications: certificationSchema,
  languages: languageSchema,
} as const;

const id = (value: string) => encodeURIComponent(value);

/** `GET /resume`: the whole master resume, the profile empty when nothing was saved yet (RES-01, RES-02). */
export function loadResume(context: ApiRequestContext, options = {}): Promise<Outcome<MasterResume>> {
  return callApi({ method: 'GET', path: '/resume' }, context, options).then((result) =>
    parsed(result, masterResumeSchema),
  );
}

/** `GET /resume/summary`: only whether the home may show step 02 as done (RES-86). */
export function loadResumeSummary(context: ApiRequestContext, options = {}): Promise<Outcome<ResumeSummary>> {
  return callApi({ method: 'GET', path: '/resume/summary' }, context, options).then((result) =>
    parsed(result, resumeSummarySchema),
  );
}

/** `PUT /resume/profile`: the whole profile, answering with the saved one (RES-03). */
export function putProfile(
  body: SaveProfileRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<Profile>> {
  return callApi({ method: 'PUT', path: '/resume/profile', body }, context, options).then((result) =>
    parsed(result, profileSchema),
  );
}

/** `POST /resume/:section`: a new item at the top of the section, answering `201` with the item (RES-07). */
export function postResumeItem<S extends ResumeSection>(
  section: S,
  body: CreateItemBodies[S],
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ItemOf[S]>> {
  return callApi({ method: 'POST', path: `/resume/${section}`, body }, context, options).then((result) =>
    parsed(result, itemSchemas[section] as unknown as z.ZodType<ItemOf[S]>),
  );
}

/** `PATCH /resume/:section/:id`: only the fields sent (RES-08). */
export function patchResumeItem<S extends ResumeSection>(
  section: S,
  itemId: string,
  body: UpdateItemBodies[S],
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ItemOf[S]>> {
  return callApi({ method: 'PATCH', path: `/resume/${section}/${id(itemId)}`, body }, context, options).then((result) =>
    parsed(result, itemSchemas[section] as unknown as z.ZodType<ItemOf[S]>),
  );
}

/** `DELETE /resume/:section/:id`: the item, and its bullets with it; the api answers `204` (RES-09, RES-10). */
export function removeResumeItem(
  section: ResumeSection,
  itemId: string,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<undefined>> {
  return callApi({ method: 'DELETE', path: `/resume/${section}/${id(itemId)}` }, context, options).then(accepted);
}

/** `PUT /resume/:section/order`: every id of the section, in the order to keep; answers `{ ids }` (RES-25). */
export function putItemsOrder(
  section: ResumeSection,
  ids: string[],
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<OrderResponse>> {
  return callApi({ method: 'PUT', path: `/resume/${section}/order`, body: { ids } }, context, options).then(
    (result) => parsed(result, orderResponseSchema),
  );
}

/** `POST /resume/:section/:id/bullets`: a bullet at the end of the item, answering `201` with `{ bullet, skills }` (RES-15). */
export function postBullet(
  section: BulletSection,
  itemId: string,
  body: CreateBulletRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<BulletResponse>> {
  return callApi({ method: 'POST', path: `/resume/${section}/${id(itemId)}/bullets`, body }, context, options).then(
    (result) => parsed(result, bulletResponseSchema),
  );
}

/** `PATCH /resume/:section/:id/bullets/:bulletId`: the text, the skills or both (RES-16). */
export function patchBullet(
  section: BulletSection,
  itemId: string,
  bulletId: string,
  body: UpdateBulletRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<BulletResponse>> {
  return callApi(
    { method: 'PATCH', path: `/resume/${section}/${id(itemId)}/bullets/${id(bulletId)}`, body },
    context,
    options,
  ).then((result) => parsed(result, bulletResponseSchema));
}

/** `DELETE /resume/:section/:id/bullets/:bulletId`: the api answers `204` (RES-17). */
export function removeBullet(
  section: BulletSection,
  itemId: string,
  bulletId: string,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<undefined>> {
  return callApi(
    { method: 'DELETE', path: `/resume/${section}/${id(itemId)}/bullets/${id(bulletId)}` },
    context,
    options,
  ).then(accepted);
}

/** `PUT /resume/:section/:id/bullets/order`: every bullet of the item, in the order to keep; answers `{ ids }` (RES-26). */
export function putBulletsOrder(
  section: BulletSection,
  itemId: string,
  ids: string[],
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<OrderResponse>> {
  return callApi(
    { method: 'PUT', path: `/resume/${section}/${id(itemId)}/bullets/order`, body: { ids } },
    context,
    options,
  ).then((result) => parsed(result, orderResponseSchema));
}

// One server function per endpoint (AD-007), each validating its input against the contract so the
// browser cannot send what the api would not read. The ones that mutate are POST for the Start CSRF check.

const itemIdSchema = z.string().min(1);
const bulletSectionSchema = z.enum(['experiences', 'projects']);

/** The section and the body of a create, the body checked by the schema of that section. */
function createInput(input: { section: ResumeSection; body: unknown }) {
  const section = resumeSectionSchema.parse(input.section);
  const body = (createItemRequestSchemas[section] as z.ZodType).parse(input.body);
  return { section, body };
}

function updateInput(input: { section: ResumeSection; id: string; body: unknown }) {
  const section = resumeSectionSchema.parse(input.section);
  const body = (updateItemRequestSchemas[section] as z.ZodType).parse(input.body);
  return { section, id: itemIdSchema.parse(input.id), body };
}

export const getResume = createServerFn({ method: 'GET' }).handler(
  (): Promise<Outcome<MasterResume>> => loadResume(contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
);

export const getResumeSummary = createServerFn({ method: 'GET' }).handler(
  (): Promise<Outcome<ResumeSummary>> =>
    loadResumeSummary(contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
);

export const saveProfile = createServerFn({ method: 'POST' })
  .validator((input: SaveProfileRequest) => saveProfileRequestSchema.parse(input))
  .handler(({ data }): Promise<Outcome<Profile>> =>
    putProfile(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const createResumeItem = createServerFn({ method: 'POST' })
  .validator((input: { section: ResumeSection; body: unknown }) => createInput(input))
  .handler(({ data }): Promise<Outcome<ResumeItem>> =>
    postResumeItem(
      data.section,
      data.body as CreateItemBodies[ResumeSection],
      contextOfCurrentRequest(),
      responseOptionsOfCurrentRequest(),
    ),
  );

export const updateResumeItem = createServerFn({ method: 'POST' })
  .validator((input: { section: ResumeSection; id: string; body: unknown }) => updateInput(input))
  .handler(({ data }): Promise<Outcome<ResumeItem>> =>
    patchResumeItem(
      data.section,
      data.id,
      data.body as UpdateItemBodies[ResumeSection],
      contextOfCurrentRequest(),
      responseOptionsOfCurrentRequest(),
    ),
  );

export const deleteResumeItem = createServerFn({ method: 'POST' })
  .validator((input: { section: ResumeSection; id: string }) =>
    z.object({ section: resumeSectionSchema, id: itemIdSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<undefined>> =>
    removeResumeItem(data.section, data.id, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const orderResumeItems = createServerFn({ method: 'POST' })
  .validator((input: { section: ResumeSection; ids: string[] }) =>
    z.object({ section: resumeSectionSchema, ids: orderRequestSchema.shape.ids }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<OrderResponse>> =>
    putItemsOrder(data.section, data.ids, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const createBullet = createServerFn({ method: 'POST' })
  .validator((input: { section: BulletSection; id: string; body: CreateBulletRequest }) =>
    z.object({ section: bulletSectionSchema, id: itemIdSchema, body: createBulletRequestSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<BulletResponse>> =>
    postBullet(data.section, data.id, data.body, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const updateBullet = createServerFn({ method: 'POST' })
  .validator((input: { section: BulletSection; id: string; bulletId: string; body: UpdateBulletRequest }) =>
    z
      .object({ section: bulletSectionSchema, id: itemIdSchema, bulletId: itemIdSchema, body: updateBulletRequestSchema })
      .parse(input),
  )
  .handler(({ data }): Promise<Outcome<BulletResponse>> =>
    patchBullet(
      data.section,
      data.id,
      data.bulletId,
      data.body,
      contextOfCurrentRequest(),
      responseOptionsOfCurrentRequest(),
    ),
  );

export const deleteBullet = createServerFn({ method: 'POST' })
  .validator((input: { section: BulletSection; id: string; bulletId: string }) =>
    z.object({ section: bulletSectionSchema, id: itemIdSchema, bulletId: itemIdSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<undefined>> =>
    removeBullet(data.section, data.id, data.bulletId, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const orderBullets = createServerFn({ method: 'POST' })
  .validator((input: { section: BulletSection; id: string; ids: string[] }) =>
    z.object({ section: bulletSectionSchema, id: itemIdSchema, ids: orderRequestSchema.shape.ids }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<OrderResponse>> =>
    putBulletsOrder(data.section, data.id, data.ids, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

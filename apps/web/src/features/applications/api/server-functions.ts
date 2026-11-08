import type {
  ApplicationDetail,
  ApplicationEvent,
  ApplicationsCount,
  ApplicationsPage,
  ChangeStatusRequest,
  CreateApplicationRequest,
  CreateEventRequest,
  ReplaceSkillsRequest,
  UpdateJobPostingRequest,
} from '@am/contracts';
import {
  applicationDetailSchema,
  applicationEventSchema,
  applicationsCountSchema,
  applicationsPageSchema,
  changeStatusRequestSchema,
  createApplicationRequestSchema,
  createEventRequestSchema,
  listApplicationsQuerySchema,
  replaceSkillsRequestSchema,
  updateJobPostingRequestSchema,
} from '@am/contracts';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { accepted, contextOfCurrentRequest, parsed, responseOptionsOfCurrentRequest, type Outcome } from '../../../lib/bff';
import { callApi, type ApiRequestContext } from '../../../lib/call-api';

/**
 * The ten endpoints the browser reaches for applications (AD-007), one server function each. The pure
 * functions below are what the tests drive; the `createServerFn` ones at the end only add the input check.
 */
export const APPLICATIONS_ENDPOINTS = {
  createApplication: { method: 'POST', path: '/applications' },
  listApplications: { method: 'GET', path: '/applications' },
  countApplications: { method: 'GET', path: '/applications/count' },
  getApplication: { method: 'GET', path: '/applications/:id' },
  updateJobPosting: { method: 'PATCH', path: '/applications/:id/job-posting' },
  replaceSkills: { method: 'PUT', path: '/applications/:id/skills' },
  changeStatus: { method: 'POST', path: '/applications/:id/status' },
  addEvent: { method: 'POST', path: '/applications/:id/events' },
  snoozeGhost: { method: 'POST', path: '/applications/:id/ghost-snooze' },
  deleteApplication: { method: 'DELETE', path: '/applications/:id' },
} as const;

/**
 * What a screen may ask of the list, in the shape the contract reads from the query string: `status`,
 * `level` and `workModel` are comma separated. `tab` and `sort` fall back to the api defaults when left out.
 */
export type ListApplicationsInput = z.input<typeof listApplicationsQuerySchema>;

const id = (value: string) => encodeURIComponent(value);

/** `POST /applications`: registers the posting and the application, answering `201` with the detail (APP-01..APP-06). */
export function postApplication(
  body: CreateApplicationRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ApplicationDetail>> {
  return callApi({ method: 'POST', path: '/applications', body }, context, options).then((result) =>
    parsed(result, applicationDetailSchema),
  );
}

/** `GET /applications`: one page grouped and counted by the api (APP-09..APP-17). */
export function loadApplications(
  input: ListApplicationsInput,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ApplicationsPage>> {
  const query = new URLSearchParams();
  if (input.tab !== undefined) query.set('tab', input.tab);
  if (input.status !== undefined) query.set('status', input.status);
  if (input.level !== undefined) query.set('level', input.level);
  if (input.workModel !== undefined) query.set('workModel', input.workModel);
  if (input.q !== undefined) query.set('q', input.q);
  if (input.sort !== undefined) query.set('sort', input.sort);
  if (input.cursor !== undefined) query.set('cursor', input.cursor);
  const text = query.toString();
  const path = `${APPLICATIONS_ENDPOINTS.listApplications.path}${text === '' ? '' : `?${text}`}`;
  return callApi({ method: 'GET', path }, context, options).then((result) => parsed(result, applicationsPageSchema));
}

/** `GET /applications/count`: the total the sidebar and the home show (APP-43, APP-84). */
export function loadApplicationsCount(context: ApiRequestContext, options = {}): Promise<Outcome<ApplicationsCount>> {
  return callApi({ method: 'GET', path: '/applications/count' }, context, options).then((result) =>
    parsed(result, applicationsCountSchema),
  );
}

/** `GET /applications/:id`: the detail with skills and the timeline (APP-18, APP-19). */
export function loadApplication(
  applicationId: string,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ApplicationDetail>> {
  return callApi({ method: 'GET', path: `/applications/${id(applicationId)}` }, context, options).then((result) =>
    parsed(result, applicationDetailSchema),
  );
}

/** `PATCH /applications/:id/job-posting`: some fields of the posting; `null` clears an optional one (APP-28, APP-29, APP-31). */
export function patchJobPosting(
  applicationId: string,
  body: UpdateJobPostingRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ApplicationDetail>> {
  return callApi(
    { method: 'PATCH', path: `/applications/${id(applicationId)}/job-posting`, body },
    context,
    options,
  ).then((result) => parsed(result, applicationDetailSchema));
}

/** `PUT /applications/:id/skills`: the whole list of skills, in the order to keep (APP-30). */
export function putSkills(
  applicationId: string,
  body: ReplaceSkillsRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ApplicationDetail>> {
  return callApi({ method: 'PUT', path: `/applications/${id(applicationId)}/skills`, body }, context, options).then(
    (result) => parsed(result, applicationDetailSchema),
  );
}

/** `POST /applications/:id/status`: a new status, or the same one with no event (APP-20..APP-22, APP-27). */
export function postStatus(
  applicationId: string,
  body: ChangeStatusRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ApplicationDetail>> {
  return callApi({ method: 'POST', path: `/applications/${id(applicationId)}/status`, body }, context, options).then(
    (result) => parsed(result, applicationDetailSchema),
  );
}

/** `POST /applications/:id/events`: a stage or a note, answering `201` with the event (APP-23..APP-25). */
export function postEvent(
  applicationId: string,
  body: CreateEventRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ApplicationEvent>> {
  return callApi({ method: 'POST', path: `/applications/${id(applicationId)}/events`, body }, context, options).then(
    (result) => parsed(result, applicationEventSchema),
  );
}

/** `POST /applications/:id/ghost-snooze`: "Ainda não", the suggestion rests for 21 days (APP-35, AD-020). */
export function postGhostSnooze(
  applicationId: string,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<ApplicationDetail>> {
  return callApi({ method: 'POST', path: `/applications/${id(applicationId)}/ghost-snooze` }, context, options).then(
    (result) => parsed(result, applicationDetailSchema),
  );
}

/** `DELETE /applications/:id`: the application, its posting, skills and events are gone; the api answers `204` (APP-36). */
export function removeApplicationById(
  applicationId: string,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<undefined>> {
  return callApi({ method: 'DELETE', path: `/applications/${id(applicationId)}` }, context, options).then(accepted);
}

// One server function per endpoint (AD-007), each validating its input against the contract so the
// browser cannot send what the api would not read.

const applicationIdSchema = z.string().min(1);

export const createApplication = createServerFn({ method: 'POST' })
  .validator((input: CreateApplicationRequest) => createApplicationRequestSchema.parse(input))
  .handler(({ data }): Promise<Outcome<ApplicationDetail>> =>
    postApplication(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const listApplications = createServerFn({ method: 'GET' })
  .validator((input: ListApplicationsInput) => {
    listApplicationsQuerySchema.parse(input);
    return input;
  })
  .handler(({ data }): Promise<Outcome<ApplicationsPage>> =>
    loadApplications(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const countApplications = createServerFn({ method: 'GET' }).handler(
  (): Promise<Outcome<ApplicationsCount>> =>
    loadApplicationsCount(contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
);

export const getApplication = createServerFn({ method: 'GET' })
  .validator((applicationId: string) => applicationIdSchema.parse(applicationId))
  .handler(({ data }): Promise<Outcome<ApplicationDetail>> =>
    loadApplication(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const updateJobPosting = createServerFn({ method: 'POST' })
  .validator((input: { id: string; body: UpdateJobPostingRequest }) =>
    z.object({ id: applicationIdSchema, body: updateJobPostingRequestSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<ApplicationDetail>> =>
    patchJobPosting(data.id, data.body, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const replaceSkills = createServerFn({ method: 'POST' })
  .validator((input: { id: string; body: ReplaceSkillsRequest }) =>
    z.object({ id: applicationIdSchema, body: replaceSkillsRequestSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<ApplicationDetail>> =>
    putSkills(data.id, data.body, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const changeStatus = createServerFn({ method: 'POST' })
  .validator((input: { id: string; body: ChangeStatusRequest }) =>
    z.object({ id: applicationIdSchema, body: changeStatusRequestSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<ApplicationDetail>> =>
    postStatus(data.id, data.body, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const addEvent = createServerFn({ method: 'POST' })
  .validator((input: { id: string; body: CreateEventRequest }) =>
    z.object({ id: applicationIdSchema, body: createEventRequestSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<ApplicationEvent>> =>
    postEvent(data.id, data.body, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const snoozeGhost = createServerFn({ method: 'POST' })
  .validator((applicationId: string) => applicationIdSchema.parse(applicationId))
  .handler(({ data }): Promise<Outcome<ApplicationDetail>> =>
    postGhostSnooze(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const deleteApplication = createServerFn({ method: 'POST' })
  .validator((applicationId: string) => applicationIdSchema.parse(applicationId))
  .handler(({ data }): Promise<Outcome<undefined>> =>
    removeApplicationById(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

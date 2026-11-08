import type { AdminSkillsPage, Alias, AliasRequest, Skill, UpdateSkillRequest } from '@am/contracts';
import {
  adminSkillsQuerySchema,
  adminSkillsPageSchema,
  aliasRequestSchema,
  aliasSchema,
  skillSchema,
  updateSkillRequestSchema,
} from '@am/contracts';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { accepted, contextOfCurrentRequest, parsed, responseOptionsOfCurrentRequest, type Outcome } from '../../../lib/bff';
import { callApi, type ApiRequestContext } from '../../../lib/call-api';

/**
 * The only endpoints the browser reaches for skills (SKL-54, AD-007). `GET /skills` and `POST /skills`
 * are the member's and have no function here: they get one with the slice that uses them.
 */
export const ADMIN_SKILLS_ENDPOINTS = {
  listAdminSkills: { method: 'GET', path: '/admin/skills' },
  promoteSkill: { method: 'POST', path: '/skills/:id/promote' },
  updateSkill: { method: 'PATCH', path: '/skills/:id' },
  addSkillAlias: { method: 'POST', path: '/skills/:id/aliases' },
  updateSkillAlias: { method: 'PATCH', path: '/skills/:id/aliases/:aliasId' },
  removeSkillAlias: { method: 'DELETE', path: '/skills/:id/aliases/:aliasId' },
} as const;

/** What a screen may ask of the catalog; `scope` is `all` when left out. */
export type ListAdminSkillsInput = z.input<typeof adminSkillsQuerySchema>;

const id = (value: string) => encodeURIComponent(value);

/** `GET /admin/skills`: one page of the catalog and the counts, filtered and ordered by the api (SKL-33..SKL-37). */
export function loadAdminSkills(
  input: ListAdminSkillsInput,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<AdminSkillsPage>> {
  const query = new URLSearchParams();
  if (input.scope !== undefined) query.set('scope', input.scope);
  if (input.category !== undefined) query.set('category', input.category);
  if (input.q !== undefined) query.set('q', input.q);
  if (input.cursor !== undefined) query.set('cursor', input.cursor);
  const text = query.toString();
  const path = `${ADMIN_SKILLS_ENDPOINTS.listAdminSkills.path}${text === '' ? '' : `?${text}`}`;
  return callApi({ method: 'GET', path }, context, options).then((result) => parsed(result, adminSkillsPageSchema));
}

/** `POST /skills/:id/promote`: a private skill becomes global with the same id, or the api says why not (SKL-17..SKL-21). */
export function promoteSkillById(skillId: string, context: ApiRequestContext, options = {}): Promise<Outcome<Skill>> {
  return callApi({ method: 'POST', path: `/skills/${id(skillId)}/promote` }, context, options).then((result) =>
    parsed(result, skillSchema),
  );
}

/** `PATCH /skills/:id`: name and category of a global skill (SKL-62..SKL-66). */
export function patchSkill(
  skillId: string,
  body: UpdateSkillRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<Skill>> {
  return callApi({ method: 'PATCH', path: `/skills/${id(skillId)}`, body }, context, options).then((result) =>
    parsed(result, skillSchema),
  );
}

/** `POST /skills/:id/aliases`: `201` for a new alias and `200` for the one the skill already had (SKL-26..SKL-31). */
export function createSkillAlias(
  skillId: string,
  body: AliasRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<Alias>> {
  return callApi({ method: 'POST', path: `/skills/${id(skillId)}/aliases`, body }, context, options).then((result) =>
    parsed(result, aliasSchema),
  );
}

/** `PATCH /skills/:id/aliases/:aliasId`: the text of one alias (SKL-67). */
export function patchSkillAlias(
  skillId: string,
  aliasId: string,
  body: AliasRequest,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<Alias>> {
  return callApi(
    { method: 'PATCH', path: `/skills/${id(skillId)}/aliases/${id(aliasId)}`, body },
    context,
    options,
  ).then((result) => parsed(result, aliasSchema));
}

/** `DELETE /skills/:id/aliases/:aliasId`: the alias is gone and the api answers `204` (SKL-69). */
export function deleteSkillAlias(
  skillId: string,
  aliasId: string,
  context: ApiRequestContext,
  options = {},
): Promise<Outcome<undefined>> {
  return callApi(
    { method: 'DELETE', path: `/skills/${id(skillId)}/aliases/${id(aliasId)}` },
    context,
    options,
  ).then(accepted);
}

// One server function per admin endpoint (AD-007), each validating its input against the contract so
// the browser cannot send what the api would not read. The pure functions above are what the tests drive.

const skillIdSchema = z.string().min(1);

export const listAdminSkills = createServerFn({ method: 'GET' })
  .validator((input: ListAdminSkillsInput) => adminSkillsQuerySchema.parse(input))
  .handler(({ data }): Promise<Outcome<AdminSkillsPage>> =>
    loadAdminSkills(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const promoteSkill = createServerFn({ method: 'POST' })
  .validator((skillId: string) => skillIdSchema.parse(skillId))
  .handler(({ data }): Promise<Outcome<Skill>> =>
    promoteSkillById(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const updateSkill = createServerFn({ method: 'POST' })
  .validator((input: { id: string; body: UpdateSkillRequest }) =>
    z.object({ id: skillIdSchema, body: updateSkillRequestSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<Skill>> =>
    patchSkill(data.id, data.body, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const addSkillAlias = createServerFn({ method: 'POST' })
  .validator((input: { id: string; body: AliasRequest }) =>
    z.object({ id: skillIdSchema, body: aliasRequestSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<Alias>> =>
    createSkillAlias(data.id, data.body, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const updateSkillAlias = createServerFn({ method: 'POST' })
  .validator((input: { id: string; aliasId: string; body: AliasRequest }) =>
    z.object({ id: skillIdSchema, aliasId: skillIdSchema, body: aliasRequestSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<Alias>> =>
    patchSkillAlias(data.id, data.aliasId, data.body, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const removeSkillAlias = createServerFn({ method: 'POST' })
  .validator((input: { id: string; aliasId: string }) =>
    z.object({ id: skillIdSchema, aliasId: skillIdSchema }).parse(input),
  )
  .handler(({ data }): Promise<Outcome<undefined>> =>
    deleteSkillAlias(data.id, data.aliasId, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

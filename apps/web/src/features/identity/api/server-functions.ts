import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  CreateInvitationResponse,
  InvitationDetails,
  InvitationsPage,
  LoginRequest,
  MeResponse,
  ProblemDetails,
} from '@am/contracts';
import {
  createInvitationResponseSchema,
  invitationDetailsSchema,
  invitationsPageSchema,
  meResponseSchema,
} from '@am/contracts';
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import { appendResponseHeader, getRequestHeader, getRequestIP } from '@tanstack/react-start/server';
import type { z } from 'zod';
import {
  apiContextOf,
  callApi,
  type ApiRequestContext,
  type ApiResult,
  type CallApiOptions,
} from '../../../lib/call-api';
import { loadServerEnv } from '../../../lib/env';

/** The failed half of every answer; the shape `problemMessage` reads (UI-03, UI-04, UI-05). */
export interface ApiFailure {
  ok: false;
  status: number;
  problem?: ProblemDetails;
  retryAfterSeconds?: number;
}

/** An answer with the body already checked against its contract, so a screen never reads raw json. */
export type Outcome<T> = { ok: true; data: T } | ApiFailure;

/**
 * What a route guard asks before it renders: the session user, the fact that there is none, or the
 * fact that the api did not answer and the screen must say so without sending anyone to login (UI-05).
 */
export type SessionState =
  | { kind: 'authenticated'; user: MeResponse }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' };

/** A `2xx` whose body is not the contract is as unusable as no answer at all, so it becomes `503`. */
function failed(result: Exclude<ApiResult, { ok: true }>): ApiFailure {
  if (!('problem' in result)) return { ok: false, status: 503 };
  return {
    ok: false,
    status: result.status,
    problem: result.problem,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

function parsed<T>(result: ApiResult, schema: z.ZodType<T>): Outcome<T> {
  if (!result.ok) return failed(result);
  const data = schema.safeParse(result.data);
  return data.success ? { ok: true, data: data.data } : { ok: false, status: 503 };
}

/** A `2xx` without a body (the `204` of login and logout) or with one the screen does not read. */
function accepted(result: ApiResult): Outcome<undefined> {
  return result.ok ? { ok: true, data: undefined } : failed(result);
}

/** `GET /auth/me` as the guard needs it: a user, no user, or an api that did not answer (UI-06, UI-07). */
export function loadSession(context: ApiRequestContext, options = {}): Promise<SessionState> {
  return callApi({ method: 'GET', path: '/auth/me' }, context, options).then((result) => {
    if (result.status === 401 && !result.ok) return { kind: 'anonymous' } as const;
    const outcome = parsed(result, meResponseSchema);
    return outcome.ok ? ({ kind: 'authenticated', user: outcome.data } as const) : ({ kind: 'unavailable' } as const);
  });
}

/** `POST /auth/login`: the member entrance, which only answers `204` and the cookie (AUTH-01). */
export function loginMember(input: LoginRequest, context: ApiRequestContext, options = {}) {
  return callApi({ method: 'POST', path: '/auth/login', body: input }, context, options).then(accepted);
}

/** `POST /auth/admin/login`: the admin entrance (AUTH-02). */
export function loginAdmin(input: LoginRequest, context: ApiRequestContext, options = {}) {
  return callApi({ method: 'POST', path: '/auth/admin/login', body: input }, context, options).then(accepted);
}

/** `POST /auth/logout`: the api revokes the session and clears the cookie, whether or not one exists (AUTH-12). */
export function logout(context: ApiRequestContext, options = {}): Promise<Outcome<undefined>> {
  return callApi({ method: 'POST', path: '/auth/logout' }, context, options).then(accepted);
}

/** `POST /invitations`: only an admin, and the link comes back once (INV-01, INV-03). */
export function createInvitation(input: CreateInvitationRequest, context: ApiRequestContext, options = {}) {
  return callApi({ method: 'POST', path: '/invitations', body: input }, context, options).then((result) =>
    parsed(result, createInvitationResponseSchema),
  );
}

/** `GET /invitations/:token`: what the invite page shows while the link is good (INV-05, INV-06). */
export function loadInvitation(token: string, context: ApiRequestContext, options = {}) {
  return callApi({ method: 'GET', path: `/invitations/${encodeURIComponent(token)}` }, context, options).then((result) =>
    parsed(result, invitationDetailsSchema),
  );
}

/** `POST /invitations/:token/accept`: the account is created and the session starts in one transaction (INV-07). */
export function acceptInvitation(input: AcceptInvitationRequest, token: string, context: ApiRequestContext, options = {}) {
  return callApi(
    { method: 'POST', path: `/invitations/${encodeURIComponent(token)}/accept`, body: input },
    context,
    options,
  ).then(accepted);
}

/** `GET /invitations`: the pending invitations of a page plus the total, both decided by the api (ADM-01). */
export function loadInvitations(cursor: string | undefined, context: ApiRequestContext, options = {}) {
  const query = cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`;
  return callApi({ method: 'GET', path: `/invitations${query}` }, context, options).then((result) =>
    parsed(result, invitationsPageSchema),
  );
}

/** `DELETE /invitations/:id`: a pending invitation becomes revoked, or the api says it is gone (ADM-02, ADM-03). */
export function revokeInvitation(id: string, context: ApiRequestContext, options = {}) {
  return callApi({ method: 'DELETE', path: `/invitations/${encodeURIComponent(id)}` }, context, options).then(accepted);
}

/**
 * What the BFF forwards from the browser: the cookie, the request id and the address the lockout counts.
 * Everything else about the caller is decided by the api (AD-005).
 */
export const contextOfCurrentRequest = createServerOnlyFn((): ApiRequestContext => {
  const env = loadServerEnv();
  return apiContextOf(
    env.apiInternalUrl,
    { header: (name) => getRequestHeader(name), socketAddress: getRequestIP() },
    env.clientIpHeader,
  );
});

/**
 * The one link between the api answer and the browser response: every `Set-Cookie` the api sends
 * becomes a header of the server function answer, one header per cookie, so login, the invitation
 * accept, logout and the renewal riding on `/auth/me` all reach the browser (AUTH-07, AUTH-11, UI-13).
 */
export const responseOptionsOfCurrentRequest = createServerOnlyFn((): CallApiOptions => ({
  appendSetCookie: (value) => appendResponseHeader('set-cookie', value),
}));

// One server function per endpoint (AD-007): the browser can only reach what has a function here, and
// each one forwards method, path and body, with no rule of its own. The pure functions above carry the
// answers and are what the tests drive; these only bind them to the request being served.

export const getSession = createServerFn({ method: 'GET' }).handler((): Promise<SessionState> =>
  loadSession(contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
);

export const memberLogin = createServerFn({ method: 'POST' })
  .validator((input: LoginRequest) => input)
  .handler(({ data }): Promise<Outcome<undefined>> =>
    loginMember(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const adminLogin = createServerFn({ method: 'POST' })
  .validator((input: LoginRequest) => input)
  .handler(({ data }): Promise<Outcome<undefined>> =>
    loginAdmin(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const endSession = createServerFn({ method: 'POST' }).handler((): Promise<Outcome<undefined>> =>
  logout(contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
);

export const invite = createServerFn({ method: 'POST' })
  .validator((input: CreateInvitationRequest) => input)
  .handler(async ({ data }): Promise<Outcome<CreateInvitationResponse>> =>
    createInvitation(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const openInvitation = createServerFn({ method: 'POST' })
  .validator((token: string) => token)
  .handler(({ data }): Promise<Outcome<InvitationDetails>> =>
    loadInvitation(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const joinWithInvitation = createServerFn({ method: 'POST' })
  .validator((input: { token: string; name: string; password: string }) => input)
  .handler(({ data }): Promise<Outcome<undefined>> =>
    acceptInvitation(
      { name: data.name, password: data.password },
      data.token,
      contextOfCurrentRequest(),
      responseOptionsOfCurrentRequest(),
    ),
  );

export const pendingInvitations = createServerFn({ method: 'GET' })
  .validator((cursor: string | undefined) => cursor)
  .handler(({ data }): Promise<Outcome<InvitationsPage>> =>
    loadInvitations(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );

export const revoke = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(({ data }): Promise<Outcome<undefined>> =>
    revokeInvitation(data, contextOfCurrentRequest(), responseOptionsOfCurrentRequest()),
  );


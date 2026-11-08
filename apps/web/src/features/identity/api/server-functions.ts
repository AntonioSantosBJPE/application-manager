import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  CreateInvitationResponse,
  InvitationDetails,
  InvitationsPage,
  LoginRequest,
  MeResponse,
} from '@am/contracts';
import {
  createInvitationResponseSchema,
  invitationDetailsSchema,
  invitationsPageSchema,
  meResponseSchema,
} from '@am/contracts';
import { createServerFn } from '@tanstack/react-start';
import {
  accepted,
  contextOfCurrentRequest,
  parsed,
  responseOptionsOfCurrentRequest,
  type ApiFailure,
  type Outcome,
} from '../../../lib/bff';
import { callApi, type ApiRequestContext } from '../../../lib/call-api';

// The tests and the other files of this feature reach the helpers through here (AD-016).
export { contextOfCurrentRequest, responseOptionsOfCurrentRequest };
export type { ApiFailure, Outcome };

/**
 * What a route guard asks before it renders: the session user, the fact that there is none, or the
 * fact that the api did not answer and the screen must say so without sending anyone to login (UI-05).
 */
export type SessionState =
  | { kind: 'authenticated'; user: MeResponse }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' };

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


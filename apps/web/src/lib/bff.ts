import type { ProblemDetails } from '@am/contracts';
import { createServerOnlyFn } from '@tanstack/react-start';
import { appendResponseHeader, getRequestHeader, getRequestIP } from '@tanstack/react-start/server';
import type { z } from 'zod';
import { apiContextOf, type ApiRequestContext, type ApiResult, type CallApiOptions } from './call-api';
import { loadServerEnv } from './env';

/** The failed half of every answer; the shape `problemMessage` reads (UI-03, UI-04, UI-05). */
export interface ApiFailure {
  ok: false;
  status: number;
  problem?: ProblemDetails;
  retryAfterSeconds?: number;
}

/** An answer with the body already checked against its contract, so a screen never reads raw json. */
export type Outcome<T> = { ok: true; data: T } | ApiFailure;

/** A `2xx` whose body is not the contract is as unusable as no answer at all, so it becomes `503`. */
export function failed(result: Exclude<ApiResult, { ok: true }>): ApiFailure {
  if (!('problem' in result)) return { ok: false, status: 503 };
  return {
    ok: false,
    status: result.status,
    problem: result.problem,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

export function parsed<T>(result: ApiResult, schema: z.ZodType<T>): Outcome<T> {
  if (!result.ok) return failed(result);
  const data = schema.safeParse(result.data);
  return data.success ? { ok: true, data: data.data } : { ok: false, status: 503 };
}

/** A `2xx` without a body (the `204` of login and logout) or with one the screen does not read. */
export function accepted(result: ApiResult): Outcome<undefined> {
  return result.ok ? { ok: true, data: undefined } : failed(result);
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

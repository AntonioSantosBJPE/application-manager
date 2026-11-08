import type { ProblemDetails } from '@am/contracts';
import { problemDetailsSchema } from '@am/contracts';
import { clientIpOf, type BrowserRequest } from './client-ip';
import { resolveRequestId } from './request-id';

/** How long the BFF waits for the api before treating it as down: the same 3 seconds the status page uses (UI-05). */
export const API_TIMEOUT_MS = 3000;

/** The header the api counts a login attempt by; the browser never chooses its value (LOCK-09, LOCK-10). */
export const FORWARDED_IP_HEADER = 'x-am-client-ip';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A `2xx` answer; `data` is the parsed body, `undefined` when the api answered `204`. */
export interface ApiSuccess {
  ok: true;
  status: number;
  data: unknown;
}

/** An error the api described in RFC 9457; `retryAfterSeconds` is the `Retry-After` it sent (LOCK-03). */
export interface ApiProblem {
  ok: false;
  status: number;
  problem: ProblemDetails;
  retryAfterSeconds?: number;
}

/** No answer, no usable body or an unexpected failure: every screen shows the same unavailable message (UI-05). */
export interface ApiUnavailable {
  ok: false;
  status: 503;
}

export type ApiResult = ApiSuccess | ApiProblem | ApiUnavailable;

/** What a server function asks for: only the endpoint and, when it mutates, the body. */
export interface ApiRequest {
  method: ApiMethod;
  /** Path on the api, starting with `/`. */
  path: string;
  body?: unknown;
}

/** What the BFF forwards from the browser request, resolved before the call so the call itself stays pure. */
export interface ApiRequestContext {
  apiInternalUrl: string;
  requestId: string;
  cookie: string | undefined;
  clientIp: string | undefined;
}

export interface CallApiOptions {
  timeoutMs?: number;
  /** Receives one call per `Set-Cookie` the api sent, so every cookie reaches the browser (AUTH-07, UI-13). */
  appendSetCookie?: (value: string) => void;
}

/**
 * What the BFF forwards about the browser request: the request id the api logs (LOG-04), the session
 * cookie and the client address the lockout counts (LOCK-09). Nothing else of the browser is forwarded,
 * so the api sees the BFF as its only caller.
 */
export function apiContextOf(
  apiInternalUrl: string,
  request: BrowserRequest,
  configuredIpHeader: string | undefined,
): ApiRequestContext {
  return {
    apiInternalUrl,
    requestId: resolveRequestId(request.header('x-request-id')),
    cookie: request.header('cookie'),
    clientIp: clientIpOf(request, configuredIpHeader),
  };
}

/** `Retry-After` carries seconds in this api; any other form is not a wait a screen can show. */
function retryAfterSecondsOf(header: string | null): number | undefined {
  if (header === null) return undefined;
  const seconds = Number(header.trim());
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined;
}

/** Reads the body without throwing: an empty or malformed body is `undefined`, not a failed request. */
async function bodyOrUndefined(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Calls one api endpoint on behalf of the browser: forwards the session cookie, the request id and the
 * client address, replays every `Set-Cookie` and never throws. It carries no rule of its own; what an
 * answer means is the api's decision and the BFF only transports it. A timeout, a network failure or an
 * error without a Problem Details body becomes `503`, so every screen shows one message (UI-05).
 */
export async function callApi(
  request: ApiRequest,
  context: ApiRequestContext,
  options: CallApiOptions = {},
): Promise<ApiResult> {
  const { timeoutMs = API_TIMEOUT_MS, appendSetCookie } = options;
  const { apiInternalUrl, requestId, cookie, clientIp } = context;

  const headers = new Headers({ 'x-request-id': requestId });
  if (cookie !== undefined && cookie !== '') headers.set('cookie', cookie);
  if (clientIp !== undefined) headers.set(FORWARDED_IP_HEADER, clientIp);
  if (request.body !== undefined) headers.set('content-type', 'application/json');

  let response: Response;
  try {
    response = await fetch(new URL(request.path, apiInternalUrl), {
      method: request.method,
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, status: 503 };
  }

  // Before the body: a renewed session rides on the same answer the next request needs (AUTH-11), and a
  // logout clears the cookie on a `401` answer too.
  if (appendSetCookie !== undefined) {
    for (const setCookie of response.headers.getSetCookie()) appendSetCookie(setCookie);
  }

  const data = await bodyOrUndefined(response);
  if (response.ok) return { ok: true, status: response.status, data };

  const problem = problemDetailsSchema.safeParse(data);
  if (!problem.success) return { ok: false, status: 503 };
  const retryAfterSeconds = retryAfterSecondsOf(response.headers.get('retry-after'));
  return retryAfterSeconds === undefined
    ? { ok: false, status: response.status, problem: problem.data }
    : { ok: false, status: response.status, problem: problem.data, retryAfterSeconds };
}

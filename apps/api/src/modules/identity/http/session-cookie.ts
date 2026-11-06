import { parseCookie, stringifySetCookie } from 'cookie';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** 30 days, the sliding duration of a session, in the seconds `Max-Age` takes (AUTH-07). */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** How the cookie is written; `SESSION_COOKIE_SECURE=false` is the only setting that drops `Secure` (AUTH-08). */
export interface SessionCookieOptions {
  secure: boolean;
}

/** DI token of the cookie attributes of the running environment. */
export const SESSION_COOKIE_OPTIONS = Symbol('SESSION_COOKIE_OPTIONS');

/**
 * The `__Host-` prefix locks the cookie to this exact host, so it is only valid with `Secure`,
 * `Path=/` and no `Domain`; local development over http uses the plain name instead (AUTH-08).
 */
export function sessionCookieName(options: SessionCookieOptions): string {
  return options.secure ? '__Host-am_session' : 'am_session';
}

/**
 * The opaque session token of the request, or undefined when the browser sent none. Only the cookie
 * name of the running mode is read, so a plain `am_session` planted by a sibling host never counts under `__Host-`.
 */
export function readSessionToken(request: IncomingMessage, options: SessionCookieOptions): string | undefined {
  const header = request.headers.cookie;
  if (header === undefined) return undefined;
  const cookies = parseCookie(header);
  const token = cookies[sessionCookieName(options)];
  return token === undefined || token === '' ? undefined : token;
}

/** Writes the session cookie: `HttpOnly`, `SameSite=Lax`, `Path=/` and no `Domain` (AUTH-07). */
export function setSessionCookie(response: ServerResponse, token: string, options: SessionCookieOptions): void {
  response.appendHeader(
    'set-cookie',
    stringifySetCookie({
      name: sessionCookieName(options),
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      secure: options.secure,
    }),
  );
}

/** Ends the cookie in the browser; the same attributes, so the deletion matches the original (AUTH-12). */
export function clearSessionCookie(response: ServerResponse, options: SessionCookieOptions): void {
  response.appendHeader(
    'set-cookie',
    stringifySetCookie({
      name: sessionCookieName(options),
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      secure: options.secure,
    }),
  );
}

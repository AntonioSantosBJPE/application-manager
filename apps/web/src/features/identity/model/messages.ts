import type { ProblemDetails } from '@am/contracts';

/** The copy the spec fixes, so no screen invents its own wording (UI-03, UI-04, UI-05, UI-08, UI-16). */
export const MESSAGES = {
  invalidCredentials: 'E-mail ou senha incorretos.',
  unavailable: 'Serviço indisponível. Tente novamente em instantes.',
  sessionExpired: 'Sua sessão expirou. Entre novamente.',
  noAccess: 'Você não tem acesso a esta área.',
  invitationInvalid: 'Este convite não é mais válido. Peça um novo ao administrador.',
} as const;

/** Minutes the `429` asks the person to wait, rounded up, so a wait of a second still says one minute (UI-04). */
export function minutesFromRetryAfter(retryAfterSeconds: number): number {
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}

/** The answer a screen reacts to: the api's status, its problem body and the `Retry-After` in seconds. */
export interface Failure {
  status: number;
  problem?: ProblemDetails;
  retryAfterSeconds?: number;
}

/**
 * The line a screen shows for a failed call. The api decides which status means what; this only names
 * it in the words the spec fixes. Everything the api could not describe is the unavailable message,
 * because the person can only try again (UI-05).
 */
export function problemMessage({ status, retryAfterSeconds }: Failure): string {
  if (status === 401) return MESSAGES.invalidCredentials;
  if (status === 410) return MESSAGES.invitationInvalid;
  if (status === 429 && retryAfterSeconds !== undefined) {
    return `Muitas tentativas. Tente novamente em ${minutesFromRetryAfter(retryAfterSeconds)} min.`;
  }
  return MESSAGES.unavailable;
}

/**
 * The internal path to open after login, or the fallback. Only a path that starts with a single `/` is
 * a page of this app: `//evil.test` and `/\evil.test` are absolute urls to a browser, and a bare
 * `admin` is not a path at all, so all of them fall back (UI-09).
 */
export function safeRedirect(path: string | undefined, fallback: string): string {
  if (path === undefined || !path.startsWith('/')) return fallback;
  if (path.startsWith('//') || path.startsWith('/\\')) return fallback;
  // A control character or a space cannot appear in a path this app renders, and browsers strip them.
  const hasControlOrSpace = [...path].some((character) => character.charCodeAt(0) <= 0x20);
  return hasControlOrSpace ? fallback : path;
}

/** The area a role belongs to: the admin administers, the member uses the product (AD-005, UI-06, UI-07). */
export type Area = 'admin' | 'member';

export function areaOf(role: 'admin' | 'member'): Area {
  return role === 'admin' ? 'admin' : 'member';
}

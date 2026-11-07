import type { MeResponse } from '@am/contracts';
import type { SessionState } from '../api/server-functions';
import { areaOf, type Area } from './messages';

/**
 * What a protected area does with the session its guard just read. The route turns each answer into a
 * redirect or a screen; the decision itself needs no framework, so every role and state is tested here.
 */
export type AreaAccess =
  | { kind: 'allowed'; user: MeResponse }
  /** No session: the login of the area, remembering the page that was asked for (UI-06, UI-07). */
  | { kind: 'sign-in'; area: Area; returnTo: string }
  /** An admin on the member area belongs on the admin home (UI-11). */
  | { kind: 'move-to-admin' }
  /** A member on the admin area gets the no-access screen, with no admin data (UI-10). */
  | { kind: 'forbidden' }
  /** The api did not answer: say so, and do not send anyone to login (UI-05). */
  | { kind: 'unavailable' };

/** The member area (`/`): members stay, admins go to their own home, visitors sign in. */
export function memberAreaAccess(session: SessionState, returnTo: string): AreaAccess {
  if (session.kind === 'unavailable') return { kind: 'unavailable' };
  if (session.kind === 'anonymous') return { kind: 'sign-in', area: 'member', returnTo };
  return areaOf(session.user.role) === 'admin'
    ? { kind: 'move-to-admin' }
    : { kind: 'allowed', user: session.user };
}

/** The admin area (`/admin/*`): admins stay, members see the no-access screen, visitors sign in. */
export function adminAreaAccess(session: SessionState, returnTo: string): AreaAccess {
  if (session.kind === 'unavailable') return { kind: 'unavailable' };
  if (session.kind === 'anonymous') return { kind: 'sign-in', area: 'admin', returnTo };
  return areaOf(session.user.role) === 'admin'
    ? { kind: 'allowed', user: session.user }
    : { kind: 'forbidden' };
}

/**
 * Where a login door sends someone who is already signed in as the owner of that door: the home of the
 * area (UI-12). Another role, no session and an unavailable api all keep the form, because the person
 * may still want to sign in with the other kind of account.
 */
export function signedInHome(session: SessionState, door: Area): '/' | '/admin' | undefined {
  if (session.kind !== 'authenticated' || areaOf(session.user.role) !== door) return undefined;
  return door === 'admin' ? '/admin' : '/';
}

export function loginPathOf(area: Area): '/login' | '/admin/login' {
  return area === 'admin' ? '/admin/login' : '/login';
}

/** The area a page belongs to, from its path: everything under `/admin` is the admin area. */
export function areaOfPath(pathname: string): Area {
  return pathname === '/admin' || pathname.startsWith('/admin/') ? 'admin' : 'member';
}

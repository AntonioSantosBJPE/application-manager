import type { Role } from '@am/contracts';
import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

export const ACCESS_KEY = 'identity:access';

/**
 * What a route allows. Every route declares one of the three forms (AUTH-19); a route with no
 * declaration falls to the closed default and requires a session (AUTH-15).
 */
export type AccessDeclaration =
  | { kind: 'public' }
  | { kind: 'any-session' }
  | { kind: 'roles'; roles: Role[] };

/**
 * Routes reach identity only through its public API, and the access a route declares lives with
 * the route (AD-006). The guard reads the declaration; nothing else decides who may enter, so a
 * new route cannot silently become public by forgetting a controller-level check.
 */
export const Public = () => SetMetadata(ACCESS_KEY, { kind: 'public' } satisfies AccessDeclaration);

/** A route of one role; a session of the other role answers `403` (AUTH-14). */
export const Roles = (...roles: Role[]) =>
  SetMetadata(ACCESS_KEY, { kind: 'roles', roles } satisfies AccessDeclaration);

/** A route any valid session may use, whatever the role. */
export const AnySession = () => SetMetadata(ACCESS_KEY, { kind: 'any-session' } satisfies AccessDeclaration);

/** The user the guard put on the request; it always comes from the session, never from the body (AUTH-16). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** What the guard attaches to the request once the session resolves. */
export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user === undefined) throw new Error('CurrentUser used on a route without a session');
    return request.user;
  },
);

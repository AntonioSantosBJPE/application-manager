import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SessionService } from '../application/session.service.js';
import { ACCESS_KEY, type AccessDeclaration, type AuthenticatedRequest } from './access.decorators.js';
import { readSessionToken, SESSION_COOKIE_OPTIONS, setSessionCookie, type SessionCookieOptions } from './session-cookie.js';

export { SESSION_COOKIE_OPTIONS } from './session-cookie.js';

/**
 * The one place that decides whether a request may enter (AUTH-10, AUTH-14, AUTH-15). It reads the
 * declaration the route carries, resolves the session cookie through `SessionService` and puts the
 * user on the request. A route with no declaration requires a session: the default is closed.
 *
 * AD-006: the access rule belongs to the route, not to a controller base class or a middleware, so
 * a module that adds a route inherits the closed default instead of an open one, and the guard the
 * other modules reuse is this one, reached through identity's public API.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(SESSION_COOKIE_OPTIONS) private readonly cookie: SessionCookieOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const declaration = this.declarationOf(context);
    if (declaration.kind === 'public') return true;

    const request = context.switchToHttp().getRequest<IncomingMessage & AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<ServerResponse>();
    const token = readSessionToken(request, this.cookie);
    // A missing, expired, revoked or unknown session all answer the same 401 (AUTH-10).
    const session = token === undefined ? undefined : await this.sessions.resolve(token);
    if (session === undefined) throw new UnauthorizedException();

    request.user = session.user;
    // Less than 29 days were left, so the session was extended: the cookie follows (AUTH-11).
    if (session.renewedExpiresAt !== null) setSessionCookie(response, token!, this.cookie);

    if (declaration.kind === 'roles' && !declaration.roles.includes(session.user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }

  /** The method declaration wins over the controller one; no declaration means a session is required. */
  private declarationOf(context: ExecutionContext): AccessDeclaration {
    return (
      this.reflector.getAllAndOverride<AccessDeclaration>(ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? { kind: 'any-session' }
    );
  }
}

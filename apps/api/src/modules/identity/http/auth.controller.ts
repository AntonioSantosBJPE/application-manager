import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { LoginRequest, MeResponse, Role } from '@am/contracts';
import { loginRequestSchema } from '@am/contracts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ProblemDetailsException, problemFor } from '../../../infra/http/problem-details.js';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { LoginService, type LoginResult } from '../application/login.service.js';
import { SessionService } from '../application/session.service.js';
import { AnySession, CurrentUser, Public, type AuthenticatedUser } from './access.decorators.js';
import { clientIpOf } from './client-ip.js';
import {
  SESSION_COOKIE_OPTIONS,
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
  type SessionCookieOptions,
} from './session-cookie.js';

/**
 * The two entrances (AD-005), the session user and the logout. Accounts are separate, so
 * `/auth/login` opens only a member session and `/auth/admin/login` only an admin one; the wrong
 * credential answers the same `401` (AUTH-03). The entrances and the logout are public: a session
 * is what they issue or end.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginService,
    private readonly sessions: SessionService,
    @Inject(SESSION_COOKIE_OPTIONS) private readonly cookie: SessionCookieOptions,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  async memberLogin(
    @Body(zodBody(loginRequestSchema)) body: LoginRequest,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<void> {
    await this.enter('member', body, request, response);
  }

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminLogin(
    @Body(zodBody(loginRequestSchema)) body: LoginRequest,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<void> {
    await this.enter('admin', body, request, response);
  }

  /** The session user as the contract declares it; it is read from the session, never from the body (AUTH-09, AUTH-16). */
  @AnySession()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): MeResponse {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  /**
   * Ends the session the browser presented and removes the cookie (AUTH-12). Without a session it
   * still answers `204`: the browser asked to be logged out, and it is.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse): Promise<void> {
    const token = readSessionToken(request, this.cookie);
    if (token !== undefined) await this.sessions.revoke(token);
    clearSessionCookie(response, this.cookie);
  }

  /** Creates the session and hands the token to the browser in the cookie (AUTH-01, AUTH-02, AUTH-07). */
  private async enter(
    entrance: Role,
    body: LoginRequest,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const result: LoginResult = await this.login.login({
      email: body.email,
      password: body.password,
      ip: clientIpOf(request),
      entrance,
    });
    if (result.kind === 'blocked') {
      // The wait comes from the oldest counted failure; the body says nothing about the account (LOCK-03, LOCK-04).
      throw new ProblemDetailsException(problemFor(429, 'Too many login attempts'), {
        'retry-after': String(result.retryAfterSeconds),
      });
    }
    // Wrong password, unknown email and the other entrance all land here, with no session made (AUTH-03).
    if (result.kind === 'refused') throw new UnauthorizedException();
    setSessionCookie(response, result.session.token, this.cookie);
  }
}

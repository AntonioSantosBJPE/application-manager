import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { LoginRequest, Role } from '@am/contracts';
import { loginRequestSchema } from '@am/contracts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { LoginService } from '../application/login.service.js';
import { Public } from './access.decorators.js';
import { clientIpOf } from './client-ip.js';
import { SESSION_COOKIE_OPTIONS, setSessionCookie, type SessionCookieOptions } from './session-cookie.js';

/**
 * The two entrances (AD-005). Accounts are separate, so `/auth/login` opens only a member session
 * and `/auth/admin/login` only an admin one; the wrong credential answers the same `401` (AUTH-03).
 * Both are public: a session is what they issue.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginService,
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

  /** Creates the session and hands the token to the browser in the cookie (AUTH-01, AUTH-02, AUTH-07). */
  private async enter(
    entrance: Role,
    body: LoginRequest,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const session = await this.login.login({
      email: body.email,
      password: body.password,
      ip: clientIpOf(request),
      entrance,
    });
    // Wrong password, unknown email and the other entrance all land here, with no session made (AUTH-03).
    if (session === undefined) throw new UnauthorizedException();
    setSessionCookie(response, session.token, this.cookie);
  }
}

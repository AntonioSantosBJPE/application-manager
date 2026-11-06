import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { ApiEnv } from '../../config/env.js';
import { LoginService } from './application/login.service.js';
import { AccountAdminService } from './application/account-admin.service.js';
import { InvitationService, IDENTITY_ENV } from './application/invitation.service.js';
import { PASSWORD_HASHER, argon2idPasswordHasher, type PasswordHasher } from './application/password-hasher.js';
import { SessionService } from './application/session.service.js';
import { AuthController } from './http/auth.controller.js';
import { InvitationsController } from './http/invitations.controller.js';
import { SessionGuard, SESSION_COOKIE_OPTIONS } from './http/session.guard.js';
import { InvitationsRepository } from './infra/invitations.repository.js';
import { LoginAttemptsRepository } from './infra/login-attempts.repository.js';
import { SessionsRepository } from './infra/sessions.repository.js';
import { UsersRepository } from './infra/users.repository.js';

export interface IdentityModuleOptions {
  /** Replaces the Argon2id hasher; a test wraps the real one to count the work an attempt asked for. */
  passwordHasher?: PasswordHasher;
}

/**
 * Identity owns the accounts, the sessions and the access rule of the whole API. The guard is
 * registered once, globally, so a module added later is closed by default and reaches the guard
 * through this module's public API instead of importing its interior (EDGE-08, AUTH-15).
 */
@Module({})
export class IdentityModule {
  static forRoot(
    env: Pick<ApiEnv, 'sessionCookieSecure' | 'webPublicUrl'>,
    options: IdentityModuleOptions = {},
  ): DynamicModule {
    return {
      module: IdentityModule,
      controllers: [AuthController, InvitationsController],
      providers: [
        { provide: SESSION_COOKIE_OPTIONS, useValue: { secure: env.sessionCookieSecure } },
        { provide: IDENTITY_ENV, useValue: { webPublicUrl: env.webPublicUrl } },
        { provide: PASSWORD_HASHER, useValue: options.passwordHasher ?? argon2idPasswordHasher },
        SessionsRepository,
        UsersRepository,
        LoginAttemptsRepository,
        InvitationsRepository,
        SessionService,
        LoginService,
        InvitationService,
        AccountAdminService,
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
      exports: [SessionService],
    };
  }
}

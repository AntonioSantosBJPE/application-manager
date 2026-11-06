import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { ApiEnv } from '../../config/env.js';
import { SessionService } from './application/session.service.js';
import { SessionGuard, SESSION_COOKIE_OPTIONS } from './http/session.guard.js';
import { SessionsRepository } from './infra/sessions.repository.js';

/**
 * Identity owns the accounts, the sessions and the access rule of the whole API. The guard is
 * registered once, globally, so a module added later is closed by default and reaches the guard
 * through this module's public API instead of importing its interior (EDGE-08, AUTH-15).
 */
@Module({})
export class IdentityModule {
  static forRoot(env: Pick<ApiEnv, 'sessionCookieSecure'>): DynamicModule {
    return {
      module: IdentityModule,
      providers: [
        { provide: SESSION_COOKIE_OPTIONS, useValue: { secure: env.sessionCookieSecure } },
        SessionsRepository,
        SessionService,
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
      exports: [SessionService],
    };
  }
}

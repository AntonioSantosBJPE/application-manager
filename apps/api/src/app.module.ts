import {
  Global,
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { json, urlencoded } from 'express';
import type { DestinationStream } from 'pino';
import type { ApiEnv } from './config/env.js';
import { CLOCK, systemClock, type Clock } from './infra/clock/clock.js';
import { DatabaseModule } from './infra/database/database.module.js';
import { ProblemDetailsFilter } from './infra/http/problem-details.filter.js';
import { createLoggingModule } from './infra/logging/logging.module.js';
import { HealthModule } from './modules/health/index.js';
import { IdentityModule, type PasswordHasher } from './modules/identity/index.js';
import { SkillsModule } from './modules/skills/index.js';

export interface AppModuleOptions {
  /** Overrides the log destination (stdout); used by tests to read the JSON lines. */
  logDestination?: DestinationStream;
  /** Overrides the wall clock; a test moves time instead of waiting for an expiry (AUTH-11, LOCK-07). */
  clock?: Clock;
  /** Wraps the password hasher; a test counts the work a login asked for (AUTH-04). */
  passwordHasher?: PasswordHasher;
}

@Global()
@Module({})
export class ClockModule {
  static forRoot(clock: Clock): DynamicModule {
    return {
      module: ClockModule,
      global: true,
      providers: [{ provide: CLOCK, useValue: clock }],
      exports: [CLOCK],
    };
  }
}

@Module({})
export class AppModule implements NestModule {
  /**
   * The body parsers Nest would register on its own (see create-app.ts), mounted as module middleware.
   * The logging module is global, and Nest mounts the middleware of global modules first, so the
   * request id and the request log exist even when the body is rejected.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(json(), urlencoded({ extended: true }))
      .forRoutes({ path: '{/*splat}', method: RequestMethod.ALL });
  }

  static forRoot(env: ApiEnv, options: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ClockModule.forRoot(options.clock ?? systemClock),
        createLoggingModule({ level: env.logLevel, destination: options.logDestination }),
        DatabaseModule.forRoot(env.databaseUrl),
        IdentityModule.forRoot(env, { passwordHasher: options.passwordHasher }),
        SkillsModule,
        HealthModule,
      ],
      // Every error leaves as application/problem+json (AUTH-17), including a missing route.
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    };
  }
}

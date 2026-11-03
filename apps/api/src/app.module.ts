import { Module, RequestMethod, type DynamicModule, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { json, urlencoded } from 'express';
import type { DestinationStream } from 'pino';
import type { ApiEnv } from './config/env.js';
import { DatabaseModule } from './infra/database/database.module.js';
import { createLoggingModule } from './infra/logging/logging.module.js';
import { HealthModule } from './modules/health/index.js';

export interface AppModuleOptions {
  /** Overrides the log destination (stdout); used by tests to read the JSON lines. */
  logDestination?: DestinationStream;
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
        createLoggingModule({ level: env.logLevel, destination: options.logDestination }),
        DatabaseModule.forRoot(env.databaseUrl),
        HealthModule,
      ],
    };
  }
}

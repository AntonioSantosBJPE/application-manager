import { Module, type DynamicModule } from '@nestjs/common';
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
export class AppModule {
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

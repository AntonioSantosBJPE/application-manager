import { Inject, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { createPool } from './pool.js';

export const DATABASE_POOL = Symbol('DATABASE_POOL');
export const DATABASE = Symbol('DATABASE');

export type Database = NodePgDatabase;

/** pg Pool + Drizzle, available to every module through the `DATABASE` token. */
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: pg.Pool) {}

  static forRoot(databaseUrl: string): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      providers: [
        { provide: DATABASE_POOL, useFactory: () => createPool(databaseUrl) },
        { provide: DATABASE, useFactory: (pool: pg.Pool) => drizzle(pool), inject: [DATABASE_POOL] },
      ],
      exports: [DATABASE],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

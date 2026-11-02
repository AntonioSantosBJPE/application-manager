import { Logger } from '@nestjs/common';
import pg from 'pg';

/** Neither a new connection nor a stuck query waits longer than this (SKEL-04). */
export const databaseTimeoutMs = 2000;

export function createPool(databaseUrl: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: databaseTimeoutMs,
    query_timeout: databaseTimeoutMs,
  });
  // An idle client losing its connection emits `error`; unhandled, it would crash the process.
  const logger = new Logger('DatabasePool');
  pool.on('error', (error) => logger.warn(`idle database client failed: ${error.message}`));
  return pool;
}

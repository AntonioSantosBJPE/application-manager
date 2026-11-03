import { setTimeout as sleep } from 'node:timers/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export interface RunMigrationsOptions {
  databaseUrl: string;
  migrationsFolder: string;
  /** How long to keep trying to reach the database before giving up (EDGE-01). */
  retryWindowMs?: number;
}

const retryIntervalMs = 1000;
const connectTimeoutMs = 2000;

/**
 * Waits for the database, then applies the pending migrations in one transaction.
 * Drizzle records each one in `drizzle.__drizzle_migrations` and skips what is recorded (SKEL-08..10).
 */
export async function runMigrations({
  databaseUrl,
  migrationsFolder,
  retryWindowMs = 30_000,
}: RunMigrationsOptions): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: connectTimeoutMs });
  pool.on('error', () => {
    // An idle client dropped by the server; the next query reports the failure.
  });
  try {
    await waitForDatabase(pool, retryWindowMs);
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

async function waitForDatabase(pool: pg.Pool, retryWindowMs: number): Promise<void> {
  const deadline = Date.now() + retryWindowMs;
  for (;;) {
    try {
      await pool.query('select 1');
      return;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw new Error(`Database not reachable after ${retryWindowMs} ms`, { cause: error });
      }
      await sleep(retryIntervalMs);
    }
  }
}

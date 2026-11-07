import { join } from 'node:path';
import pg from 'pg';
import { runMigrations } from '../src/infra/database/migrations.js';

const migrationsFolder = join(import.meta.dirname, '../drizzle');

export interface TestDatabase {
  /** Connection string of the database the test owns. */
  url: string;
  name: string;
}

/**
 * A database of its own with every migration applied, so integration tests meet the real schema
 * instead of a mock (GUARD-04).
 */
export async function createMigratedDatabase(adminUrl: string, prefix: string): Promise<TestDatabase> {
  const name = `${prefix}_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
  const admin = new URL(adminUrl);
  const client = new pg.Client({ connectionString: admin.href });
  await client.connect();
  try {
    await client.query(`create database ${name}`);
  } finally {
    await client.end();
  }
  admin.pathname = `/${name}`;
  await runMigrations({ databaseUrl: admin.href, migrationsFolder });
  return { url: admin.href, name };
}

export async function dropDatabase(adminUrl: string, database: TestDatabase): Promise<void> {
  const admin = new URL(adminUrl);
  const client = new pg.Client({ connectionString: admin.href });
  await client.connect();
  try {
    await client.query(`drop database if exists ${database.name} with (force)`);
  } finally {
    await client.end();
  }
}

/** Runs one statement on the test database and answers its rows; the test never shares a pool. */
export async function query<T extends pg.QueryResultRow>(
  databaseUrl: string,
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

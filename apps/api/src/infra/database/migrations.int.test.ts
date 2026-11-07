import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { postgresImage } from '../../../test/postgres.js';
import { runMigrations } from './migrations.js';

const migrationsFolder = join(import.meta.dirname, '../../../drizzle');

/** Every migration the folder holds, in the order the journal applies them (tag + hash of its SQL). */
async function migrationsOnDisk(): Promise<{ tag: string; hash: string }[]> {
  const journal = JSON.parse(await readFile(join(migrationsFolder, 'meta/_journal.json'), 'utf8')) as {
    entries: { idx: number; tag: string }[];
  };
  return Promise.all(
    [...journal.entries].sort((a, b) => a.idx - b.idx).map(async ({ tag }) => ({
      tag,
      hash: createHash('sha256').update(await readFile(join(migrationsFolder, `${tag}.sql`), 'utf8')).digest('hex'),
    })),
  );
}

/** A fresh database in the shared container, so each test starts with nothing applied. */
async function createDatabase(): Promise<string> {
  const url = new URL(inject('databaseUrl'));
  const name = `migrations_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  url.pathname = `/${name}`;
  return url.href;
}

async function query<T extends pg.QueryResultRow>(databaseUrl: string, text: string): Promise<T[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return (await client.query<T>(text)).rows;
  } finally {
    await client.end();
  }
}

function appliedMigrations(databaseUrl: string) {
  return query<{ id: number; hash: string; created_at: string }>(
    databaseUrl,
    'select id, hash, created_at from drizzle.__drizzle_migrations order by id',
  );
}

/** Writes a migrations folder in drizzle-kit's layout: one SQL file per tag and meta/_journal.json. */
const tempFolders: string[] = [];
async function migrationsFolderWith(migrations: { tag: string; sql: string }[]): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'am-migrations-'));
  tempFolders.push(folder);
  await mkdir(join(folder, 'meta'));
  const entries = migrations.map(({ tag }, idx) => ({ idx, version: '7', when: 1_700_000_000_000 + idx, tag, breakpoints: true }));
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ version: '7', dialect: 'postgresql', entries }));
  for (const { tag, sql } of migrations) await writeFile(join(folder, `${tag}.sql`), sql);
  return folder;
}

/** A local port nothing listens on: bind to a random port and release it. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

afterEach(async () => {
  await Promise.all(tempFolders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

describe('runMigrations', () => {
  it('applies the migrations and records them in drizzle.__drizzle_migrations', async () => {
    const databaseUrl = await createDatabase();
    const onDisk = await migrationsOnDisk();

    await runMigrations({ databaseUrl, migrationsFolder });

    const applied = await appliedMigrations(databaseUrl);
    expect(applied.map((m) => m.hash)).toEqual(onDisk.map((m) => m.hash));
  });

  it('applies nothing on a second run', async () => {
    const databaseUrl = await createDatabase();
    const onDisk = await migrationsOnDisk();
    await runMigrations({ databaseUrl, migrationsFolder });
    const first = await appliedMigrations(databaseUrl);

    await runMigrations({ databaseUrl, migrationsFolder });

    expect(first).toHaveLength(onDisk.length);
    expect(await appliedMigrations(databaseUrl)).toEqual(first);
  });

  it('rejects an invalid migration and leaves nothing applied', async () => {
    const databaseUrl = await createDatabase();
    const folder = await migrationsFolderWith([
      { tag: '0000_create_note', sql: 'create table note (id int primary key);' },
      { tag: '0001_broken', sql: 'create table broken (id int primary key,);' },
    ]);

    // The failure is the broken statement itself, after the valid migration ran in the same transaction.
    await expect(runMigrations({ databaseUrl, migrationsFolder: folder })).rejects.toThrow(
      'create table broken (id int primary key,)',
    );

    expect(await appliedMigrations(databaseUrl)).toEqual([]);
    const tables = await query<{ table_name: string }>(
      databaseUrl,
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    expect(tables).toEqual([]);
  });

  it('succeeds when the database comes up within the retry window', async () => {
    const port = await freePort();
    const credentials = { user: 'migrate', password: 'migrate', database: 'migrate' };
    const databaseUrl = `postgres://${credentials.user}:${credentials.password}@127.0.0.1:${port}/${credentials.database}`;

    // Nothing listens on the port yet, so the first attempts fail; the database starts afterwards.
    const run = runMigrations({ databaseUrl, migrationsFolder });
    const container = await new PostgreSqlContainer(postgresImage)
      .withUsername(credentials.user)
      .withPassword(credentials.password)
      .withDatabase(credentials.database)
      .withExposedPorts({ container: 5432, host: port })
      .start();
    try {
      await expect(run).resolves.toBeUndefined();
      expect(await appliedMigrations(databaseUrl)).toHaveLength((await migrationsOnDisk()).length);
    } finally {
      await container.stop();
    }
  });

  it('retries for 30 seconds before failing when the database is down', async () => {
    const port = await freePort();
    const started = performance.now();

    // Default retry window (30 s), so the test proves the number in the spec (EDGE-01).
    await expect(
      runMigrations({ databaseUrl: `postgres://migrate:migrate@127.0.0.1:${port}/migrate`, migrationsFolder }),
    ).rejects.toThrow();

    const elapsedMs = performance.now() - started;
    expect(elapsedMs).toBeGreaterThanOrEqual(30_000);
    expect(elapsedMs).toBeLessThanOrEqual(35_000);
  });
});

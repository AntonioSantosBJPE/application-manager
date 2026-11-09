import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { repoRoot } from '../repo.js';
import { startHarness, type Harness } from './backup-harness.js';

/** Migrations of the repository, as the journal lists them. */
const journalText = readFileSync(join(repoRoot, 'apps/api/drizzle/meta/_journal.json'), 'utf8');
const repositoryMigrations = (JSON.parse(journalText) as { entries: unknown[] }).entries.length;

let harness: Harness;

/** Runs verify-restore.sh in the image, with the repository's journal written to a file first. */
const verify = (prefix: string) =>
  harness.shell(
    `cat > /tmp/journal.json <<'JSON'\n${journalText}\nJSON\n/usr/local/bin/verify-restore.sh`,
    { BACKUP_PREFIX: prefix, MIGRATIONS_JOURNAL: '/tmp/journal.json' },
  );

/** Resets the source to `rows` applied migrations and makes a backup under `prefix`. */
function backupWithMigrations(prefix: string, rows: number) {
  const reset = harness.psql(
    `drop schema if exists drizzle cascade;
     create schema drizzle;
     create table drizzle.__drizzle_migrations (id serial primary key, hash text, created_at bigint);
     insert into drizzle.__drizzle_migrations (hash, created_at) select 'm' || g, g from generate_series(1, ${rows}) g`,
  );
  expect(reset.status, reset.output).toBe(0);
  const backup = harness.runImage(['--once'], { BACKUP_PREFIX: prefix });
  expect(backup.status, backup.output).toBe(0);
}

beforeAll(() => {
  harness = startHarness();
}, 300_000);
afterAll(() => harness?.destroy(), 120_000);

describe('verify-restore.sh', () => {
  it('DEPLOY-41 exits 0 when the latest backup carries every migration of the repository, and drops the scratch database', () => {
    backupWithMigrations('vr-ok', repositoryMigrations);
    const result = verify('vr-ok');
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(`all ${repositoryMigrations} migrations`);
    expect(harness.psql("select count(*) from pg_database where datname like 'verify_restore%'", 'postgres').output.trim()).toBe('0');
  });

  it('DEPLOY-41 exits non-zero showing both counts when the backup lacks a migration', () => {
    backupWithMigrations('vr-short', repositoryMigrations - 1);
    const result = verify('vr-short');
    expect(result.status).toBe(1);
    expect(result.output).toContain(`carries ${repositoryMigrations - 1} migrations, the repository has ${repositoryMigrations}`);
    expect(harness.psql("select count(*) from pg_database where datname like 'verify_restore%'", 'postgres').output.trim()).toBe('0');
  });

  it('DEPLOY-41 exits non-zero when the prefix holds no backup', () => {
    const result = verify('vr-empty');
    expect(result.status).toBe(1);
    expect(result.output).toContain('the restore failed');
  });
});

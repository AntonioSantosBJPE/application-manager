import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { repoRoot, run } from '../repo.js';
import { credentials, s3Env, startHarness, type Harness } from './backup-harness.js';

const backupScript = join(repoRoot, 'infra/backup/backup.sh');
const dayAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

let harness: Harness;
beforeAll(() => {
  harness = startHarness();
  const seeded = harness.psql('create table notes (id int primary key, body text); insert into notes values (1, $$backup me$$)');
  expect(seeded.status, seeded.output).toBe(0);
}, 300_000);
afterAll(() => harness?.destroy(), 120_000);

const once = (prefix: string, env: Record<string, string> = {}) =>
  harness.runImage(['--once'], { BACKUP_PREFIX: prefix, ...env });

describe('backup.sh', () => {
  it('DEPLOY-33 uploads a custom-format dump to <prefix>/<UTC ISO 8601>.dump that pg_restore can read', () => {
    const result = once('t33');
    expect(result.status, result.output).toBe(0);
    const keys = harness.keys('t33');
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^t33\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\.dump$/);
    const listing = harness.shell(
      `aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "s3://$BACKUP_BUCKET/${keys[0]}" - --only-show-errors | pg_restore --list`,
    );
    expect(listing.status, listing.output).toBe(0);
    expect(listing.output).toMatch(/TABLE public notes/);
  });

  it('DEPLOY-34 computes the wait until the next BACKUP_SCHEDULE_UTC_HOUR, a full day when it is that instant', () => {
    const epoch = (iso: string) => String(Date.parse(iso) / 1000);
    const wait = (iso: string) => run('bash', [backupScript, '--seconds-until', '3', epoch(iso)]).output.trim();
    expect(wait('2026-01-01T02:00:00Z')).toBe('3600');
    expect(wait('2026-01-01T03:00:00Z')).toBe('86400');
    expect(wait('2026-01-01T04:00:00Z')).toBe('82800');
  });

  it('DEPLOY-34 without --once waits for the scheduled hour, then runs one cycle, then waits again', () => {
    // Stubs stand in for sleep, pg_dump and aws so the loop can be observed without waiting a day.
    const bin = mkdtempSync(join(tmpdir(), 'backup-loop-'));
    const log = join(bin, 'calls.log');
    const stub = (name: string, body: string) => {
      writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(join(bin, name), 0o755);
    };
    stub('sleep', `echo "sleep $1" >> "${log}"; [ "$(grep -c '^sleep' "${log}")" -lt 2 ] || exit 7`);
    stub('pg_dump', `echo "pg_dump" >> "${log}"; for a in "$@"; do last="$a"; done; : > "$last"`);
    stub('aws', `echo "aws $*" >> "${log}"; case "$*" in *list-objects-v2*) echo null;; esac`);
    const result = run('bash', [backupScript], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        DATABASE_URL: 'postgres://u:p@h/d',
        BACKUP_S3_ENDPOINT: 'http://s3.test',
        BACKUP_S3_ACCESS_KEY_ID: 'id',
        BACKUP_S3_SECRET_ACCESS_KEY: 'secret',
        BACKUP_BUCKET: 'b',
        BACKUP_SCHEDULE_UTC_HOUR: '3',
      },
    });
    expect(result.status).toBe(7);
    const calls = readFileSync(log, 'utf8').trim().split('\n');
    expect(calls[0]).toMatch(/^sleep \d+$/);
    expect(Number(calls[0]!.split(' ')[1])).toBeGreaterThan(0);
    expect(Number(calls[0]!.split(' ')[1])).toBeLessThanOrEqual(86400);
    expect(calls[1]).toBe('pg_dump');
    expect(calls.filter((call) => call.startsWith('aws') && call.includes('s3 cp'))).toHaveLength(1);
    expect(calls.at(-1)).toMatch(/^sleep \d+$/);
  });

  it('DEPLOY-35 a failing dump exits non-zero, logs the error as JSON and keeps every old backup', () => {
    harness.put('t35/2000-01-01T00:00:00Z.dump');
    const result = once('t35', { DATABASE_URL: `postgres://app:wrong-password@pg:5432/app` });
    expect(result.status).not.toBe(0);
    const errorLine = result.output.split('\n').map((line) => (line.startsWith('{') ? JSON.parse(line) : null)).find((entry) => entry?.level === 'error');
    expect(errorLine?.msg).toContain('pg_dump failed');
    expect(harness.keys('t35')).toEqual(['t35/2000-01-01T00:00:00Z.dump']);
  });

  it('DEPLOY-35 a failing upload exits non-zero and logs the error', () => {
    const result = once('t35b', { BACKUP_BUCKET: 'no-such-bucket' });
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/"level":"error".*the upload failed/);
  });

  it('DEPLOY-36 after a good upload deletes only the backups of the prefix older than the retention', () => {
    const old = `t36/${dayAgo(30)}.dump`;
    const recent = `t36/${dayAgo(1)}.dump`;
    for (const key of [old, recent, 't36/notes.txt', `other36/${dayAgo(30)}.dump`]) {
      expect(harness.put(key).status).toBe(0);
    }
    const result = once('t36', { BACKUP_RETENTION_DAYS: '14' });
    expect(result.status, result.output).toBe(0);
    const keys = harness.keys('t36');
    expect(keys).not.toContain(old);
    expect(keys).toContain(recent);
    expect(keys).toContain('t36/notes.txt');
    expect(keys).toHaveLength(3);
    expect(harness.keys('other36')).toHaveLength(1);
  });

  it('DEPLOY-37 reaches the store only through BACKUP_S3_ENDPOINT, with no vendor-specific code', () => {
    const source = readFileSync(backupScript, 'utf8');
    expect(source).toContain('--endpoint-url "$BACKUP_S3_ENDPOINT"');
    expect(source).not.toMatch(/cloudflare|r2\.|amazonaws|\.r2\./i);
    // The run above against MinIO (not S3, not R2) is the proof that the endpoint is configurable.
    expect(once('t37').status).toBe(0);
  });

  it('DEPLOY-38 never writes the database password, the access key or the secret to a log', () => {
    const outputs = [
      once('t38').output,
      once('t38', { DATABASE_URL: `postgres://app:${credentials.dbPassword}x@pg:5432/app` }).output,
      once('t38', { BACKUP_BUCKET: 'no-such-bucket' }).output,
      once('t38', { BACKUP_S3_SECRET_ACCESS_KEY: 'wrong-secret' }).output,
    ].join('\n');
    for (const secret of [credentials.dbPassword, credentials.s3AccessKeyId, credentials.s3SecretKey, 'wrong-secret']) {
      expect(outputs).not.toContain(secret);
    }
    expect(Object.keys(s3Env('b'))).toContain('BACKUP_S3_SECRET_ACCESS_KEY');
  });
});

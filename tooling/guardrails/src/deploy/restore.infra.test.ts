import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './backup-harness.js';

let harness: Harness;
let sourceKey = '';
let migrationsInSource = 0;

const target = (database: string) => `postgres://app:test-db-password@pg:5432/${database}`;
const restore = (args: string[], database: string, env: Record<string, string> = {}) =>
  harness.runImage(args, { TARGET_DATABASE_URL: target(database), BACKUP_PREFIX: 'rs', ...env }, '/usr/local/bin/restore.sh');

beforeAll(() => {
  harness = startHarness();
  // A migrated-looking source: the drizzle bookkeeping table with one row per applied migration, and data.
  const setup = harness.psql(
    `create schema drizzle;
     create table drizzle.__drizzle_migrations (id serial primary key, hash text, created_at bigint);
     insert into drizzle.__drizzle_migrations (hash, created_at) values ('a', 1), ('b', 2), ('c', 3);
     create table notes (id int primary key, body text);
     insert into notes values (1, $$restore me$$)`,
  );
  expect(setup.status, setup.output).toBe(0);
  migrationsInSource = 3;
  const backup = harness.runImage(['--once'], { BACKUP_PREFIX: 'rs' });
  expect(backup.status, backup.output).toBe(0);
  sourceKey = harness.keys('rs')[0]!;
}, 300_000);
afterAll(() => harness?.destroy(), 120_000);

const newDatabase = (name: string) => expect(harness.psql(`create database ${name}`, 'postgres').status).toBe(0);

describe('restore.sh', () => {
  it('DEPLOY-39 restores by key into an empty database and prints the number of applied migrations', () => {
    newDatabase('by_key');
    const result = restore([sourceKey], 'by_key');
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(`migrations=${migrationsInSource}`);
    expect(harness.psql('select body from notes where id = 1', 'by_key').output.trim()).toBe('restore me');
  });

  it('DEPLOY-39 --latest restores the newest backup of the prefix', () => {
    harness.put('rs/2000-01-01T00:00:00Z.dump');
    newDatabase('by_latest');
    const result = restore(['--latest'], 'by_latest');
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(`restored ${sourceKey}`);
    expect(harness.psql('select count(*) from notes', 'by_latest').output.trim()).toBe('1');
  });

  it('DEPLOY-40 refuses a target that is not empty, exits non-zero and changes nothing', () => {
    newDatabase('not_empty');
    expect(harness.psql('create table keepme (id int); insert into keepme values (42)', 'not_empty').status).toBe(0);
    const result = restore([sourceKey], 'not_empty');
    expect(result.status).toBe(3);
    expect(result.output).toContain('not empty');
    expect(harness.psql('select id from keepme', 'not_empty').output.trim()).toBe('42');
    expect(harness.psql("select count(*) from pg_class where relname = 'notes'", 'not_empty').output.trim()).toBe('0');
  });

  it.each([
    ['only an enum type', 'create type public.mood as enum ($$ok$$)'],
    ['only a function', 'create function public.one() returns int language sql as $$select 1$$'],
    ['only a schema of its own', 'create schema leftover'],
    ['only a view', 'create view public.v as select 1 as one'],
    ['only a sequence', 'create sequence public.s'],
  ])('DEPLOY-40 refuses a target with %s, exits non-zero and leaves it exactly as it was', (_label, ddl) => {
    const name = `target_${_label.replace(/[^a-z]/g, '')}`;
    newDatabase(name);
    expect(harness.psql(ddl, name).status).toBe(0);
    const inventory = "select (select count(*) from pg_namespace where nspname not like 'pg_%') || ',' || (select count(*) from pg_class where relnamespace = 'public'::regnamespace) || ',' || (select count(*) from pg_proc where pronamespace = 'public'::regnamespace) || ',' || (select count(*) from pg_type where typnamespace = 'public'::regnamespace and typtype = 'e')";
    const before = harness.psql(inventory, name).output.trim();
    const result = restore([sourceKey], name);
    expect(result.status).toBe(3);
    expect(harness.psql(inventory, name).output.trim()).toBe(before);
    expect(harness.psql("select count(*) from pg_namespace where nspname = 'drizzle'", name).output.trim()).toBe('0');
  });

  it('DEPLOY-40 a dump that cannot be restored leaves an empty target empty', () => {
    // A dump whose second statement cannot run: a function needing a type that the dump does not create.
    newDatabase('half_way');
    const broken = harness.shell(
      `export PGPASSWORD=test-db-password
       psql "postgres://app@pg:5432/app" -qc 'create table half_a (id int)' &&
       pg_dump --format=custom "postgres://app@pg:5432/app" -t half_a > /tmp/half.dump &&
       psql "postgres://app@pg:5432/app" -qc 'drop table half_a' &&
       aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp /tmp/half.dump "s3://$BACKUP_BUCKET/rs/2999-01-01T00:00:00Z.dump" --only-show-errors &&
       head -c 200 /tmp/half.dump > /tmp/truncated.dump &&
       aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp /tmp/truncated.dump "s3://$BACKUP_BUCKET/rs/2999-01-02T00:00:00Z.dump" --only-show-errors`,
    );
    expect(broken.status, broken.output).toBe(0);
    const result = restore(['rs/2999-01-02T00:00:00Z.dump'], 'half_way');
    expect(result.status).toBe(1);
    expect(harness.psql("select count(*) from pg_class where relname = 'half_a'", 'half_way').output.trim()).toBe('0');
  });

  it('DEPLOY-40 with --force restores over a target that is not empty', () => {
    newDatabase('forced');
    expect(harness.psql('create table notes (id int primary key, body text); insert into notes values (9, $$stale$$)', 'forced').status).toBe(0);
    const result = restore([sourceKey, '--force'], 'forced');
    expect(result.status, result.output).toBe(0);
    expect(harness.psql('select body from notes', 'forced').output.trim()).toBe('restore me');
  });
});

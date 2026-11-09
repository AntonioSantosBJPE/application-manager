import { randomBytes } from 'node:crypto';
import { repoRoot, run, type RunResult } from '../repo.js';

// A throwaway Postgres 18 and an S3-compatible server (moto) on a private Docker network, with the backup image built from
// infra/backup, shared by the backup, restore and verify-restore tests. Docker must be running.

const POSTGRES_IMAGE =
  'postgres:18.6-alpine@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5';
// moto serves the S3 API over HTTP and needs no setup; MinIO's images are no longer published on Docker Hub.
const S3_IMAGE = 'motoserver/moto@sha256:4ec079cbae737fa957efb6b17732bc4e9cdf33942e947ad70e5696694fca3e5e';

export const credentials = {
  dbPassword: 'test-db-password',
  s3AccessKeyId: 'test-access-key',
  s3SecretKey: 'test-secret-key',
};

export interface Harness {
  suffix: string;
  network: string;
  image: string;
  bucket: string;
  /** DATABASE_URL of the source database, as seen from the network. */
  databaseUrl: string;
  /** Runs the backup image with `args` (and extra env) on the network; `entrypoint` replaces backup.sh. */
  runImage(args: string[], env?: Record<string, string>, entrypoint?: string): RunResult;
  /** Runs `sh -c script` in the backup image on the network, with the S3 variables set. */
  shell(script: string, env?: Record<string, string>): RunResult;
  /** Runs psql against the source Postgres. */
  psql(sql: string, database?: string): RunResult;
  /** Keys under `prefix/` in the bucket, sorted. */
  keys(prefix: string): string[];
  /** Uploads an empty object. */
  put(key: string): RunResult;
  destroy(): void;
}

const docker = (args: string[]) => run('docker', args, { cwd: repoRoot });

export function s3Env(bucket: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    BACKUP_S3_ENDPOINT: 'http://s3:5000',
    BACKUP_S3_ACCESS_KEY_ID: credentials.s3AccessKeyId,
    BACKUP_S3_SECRET_ACCESS_KEY: credentials.s3SecretKey,
    BACKUP_BUCKET: bucket,
    ...extra,
  };
}

function envArgs(env: Record<string, string>): string[] {
  return Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
}

function waitUntil(description: string, attempt: () => boolean, seconds = 60): void {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (attempt()) return;
    run('sleep', ['1']);
  }
  throw new Error(`timed out waiting for ${description}`);
}

export function startHarness(): Harness {
  const suffix = randomBytes(4).toString('hex');
  const network = `am-backup-${suffix}`;
  const image = `local/am-backup-test:${suffix}`;
  const bucket = 'backups';
  const databaseUrl = `postgres://app:${credentials.dbPassword}@pg:5432/app`;

  const build = docker(['build', '-q', '-f', 'infra/backup/Dockerfile', '-t', image, 'infra/backup']);
  if (build.status !== 0) throw new Error(`backup image build failed:\n${build.output}`);
  docker(['network', 'create', network]);

  const pg = docker([
    'run', '-d', '--rm', '--name', `${network}-pg`, '--network', network, '--network-alias', 'pg',
    '-e', 'POSTGRES_USER=app', '-e', `POSTGRES_PASSWORD=${credentials.dbPassword}`, '-e', 'POSTGRES_DB=app',
    POSTGRES_IMAGE,
  ]);
  if (pg.status !== 0) throw new Error(`postgres failed to start:\n${pg.output}`);
  const s3Server = docker([
    'run', '-d', '--rm', '--name', `${network}-s3`, '--network', network, '--network-alias', 's3', S3_IMAGE,
  ]);
  if (s3Server.status !== 0) throw new Error(`the S3 server failed to start:\n${s3Server.output}`);

  const psql = (sql: string, database = 'app') =>
    docker(['exec', `${network}-pg`, 'psql', '-U', 'app', '-d', database, '-v', 'ON_ERROR_STOP=1', '-tA', '-c', sql]);
  const runImage = (args: string[], env: Record<string, string> = {}, entrypoint?: string) =>
    docker([
      'run', '--rm', '--network', network,
      ...(entrypoint ? ['--entrypoint', entrypoint] : []),
      ...envArgs({ DATABASE_URL: databaseUrl, ...s3Env(bucket), ...env }),
      image, ...args,
    ]);
  // backup.sh exports the aws credentials itself; a plain shell needs the same three lines.
  const awsEnv = 'export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto; ';
  const shell = (script: string, env: Record<string, string> = {}) => runImage(['-c', awsEnv + script], env, 'bash');

  waitUntil('postgres', () => psql('select 1').status === 0);
  waitUntil('the S3 server', () => shell('aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3api list-buckets').status === 0);
  const made = shell('aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 mb "s3://$BACKUP_BUCKET"');
  if (made.status !== 0) throw new Error(`bucket creation failed:\n${made.output}`);

  return {
    suffix,
    network,
    image,
    bucket,
    databaseUrl,
    runImage,
    shell,
    psql,
    keys: (prefix) =>
      shell(`aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3api list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix "${prefix}/" --query 'Contents[].Key' --output text`)
        .output.split(/\s+/)
        .filter((key) => key !== '' && key !== 'None')
        .sort(),
    put: (key) => shell(`: | aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp - "s3://$BACKUP_BUCKET/${key}" --only-show-errors`),
    destroy: () => {
      docker(['rm', '-f', `${network}-pg`, `${network}-s3`]);
      docker(['network', 'rm', network]);
      docker(['image', 'rm', '-f', image]);
    },
  };
}

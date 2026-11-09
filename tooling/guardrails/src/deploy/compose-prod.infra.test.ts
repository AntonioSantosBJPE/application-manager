import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { repoRoot, run } from '../repo.js';

// Brings the production compose file up on this machine, from images built out of the repository's own
// Dockerfiles, with no registry and no Coolify. It needs Docker running; the first run builds both images.

const REPOSITORY = 'local/am-prod-test';
const TAG = 'infra-test';
/** A second version of the same images, to redeploy over a running stack. */
const TAG_NEXT = 'infra-test-next';
const env = {
  IMAGE_REPOSITORY: REPOSITORY,
  IMAGE_TAG: TAG,
  POSTGRES_USER: 'app',
  POSTGRES_PASSWORD: 'not-a-real-password',
  POSTGRES_DB: 'app',
  BACKUP_S3_ENDPOINT: 'http://localhost:9',
  BACKUP_S3_ACCESS_KEY_ID: 'key-id',
  BACKUP_S3_SECRET_ACCESS_KEY: 'key-secret',
  BACKUP_BUCKET: 'bucket',
};

const scratch = mkdtempSync(join(tmpdir(), 'compose-prod-'));
const projects: string[] = [];

/** A free TCP port on the loopback, for the test-only web port mapping. */
function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

/** Runs `docker compose` on the production file plus a test-only override, in its own project. */
function compose(project: string, override: string, args: string[], extra: Record<string, string> = {}) {
  const file = join(scratch, `${project}.override.yaml`);
  writeFileSync(file, override);
  if (!projects.includes(project)) projects.push(project);
  return run('docker', ['compose', '-p', project, '-f', 'infra/compose.prod.yaml', '-f', file, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env, WEB_PUBLIC_URL: 'http://localhost', ...extra },
  });
}

function smoke(url: string, timeout: string, expectedVersion?: string) {
  return run('bash', ['infra/deploy/smoke.sh', url], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SMOKE_INTERVAL: '2',
      SMOKE_TIMEOUT: timeout,
      ...(expectedVersion === undefined ? {} : { SMOKE_EXPECTED_VERSION: expectedVersion }),
    },
  });
}

describe('production compose, run locally', () => {
  beforeAll(() => {
    const build = run('docker', ['build', '-f', 'apps/api/Dockerfile', '-t', `${REPOSITORY}-api:${TAG}`, '.'], { cwd: repoRoot });
    expect(build.status, build.output.slice(-2000)).toBe(0);
    expect(run('docker', ['tag', `${REPOSITORY}-api:${TAG}`, `${REPOSITORY}-api:${TAG_NEXT}`]).status).toBe(0);
    // The web image carries the version it is built for, as the deploy workflow builds it.
    for (const tag of [TAG, TAG_NEXT]) {
      const web = run(
        'docker',
        ['build', '-f', 'apps/web/Dockerfile', '--build-arg', `APP_VERSION=${tag}`, '-t', `${REPOSITORY}-web:${tag}`, '.'],
        { cwd: repoRoot },
      );
      expect(web.status, web.output.slice(-2000)).toBe(0);
    }
  }, 900_000);

  afterAll(() => {
    for (const project of projects) {
      compose(project, 'services: {}\n', ['down', '--volumes', '--timeout', '1']);
    }
  }, 120_000);

  it('DEPLOY-17 serves /status with the API and the database operational, without Coolify or a registry', async () => {
    const port = await freePort();
    const override = `services:\n  web:\n    ports:\n      - "127.0.0.1:${port}:3000"\n`;
    const up = compose('am-prod-ok', override, ['up', '-d', 'web']);
    expect(up.status, up.output.slice(-2000)).toBe(0);

    const result = smoke(`http://127.0.0.1:${port}`, '120', TAG);
    expect(result.status, result.output).toBe(0);

    const page = await fetch(`http://127.0.0.1:${port}/status`);
    expect(page.status).toBe(200);
    expect(page.headers.get('x-app-version')).toBe(TAG);
    const text = (await page.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    expect(text).toContain('API Operacional');
    expect(text).toContain('Banco de dados Operacional');
  }, 300_000);

  it('DEPLOY-44 a migration that fails keeps the api from starting and the smoke test fails', async () => {
    const port = await freePort();
    const override =
      `services:\n  migrate:\n    command: ["sh", "-c", "echo migration failed; exit 1"]\n` +
      `  web:\n    ports:\n      - "127.0.0.1:${port}:3000"\n`;
    const up = compose('am-prod-bad-migration', override, ['up', '-d', 'web']);
    expect(up.status).not.toBe(0);

    const containers = compose('am-prod-bad-migration', override, ['ps', '--all', '--format', '{{.Service}} {{.State}}']);
    expect(containers.output).toMatch(/^migrate exited$/m);
    expect(containers.output).not.toMatch(/^api running$/m);

    const result = smoke(`http://127.0.0.1:${port}`, '4');
    expect(result.status).toBe(1);
  }, 300_000);

  it('DEPLOY-44 the old version answering while a deploy is under way does not pass the smoke test of the new one', async () => {
    const port = await freePort();
    const url = `http://127.0.0.1:${port}`;
    const up = compose('am-prod-old', `services:\n  web:\n    ports:\n      - "127.0.0.1:${port}:3000"\n`, ['up', '-d', 'web']);
    expect(up.status, up.output.slice(-2000)).toBe(0);
    expect(smoke(url, '120', TAG).status).toBe(0);

    // Coolify has not swapped the containers yet: the page is healthy, but it is the previous build.
    expect(smoke(url, '6').status).toBe(0);
    const result = smoke(url, '6', TAG_NEXT);
    expect(result.status).toBe(1);
    expect(result.output).toContain(`version seen: ${TAG}`);
    expect(result.output).toContain(`expected: ${TAG_NEXT}`);
  }, 300_000);

  it('DEPLOY-44 a redeploy whose migration fails over a running stack starts no new api or web, and the smoke test for the new version fails', async () => {
    const port = await freePort();
    const publish = `  web:\n    ports:\n      - "127.0.0.1:${port}:3000"\n`;
    const url = `http://127.0.0.1:${port}`;
    const first = compose('am-prod-redeploy', `services:\n${publish}`, ['up', '-d', 'web']);
    expect(first.status, first.output.slice(-2000)).toBe(0);
    expect(smoke(url, '120', TAG).status).toBe(0);

    const broken = `services:\n  migrate:\n    command: ["sh", "-c", "echo migration failed; exit 1"]\n${publish}`;
    const second = compose('am-prod-redeploy', broken, ['up', '-d', 'web'], { IMAGE_TAG: TAG_NEXT });
    expect(second.status).not.toBe(0);

    // Compose replaced the containers before the migration ran: the new api and web exist but never start.
    const states = compose('am-prod-redeploy', broken, ['ps', '--all', '--format', '{{.Service}} {{.State}}'], { IMAGE_TAG: TAG_NEXT }).output;
    expect(states).toMatch(/^migrate exited$/m);
    expect(states).not.toMatch(/^api running$/m);
    expect(states).not.toMatch(/^web running$/m);

    const result = smoke(url, '6', TAG_NEXT);
    expect(result.status).toBe(1);
  }, 300_000);
});

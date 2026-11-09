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

function smoke(url: string, timeout: string) {
  return run('bash', ['infra/deploy/smoke.sh', url], {
    cwd: repoRoot,
    env: { ...process.env, SMOKE_INTERVAL: '2', SMOKE_TIMEOUT: timeout },
  });
}

describe('production compose, run locally', () => {
  beforeAll(() => {
    for (const name of ['api', 'web']) {
      const build = run('docker', ['build', '-f', `apps/${name}/Dockerfile`, '-t', `${REPOSITORY}-${name}:${TAG}`, '.'], {
        cwd: repoRoot,
      });
      expect(build.status, build.output.slice(-2000)).toBe(0);
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

    const result = smoke(`http://127.0.0.1:${port}`, '120');
    expect(result.status, result.output).toBe(0);

    const page = await fetch(`http://127.0.0.1:${port}/status`);
    expect(page.status).toBe(200);
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
});

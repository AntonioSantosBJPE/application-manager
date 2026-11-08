import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const apiRoot = join(import.meta.dirname, '..');

// `main.js` imports the whole app graph (Nest, Express, pg, drizzle) before `loadEnv()` rejects the missing
// variable. That is ~1 s of CPU, ~0.8 s alone and several seconds when the whole suite runs in parallel
// (`pnpm test:repo-rules`), so the default 5 s test timeout is too tight. The child's own timeout stays below
// the test's so a hung process is reported by `spawnSync` and not as a generic test timeout.
const ENTRYPOINT_TIMEOUT = 25_000;
const TEST_TIMEOUT = 30_000;

describe('api entrypoint', () => {
  // The spec names the built process (`node dist/main.js`), so the test builds it first.
  beforeAll(() => {
    const build = spawnSync('pnpm', ['exec', 'nest', 'build', '-b', 'swc'], { cwd: apiRoot, encoding: 'utf8' });
    expect(build.status, build.stdout + build.stderr).toBe(0);
  }, 60_000);

  it('exits non-zero naming DATABASE_URL when it is missing', () => {
    const run = spawnSync(process.execPath, ['dist/main.js'], {
      cwd: apiRoot,
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
      timeout: ENTRYPOINT_TIMEOUT,
    });

    expect(run.status).not.toBe(0);
    expect(run.status).not.toBeNull();
    expect(run.stderr).toContain('Missing required environment variable: DATABASE_URL');
  }, TEST_TIMEOUT);
});

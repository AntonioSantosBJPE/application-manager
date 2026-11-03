import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const apiRoot = join(import.meta.dirname, '..');

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
      timeout: 10_000,
    });

    expect(run.status).not.toBe(0);
    expect(run.status).not.toBeNull();
    expect(run.stderr).toContain('Missing required environment variable: DATABASE_URL');
  });
});

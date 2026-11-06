import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const webRoot = join(import.meta.dirname, '..');
const baseEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
const webPublicUrl = 'http://localhost:3000';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

describe('web production server', () => {
  // The criteria name the built server (`pnpm start` over dist/), so the test builds it first.
  beforeAll(() => {
    // Vitest sets NODE_ENV=test, which would make Vite bundle the development JSX runtime.
    const build = spawnSync('pnpm', ['exec', 'vite', 'build'], {
      cwd: webRoot,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    expect(build.status, build.stdout + build.stderr).toBe(0);
  }, 120_000);

  it('builds dist/client and dist/server', () => {
    expect(existsSync(join(webRoot, 'dist/client'))).toBe(true);
    expect(existsSync(join(webRoot, 'dist/server/server.js'))).toBe(true);
  });

  it('exits non-zero naming API_INTERNAL_URL when it is missing', () => {
    const run = spawnSync('pnpm', ['start'], {
      cwd: webRoot,
      encoding: 'utf8',
      env: baseEnv,
      timeout: 15_000,
    });

    expect(run.status).not.toBe(0);
    expect(run.status).not.toBeNull();
    expect(run.stderr).toContain('Missing required environment variable: API_INTERNAL_URL');
  });

  it('exits non-zero naming WEB_PUBLIC_URL when only API_INTERNAL_URL is set', () => {
    const run = spawnSync('pnpm', ['start'], {
      cwd: webRoot,
      encoding: 'utf8',
      env: { ...baseEnv, API_INTERNAL_URL: 'http://127.0.0.1:9' },
      timeout: 15_000,
    });

    expect(run.status).not.toBe(0);
    expect(run.status).not.toBeNull();
    expect(run.stderr).toContain('Missing required environment variable: WEB_PUBLIC_URL');
  });

  it('serves the app on PORT when API_INTERNAL_URL and WEB_PUBLIC_URL are present', async () => {
    const port = await freePort();
    // Detached so the kill reaches srvx, not only the pnpm wrapper.
    const server = spawn('pnpm', ['start'], {
      cwd: webRoot,
      env: {
        ...baseEnv,
        PORT: String(port),
        API_INTERNAL_URL: 'http://127.0.0.1:9',
        WEB_PUBLIC_URL: webPublicUrl,
      },
      detached: true,
      stdio: 'ignore',
    });
    try {
      let status = 0;
      for (let attempt = 0; attempt < 50 && status !== 200; attempt++) {
        status = await fetch(`http://127.0.0.1:${port}/status`).then(
          (response) => response.status,
          () => 0,
        );
        if (status !== 200) await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(status).toBe(200);
    } finally {
      if (server.pid) process.kill(-server.pid, 'SIGTERM');
    }
  }, 20_000);

  it('answers a path other than /status with Cache-Control no-store', async () => {
    const port = await freePort();
    const server = spawn('pnpm', ['start'], {
      cwd: webRoot,
      env: {
        ...baseEnv,
        PORT: String(port),
        API_INTERNAL_URL: 'http://127.0.0.1:9',
        WEB_PUBLIC_URL: webPublicUrl,
      },
      detached: true,
      stdio: 'ignore',
    });
    try {
      // The rule is about the path, not the route: this app has no page at / yet, and the header is
      // still the one a private page gets, so no proxy in front of the web may cache it.
      let response: Response | undefined;
      for (let attempt = 0; attempt < 50; attempt++) {
        response = await fetch(`http://127.0.0.1:${port}/`).catch(() => undefined);
        if (response !== undefined) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      expect(response?.headers.get('cache-control')).toBe('no-store');
    } finally {
      if (server.pid) process.kill(-server.pid, 'SIGTERM');
    }
  }, 20_000);
});

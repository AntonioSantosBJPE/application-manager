import { resolve } from 'node:path';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

// The compose project, the ports and the credentials come from the .env of this checkout (SKEL-13).
try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../.env'));
} catch {
  // No .env: the compose file requires its variables, so copy .env.example first.
}

const webPort = process.env.WEB_PORT ?? '3000';

type Project = NonNullable<PlaywrightTestConfig['projects']>[number];

const images: Project = { name: 'images', testMatch: 'images/**/*.spec.ts' };
const teardown: Project = { name: 'teardown', testMatch: 'setup/**/*.teardown.ts' };
const setup = (dependencies: string[]): Project => ({ name: 'setup', testMatch: 'setup/**/*.setup.ts', dependencies, teardown: 'teardown' });
const stack: Project = { name: 'stack', testMatch: 'stack/**/*.spec.ts', dependencies: ['setup'] };
const browser = (dependencies: string[]): Project => ({
  name: 'browser',
  testMatch: 'browser/**/*.spec.ts',
  dependencies,
  use: { ...devices['Desktop Chrome'] },
});
// These specs stop, pause and restart services, so nothing may run against the stack after them.
const disruption = (dependencies: string[]): Project => ({ name: 'disruption', testMatch: 'disruption/**/*.spec.ts', dependencies });

/**
 * The projects of a run. Without E2E_GROUP (`pnpm test:e2e`), one chain on one stack: the images are
 * inspected, the stack starts, then the stack, browser and disruption specs run (disruption last), then
 * the stack is removed. CI splits the same specs into groups, each on a stack of its own, so the suite
 * grows by adding shards instead of minutes:
 * - `platform`: images, stack and disruption specs, one job;
 * - `browser`: the browser specs only, sharded by file with `--shard` across parallel jobs.
 */
function projectsFor(group: string | undefined): Project[] {
  switch (group) {
    case undefined:
    case '':
      return [images, setup(['images']), teardown, stack, browser(['stack']), disruption(['browser'])];
    case 'platform':
      return [images, setup(['images']), teardown, stack, disruption(['stack'])];
    case 'browser':
      return [setup([]), teardown, browser(['setup'])];
    default:
      throw new Error(`E2E_GROUP must be empty, platform or browser (got ${group})`);
  }
}

export default defineConfig({
  testDir: './specs',
  reporter: [['list']],
  // Tests that stop services cannot overlap with any other test.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  use: { baseURL: `http://localhost:${webPort}` },
  projects: projectsFor(process.env.E2E_GROUP),
});


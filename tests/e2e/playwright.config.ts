import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// The compose project, the ports and the credentials come from the .env of this checkout (SKEL-13).
try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../.env'));
} catch {
  // No .env: the compose file requires its variables, so copy .env.example first.
}

const webPort = process.env.WEB_PORT ?? '3000';

export default defineConfig({
  testDir: './specs',
  reporter: [['list']],
  // Tests that stop services cannot overlap with any other test.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  use: { baseURL: `http://localhost:${webPort}` },
  // One chain, in order: the images are inspected, the stack starts, then the stack, browser and
  // disruption specs run against it (disruption last: it stops services), then the stack is removed.
  projects: [
    // Builds the production images itself, so it needs no running stack.
    { name: 'images', testMatch: 'images/**/*.spec.ts' },
    { name: 'setup', testMatch: 'setup/**/*.setup.ts', dependencies: ['images'], teardown: 'teardown' },
    { name: 'teardown', testMatch: 'setup/**/*.teardown.ts' },
    { name: 'stack', testMatch: 'stack/**/*.spec.ts', dependencies: ['setup'] },
    { name: 'browser', testMatch: 'browser/**/*.spec.ts', dependencies: ['stack'], use: { ...devices['Desktop Chrome'] } },
    // Last: these specs stop, pause and restart services.
    { name: 'disruption', testMatch: 'disruption/**/*.spec.ts', dependencies: ['browser'] },
  ],
});

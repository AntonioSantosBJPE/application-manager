import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

// The compose project, the ports and the credentials come from the .env of this checkout (SKEL-13).
try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../.env'));
} catch {
  // No .env: the compose defaults apply.
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
  projects: [
    // Inspects the production images; builds them itself, so it needs no running stack.
    { name: 'images', testDir: './specs/images' },
  ],
});

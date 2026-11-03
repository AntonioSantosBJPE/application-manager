import { defineConfig } from 'vitest/config';

// Guard-rail tests drive git, pnpm and Docker, so they get generous timeouts.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});

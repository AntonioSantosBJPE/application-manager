import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// vitest.config.ts replaces vite.config.ts, so merge it to keep the Tailwind plugin.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: ['src/**/*.browser.test.{ts,tsx}'],
            setupFiles: ['./vitest.setup.ts'],
          },
        },
        {
          // Proves what Chromium paints with tokens.css loaded: themes, focus ring, motion (PRU-01).
          extends: true,
          test: {
            name: 'browser',
            include: ['src/**/*.browser.test.{ts,tsx}'],
            setupFiles: ['./vitest.browser.setup.ts'],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: 'chromium' }],
            },
          },
        },
        {
          // Renders every story in Chromium headless; a story that throws fails the run (DS-03).
          extends: true,
          plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: 'chromium' }],
            },
          },
        },
      ],
    },
  }),
);

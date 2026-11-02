import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compiles the Nest decorators and their metadata, which esbuild does not emit.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.int.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int.test.ts'],
        },
      },
    ],
  },
});

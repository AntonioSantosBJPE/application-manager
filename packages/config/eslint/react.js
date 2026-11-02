import { defineConfig } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import base from './base.js';

/** Flat config for React code: the base preset plus the rules of hooks. */
export default defineConfig(base, reactHooks.configs.flat.recommended, {
  languageOptions: {
    globals: { ...globals.browser },
  },
});

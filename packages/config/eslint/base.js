import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Flat config shared by every workspace: JavaScript and TypeScript recommended rules. */
export default defineConfig(js.configs.recommended, tseslint.configs.recommended, {
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    globals: { ...globals.node },
  },
});

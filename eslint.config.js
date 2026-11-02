import base from '@am/config/eslint/base';
import { defineConfig, globalIgnores } from 'eslint/config';

// Root flat config. ESLint finds it from every workspace, so `eslint .` in any
// workspace applies these rules with paths relative to the repository root.
export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/.turbo/',
    '**/coverage/',
    '**/storybook-static/',
    // Guard-rail fixtures hold violations on purpose; the tests lint them explicitly.
    'tooling/guardrails/fixtures/',
  ]),
  base,
);

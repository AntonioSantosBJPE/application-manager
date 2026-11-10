import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './repo.js';

// scripts/ci-scopes.sh decides which slow suites a pull request runs. A path it misses lets a break reach
// main unseen, so each suite is checked against the paths it proves and against paths it must ignore.

type Scopes = { repo_rules: boolean; e2e: boolean; infra: boolean };

function scopes(...paths: string[]): Scopes {
  const result = spawnSync('bash', [join(repoRoot, 'scripts/ci-scopes.sh')], { input: paths.join('\n'), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  const values = Object.fromEntries(
    result.stdout
      .trim()
      .split('\n')
      .map((line) => line.split('=') as [string, string]),
  );
  expect(Object.keys(values).sort()).toEqual(['e2e', 'infra', 'repo_rules']);
  for (const value of Object.values(values)) expect(['true', 'false']).toContain(value);
  return { repo_rules: values.repo_rules === 'true', e2e: values.e2e === 'true', infra: values.infra === 'true' };
}

const none: Scopes = { repo_rules: false, e2e: false, infra: false };
const all: Scopes = { repo_rules: true, e2e: true, infra: true };

describe('ci scopes', () => {
  it('runs no slow suite for documentation, specs and design', () => {
    expect(scopes('docs/workflow.md', '.specs/features/x/spec.md', '.design/application-manager.md', 'README.md', 'AGENTS.md')).toEqual(none);
    expect(scopes()).toEqual(none);
  });

  it('runs everything when the CI itself or this script changes', () => {
    expect(scopes('.github/workflows/ci.yml')).toEqual(all);
    expect(scopes('.github/workflows/deploy.yml')).toEqual(all);
    expect(scopes('.github/actions/setup/action.yml')).toEqual(all);
    expect(scopes('scripts/ci-scopes.sh')).toEqual(all);
  });

  it.each([
    'apps/web/src/features/applications/components/list.tsx',
    'apps/api/src/modules/skills/skills.service.ts',
    'packages/ui/src/button/button.tsx',
    'packages/contracts/src/index.ts',
    'tests/e2e/specs/browser/identity.spec.ts',
    'compose.yaml',
    '.dockerignore',
    '.env.example',
  ])('runs the end-to-end specs when %s changes', (path) => {
    expect(scopes(path).e2e).toBe(true);
  });

  it.each([
    'package.json',
    'apps/web/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'turbo.json',
    'packages/config/tsconfig.base.json',
    'apps/api/tsconfig.json',
    'eslint.config.js',
    'packages/ui/eslint.config.js',
    'apps/api/vitest.config.ts',
    '.dependency-cruiser.cjs',
    'packages/config/eslint/index.js',
    'packages/ui/.storybook/main.ts',
    'tooling/guardrails/src/root-commands.test.ts',
    '.nvmrc',
  ])('runs the repository rules when %s changes', (path) => {
    expect(scopes(path).repo_rules).toBe(true);
  });

  it.each([
    'infra/compose.prod.yaml',
    'infra/backup/backup.sh',
    'infra/provision/harden.sh',
    'infra/deploy/smoke.sh',
    'apps/api/Dockerfile',
    'apps/web/Dockerfile',
    'apps/api/drizzle/0007_new.sql',
    'tooling/guardrails/src/deploy/backup.infra.test.ts',
  ])('runs the infrastructure tests when %s changes', (path) => {
    expect(scopes(path).infra).toBe(true);
  });

  it('keeps a feature change out of the suites it does not touch', () => {
    // An application change: browser specs yes; repository rules and the deploy infrastructure no.
    expect(scopes('apps/web/src/routes/_member/index.tsx', 'apps/api/src/modules/resume/resume.controller.ts')).toEqual({
      repo_rules: false,
      e2e: true,
      infra: false,
    });
    // A migration also replays in the restore test.
    expect(scopes('apps/api/drizzle/0008_resume.sql').infra).toBe(true);
    // A guardrail unrelated to deploy: repository rules only.
    expect(scopes('tooling/guardrails/src/code-patterns.test.ts')).toEqual({ repo_rules: true, e2e: false, infra: false });
  });

  it('reads the last path even without a trailing newline and ignores blank lines', () => {
    const result = spawnSync('bash', [join(repoRoot, 'scripts/ci-scopes.sh')], { input: '\n\ninfra/deploy/smoke.sh', encoding: 'utf8' });
    expect(result.stdout).toContain('infra=true');
  });
});

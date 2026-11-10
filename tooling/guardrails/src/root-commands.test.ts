import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { repoRoot, run, type RunResult } from './repo.js';

// These tests run the real root commands (`pnpm lint`, `pnpm typecheck`, `pnpm test`) in a
// temporary copy of the repository with a violation planted, so the working tree is never touched.
// The copy holds the files git knows (tracked, plus new files that are not ignored) and is installed
// from the local pnpm store, so it is as independent of the working tree as a fresh clone.

const SLOW = 600_000;
const PLANTED = 'planted-violation';

interface Workspace {
  /** Directory relative to the repository root. */
  dir: string;
  name: string;
  /** Directory, relative to the workspace, that its tsconfig and ESLint cover. */
  source: string;
  ext: 'ts' | 'js';
}

const workspaces: Workspace[] = [
  { dir: 'apps/api', name: '@am/api', source: 'src', ext: 'ts' },
  { dir: 'apps/web', name: '@am/web', source: 'src', ext: 'ts' },
  { dir: 'packages/config', name: '@am/config', source: 'eslint', ext: 'js' },
  { dir: 'packages/contracts', name: '@am/contracts', source: 'src', ext: 'ts' },
  { dir: 'packages/ui', name: '@am/ui', source: 'src', ext: 'ts' },
  { dir: 'tooling/guardrails', name: '@am/guardrails', source: 'src', ext: 'ts' },
  { dir: 'tests/e2e', name: '@am/e2e', source: 'specs', ext: 'ts' },
];

const LINT_VIOLATION = 'debugger;\n';
const TYPE_VIOLATION: Record<Workspace['ext'], string> = {
  ts: "export const planted: number = 'not a number';\n",
  js: "/** @type {number} */\nexport const planted = 'not a number';\n",
};

/** One import per dependency-cruiser rule (GUARD-06..08), planted together in a single `pnpm lint` run. */
const boundaryViolations = {
  'no-cross-app': {
    file: 'apps/web/src/planted-cross-app.ts',
    to: 'apps/api/src/infra/logging/request-id.ts',
    content: "export { resolveRequestId } from '../../api/src/infra/logging/request-id';\n",
  },
  'no-feature-internals': {
    file: 'apps/web/src/features/billing/components/invoice.ts',
    to: 'apps/web/src/features/system-status/model/system-status.ts',
    content: "export { toSystemStatus } from '../../system-status/model/system-status';\n",
  },
  'no-module-internals': {
    file: 'apps/api/src/modules/billing/billing.service.ts',
    to: 'apps/api/src/modules/health/database-probe.ts',
    content: "export { DatabaseProbe } from '../health/database-probe.js';\n",
  },
} as const;

function gitFiles(): string[] {
  const listing = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return listing.stdout.split('\0').filter((file) => file !== '' && existsSync(join(repoRoot, file)));
}

/** The tasks turbo lists as failed in the summary of a run (`Failed:    @am/api#lint, @am/web#lint`), sorted. */
function failedTasks(output: string): string[] {
  const line = output.split('\n').find((candidate) => /^\s*Failed:\s/.test(candidate));
  return (line ?? '').replace(/^\s*Failed:\s*/, '').split(',').map((task) => task.trim()).filter(Boolean).sort();
}

function createCopy(): string {
  const root = mkdtempSync(join(tmpdir(), 'am-root-commands-'));
  for (const file of gitFiles()) {
    const destination = join(root, file);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(repoRoot, file), destination, { verbatimSymlinks: true });
  }
  // The copy gets its own node_modules from the local pnpm store: offline, from the lockfile, and without
  // lifecycle scripts (so no git hooks are installed and nothing is downloaded or built).
  const install = run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], {
    cwd: root,
    env: { ...process.env, CI: '1', LEFTHOOK: '0' },
  });
  expect(install.status, install.output).toBe(0);
  return root;
}

describe('root commands', () => {
  let copy: string;
  let env: NodeJS.ProcessEnv;

  /** Runs a root script (`pnpm <script> [args]`) in the copy. */
  const pnpm = (...args: string[]) => run('pnpm', args, { cwd: copy, env });

  /** Plants several files (creating their folders), runs `fn`, and removes what it created. */
  function plantedAll<T>(files: { file: string; content: string }[], fn: () => T): T {
    const created: string[] = [];
    for (const { file, content } of files) {
      let first = dirname(join(copy, file));
      while (!existsSync(dirname(first))) first = dirname(first);
      if (!existsSync(first)) created.push(first);
      mkdirSync(dirname(join(copy, file)), { recursive: true });
      writeFileSync(join(copy, file), content);
      created.push(join(copy, file));
    }
    try {
      return fn();
    } finally {
      for (const path of created) rmSync(path, { recursive: true, force: true });
    }
  }

  /** `pnpm lint` with every boundary violation planted, run once for the three boundary tests. */
  let boundaryLint: RunResult | undefined;
  function lintWithBoundaryViolations() {
    boundaryLint ??= plantedAll(Object.values(boundaryViolations), () => pnpm('lint'));
    return boundaryLint;
  }

  /** The err reporter line of dependency-cruiser: `<rule>: <file> → <import>`. */
  function expectBoundaryViolation(rule: keyof typeof boundaryViolations) {
    const { file, to } = boundaryViolations[rule];
    const result = lintWithBoundaryViolations();
    expect(result.status, result.output).not.toBe(0);
    expect(result.output).toContain(`${rule}: ${file} → ${to}`);
  }

  beforeAll(() => {
    copy = createCopy();
    env = { ...process.env };
    // Nothing from a surrounding CI or git hook leaks into the copy; turbo keeps its own cache and always re-runs.
    for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
    // Under GitHub Actions turbo and ESLint switch to annotation output that drops the file names these tests look for.
    delete env.GITHUB_ACTIONS;
    Object.assign(env, {
      TURBO_CACHE_DIR: join(copy, '.turbo-cache'),
      TURBO_FORCE: 'true',
      TURBO_TELEMETRY_DISABLED: '1',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    });
  }, SLOW);

  afterAll(() => {
    if (copy) rmSync(copy, { recursive: true, force: true });
  });

  it('pnpm lint runs eslint in every workspace and fails on a violation in each', () => {
    // A clean repository passes: nothing but the planted files can make the command fail.
    const clean = pnpm('lint');
    expect(clean.status, clean.output).toBe(0);
    for (const { name } of workspaces) expect(clean.output, `eslint did not run in ${name}`).toContain(`${name}:lint`);

    // One violation in every workspace, one run: `turbo --continue` lets each workspace fail on its own, so
    // the cost stays one lint run however many workspaces there are.
    const files = workspaces.map(({ dir, source, ext }) => ({ file: `${dir}/${source}/${PLANTED}.${ext}`, content: LINT_VIOLATION }));
    const result = plantedAll(files, () => pnpm('lint'));
    expect(result.status, result.output).not.toBe(0);
    expect(failedTasks(result.output), 'every workspace lint fails').toEqual(workspaces.map(({ name }) => `${name}#lint`).sort());
    for (const [index, { name }] of workspaces.entries()) {
      const { file } = files[index]!;
      // The error is reported by that workspace's own eslint run, naming the file.
      const reported = result.output.split('\n').some((line) => line.includes(`${name}:lint`) && line.includes(file));
      expect(reported, `${name} does not name ${file}:\n${result.output}`).toBe(true);
    }
    expect(result.output).toMatch(/no-debugger/);
  }, SLOW);

  it('pnpm lint fails an app importing another app naming file and import', () => {
    expectBoundaryViolation('no-cross-app');
  }, SLOW);

  it('pnpm lint fails a feature importing another feature internals naming file and import', () => {
    expectBoundaryViolation('no-feature-internals');
  }, SLOW);

  it('pnpm lint fails a module importing another module internals naming file and import', () => {
    expectBoundaryViolation('no-module-internals');
  }, SLOW);

  it('pnpm typecheck fails on a type error in any workspace', () => {
    const clean = pnpm('typecheck');
    expect(clean.status, clean.output).toBe(0);

    // One type error in every workspace, one run (see the lint test).
    const files = workspaces.map(({ dir, source, ext }) => ({ file: `${dir}/${source}/${PLANTED}.${ext}`, content: TYPE_VIOLATION[ext] }));
    const result = plantedAll(files, () => pnpm('typecheck'));
    expect(result.status, result.output).not.toBe(0);
    const failed = failedTasks(result.output);
    for (const { dir, name, source, ext } of workspaces) {
      // Turbo builds a dependency before the dependants' typecheck, so the error in a package with a build
      // (@am/contracts) is reported by its build, which compiles the same files.
      expect(failed.includes(`${name}#typecheck`) || failed.includes(`${name}#build`), `${name} has a failed task: ${failed.join(', ')}`).toBe(true);
      // tsc prints the path relative to the workspace.
      const reported = result.output
        .split('\n')
        .some(
          (line) =>
            (line.includes(`${name}:typecheck`) || line.includes(`${name}:build`)) &&
            line.includes(`${source}/${PLANTED}.${ext}`) &&
            /TS2322/.test(line),
        );
      expect(reported, `${name} does not report a type error in ${dir}/${source}/${PLANTED}.${ext}:\n${result.output}`).toBe(true);
    }
  }, SLOW);

  it('pnpm test runs vitest in every workspace and fails on a failing test in each', () => {
    // Workspaces holding Vitest test files: the nearest package.json above each *.test.ts(x).
    const owners = new Map<string, string>(workspaces.map((workspace) => [workspace.dir, workspace.name]));
    const expected = new Set<string>();
    for (const file of gitFiles().filter((candidate) => /\.test\.tsx?$/.test(candidate))) {
      const owner = workspaces.find((workspace) => file.startsWith(`${workspace.dir}/`));
      expect(owner, `${file} is outside every workspace`).toBeDefined();
      expected.add(owners.get(owner!.dir)!);
    }
    expect([...expected].sort(), 'workspaces with Vitest test files').toEqual(
      ['@am/api', '@am/contracts', '@am/guardrails', '@am/ui', '@am/web'],
    );

    // `pnpm test` is `turbo run test`; the dry run lists what it would execute.
    const dry = spawnSync('pnpm', ['test', '--dry=json'], { cwd: copy, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(dry.status, dry.stderr).toBe(0);
    const plan = JSON.parse(dry.stdout.slice(dry.stdout.indexOf('{'))) as {
      tasks: { package: string; task: string; command: string }[];
    };
    // Turbo also lists the workspaces without a `test` script, with no command.
    const tests = plan.tasks.filter((task) => task.task === 'test' && task.command !== '<NONEXISTENT>');
    expect(tests.map((task) => task.package).sort(), 'workspaces `pnpm test` runs').toEqual([...expected].sort());
    for (const task of tests) expect(task.command, task.package).toMatch(/^vitest run/);

    // And it really runs them, and fails on a failing test: one failing test is planted in every workspace
    // (in @am/ui a story that throws, which its storybook project renders) and `pnpm test` runs, through
    // turbo, only the planted files (the trailing argument is handed to each `vitest run` as a file filter),
    // so the cost stays one short run however many tests the workspaces hold. The recursion guard: the
    // guardrails workspace holds this very file, whose copy would start another copy, so it is left out
    // here (`--filter` is passed through to turbo); the dry run above already showed it runs `vitest run`.
    const story = `import type { Meta, StoryObj } from '@storybook/react-vite';

function Broken(): never {
  throw new Error('planted story failure');
}

const meta = { title: 'Planted/Broken', component: Broken } satisfies Meta<typeof Broken>;

export default meta;
export const Throws: StoryObj<typeof meta> = {};
`;
    const failingTest = `import { expect, it } from 'vitest';

it('planted test failure', () => {
  expect('planted').toBe('a pass');
});
`;
    const runners = [...expected].filter((candidate) => candidate !== '@am/guardrails');
    const files = runners.flatMap((name) => {
      const { dir, source } = workspaces.find((workspace) => workspace.name === name)!;
      return name === '@am/ui'
        ? [{ file: `${dir}/${source}/${PLANTED}.stories.tsx`, content: story }]
        : [{ file: `${dir}/${source}/${PLANTED}.test.ts`, content: failingTest }];
    });
    const real = plantedAll(files, () => pnpm('test', '--filter=!@am/guardrails', '--continue=always', '--', PLANTED));
    expect(real.status, real.output).not.toBe(0);
    expect(failedTasks(real.output), 'every workspace test fails').toEqual(runners.map((name) => `${name}#test`).sort());
    for (const name of runners) {
      const lines = real.output.split('\n').filter((line) => line.includes(`${name}:test`));
      expect(lines.some((line) => /Tests\s+1 failed/.test(line)), `vitest did not report the planted failure in ${name}:\n${real.output}`).toBe(true);
    }
    expect(real.output).toMatch(/planted story failure/);
    expect(real.output).toMatch(/planted-violation\.stories\.tsx/);
    expect(real.output).toMatch(/planted test failure/);
  }, SLOW);
});

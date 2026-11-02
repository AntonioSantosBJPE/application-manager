import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { repoRoot, run } from './repo.js';

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

function gitFiles(): string[] {
  const listing = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return listing.stdout.split('\0').filter((file) => file !== '' && existsSync(join(repoRoot, file)));
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

  /** Plants a file in the copy, runs `fn`, and removes the file again. */
  function planted<T>(file: string, content: string, fn: () => T): T {
    const path = join(copy, file);
    writeFileSync(path, content);
    try {
      return fn();
    } finally {
      rmSync(path, { force: true });
    }
  }

  beforeAll(() => {
    copy = createCopy();
    env = { ...process.env };
    // Nothing from a surrounding CI or git hook leaks into the copy; turbo keeps its own cache and always re-runs.
    for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
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

  it('pnpm lint runs eslint in every workspace and fails on a violation', () => {
    // A clean repository passes: nothing but the planted file can make the command fail.
    const clean = pnpm('lint');
    expect(clean.status, clean.output).toBe(0);
    for (const { name } of workspaces) expect(clean.output, `eslint did not run in ${name}`).toContain(`${name}:lint`);

    for (const { dir, name, source, ext } of workspaces) {
      const file = `${dir}/${source}/${PLANTED}.${ext}`;
      const result = planted(file, LINT_VIOLATION, () => pnpm('lint'));
      expect(result.status, `${name}: ${result.output}`).not.toBe(0);
      // The error is reported by that workspace's own eslint run, naming the file.
      const reported = result.output.split('\n').some((line) => line.includes(`${name}:lint`) && line.includes(file));
      expect(reported, `${name} does not name ${file}:\n${result.output}`).toBe(true);
      expect(result.output).toMatch(/no-debugger/);
    }
  }, SLOW);

  it('pnpm typecheck fails on a type error in any workspace', () => {
    const clean = pnpm('typecheck');
    expect(clean.status, clean.output).toBe(0);

    for (const { dir, name, source, ext } of workspaces) {
      const file = `${dir}/${source}/${PLANTED}.${ext}`;
      const result = planted(file, TYPE_VIOLATION[ext], () => pnpm('typecheck'));
      expect(result.status, `${name}: ${result.output}`).not.toBe(0);
      // tsc prints the path relative to the workspace. Turbo builds a dependency before the dependants'
      // typecheck, so the error in a package with a build (@am/contracts) is first reported by its build,
      // which compiles the same files.
      const reported = result.output
        .split('\n')
        .some(
          (line) =>
            (line.includes(`${name}:typecheck`) || line.includes(`${name}:build`)) &&
            line.includes(`${source}/${PLANTED}.${ext}`) &&
            /TS2322/.test(line),
        );
      expect(reported, `${name} does not report a type error in ${file}:\n${result.output}`).toBe(true);
    }
  }, SLOW);

  it('pnpm test runs vitest in every workspace', () => {
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

    // And it really runs them. The recursion guard: the guardrails workspace holds this very file, whose
    // copy would start another copy, so it is left out here (`--filter` is passed through to turbo); the
    // dry run above already showed it runs `vitest run`.
    const real = pnpm('test', '--filter=!@am/guardrails');
    expect(real.status, real.output).toBe(0);
    for (const name of [...expected].filter((candidate) => candidate !== '@am/guardrails')) {
      const lines = real.output.split('\n').filter((line) => line.includes(`${name}:test`));
      expect(lines.some((line) => /Tests\s+\d+ passed/.test(line)), `vitest did not report passing tests in ${name}`).toBe(true);
    }
  }, SLOW);

  it('pnpm test fails when a packages/ui story throws', () => {
    const story = `import type { Meta, StoryObj } from '@storybook/react-vite';

function Broken(): never {
  throw new Error('planted story failure');
}

const meta = { title: 'Planted/Broken', component: Broken } satisfies Meta<typeof Broken>;

export default meta;
export const Throws: StoryObj<typeof meta> = {};
`;
    // The `test` script of @am/ui, which `pnpm test` runs through turbo (the other workspaces are not in play).
    const result = planted('packages/ui/src/planted-violation.stories.tsx', story, () => pnpm('test', '--filter=@am/ui'));
    expect(result.status, result.output).not.toBe(0);
    expect(result.output).toMatch(/planted story failure/);
    expect(result.output).toMatch(/planted-violation\.stories\.tsx/);
  }, SLOW);
});

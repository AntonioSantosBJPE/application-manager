import { randomInt } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { repoRoot, run } from './repo.js';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'am-guardrails-'));
  tempDirs.push(dir);
  return dir;
}

/** Environment without git variables a parent hook could leak into the child repository. */
function cleanEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('GIT_')) env[key] = value;
  }
  return { ...env, ...extra };
}

function git(cwd: string, args: string[], env = cleanEnv()) {
  return run(
    'git',
    ['-c', 'user.name=Guardrails Test', '-c', 'user.email=guardrails@example.test', '-c', 'commit.gpgsign=false', ...args],
    { cwd, env },
  );
}

/** Copies a repository file to the same relative path inside `target`. */
function copyFromRepo(target: string, relativePath: string): void {
  const destination = join(target, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(repoRoot, relativePath), destination);
}

/** A fictitious AWS access key id, generated at run time so no key is ever committed. */
function fakeAwsAccessKeyId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let suffix = '';
  for (let i = 0; i < 16; i++) suffix += alphabet[randomInt(alphabet.length)];
  return `AKIA${suffix}`;
}

/** A fresh repository with the project's lefthook config and scan script, hooks installed. */
function repoWithHooks(): string {
  const dir = tempDir();
  expect(git(dir, ['init', '-q']).status).toBe(0);
  copyFromRepo(dir, 'lefthook.yml');
  copyFromRepo(dir, 'scripts/gitleaks-staged.sh');
  const install = run(join(repoRoot, 'node_modules/.bin/lefthook'), ['install'], { cwd: dir, env: cleanEnv() });
  expect(install.status, install.output).toBe(0);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('pre-commit secrets', () => {
  it('blocks a staged aws key naming the file', () => {
    const dir = repoWithHooks();
    mkdirSync(join(dir, 'config'));
    writeFileSync(join(dir, 'config/credentials.txt'), `aws_access_key_id = ${fakeAwsAccessKeyId()}\n`);
    expect(git(dir, ['add', '.']).status).toBe(0);

    const commit = git(dir, ['commit', '-m', 'add credentials']);

    expect(commit.status).not.toBe(0);
    expect(commit.output).toContain('config/credentials.txt');
    expect(git(dir, ['rev-parse', '--verify', '-q', 'HEAD']).status).not.toBe(0);
  });

  it('lets a commit without secrets through', () => {
    const dir = repoWithHooks();
    writeFileSync(join(dir, 'notes.txt'), 'nothing sensitive here\n');
    expect(git(dir, ['add', '.']).status).toBe(0);

    const commit = git(dir, ['commit', '-m', 'add notes']);

    expect(commit.status, commit.output).toBe(0);
    expect(git(dir, ['log', '--format=%s', '-1']).output.trim()).toBe('add notes');
  });

  /** A project with the root manifest's lefthook and `prepare` script, the workspace build policy and the hook config. */
  function projectWithHooksConfig(dir: string): void {
    const rootManifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'hooks-install-check',
        private: true,
        packageManager: rootManifest.packageManager,
        scripts: { prepare: rootManifest.scripts.prepare },
        devDependencies: { lefthook: rootManifest.devDependencies.lefthook },
      }),
    );
    copyFromRepo(dir, 'pnpm-workspace.yaml');
    copyFromRepo(dir, 'lefthook.yml');
    copyFromRepo(dir, 'scripts/gitleaks-staged.sh');
  }

  function pnpmInstall(cwd: string, ci: string | undefined) {
    return run('pnpm', ['install', '--prefer-offline'], {
      cwd,
      env: cleanEnv({ CI: ci, LEFTHOOK: undefined, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' }),
    });
  }

  it('hooks are installed by pnpm install', () => {
    // A developer machine (CI unset) and an environment with CI set: both get the hook.
    for (const ci of [undefined, '1']) {
      // A fresh clone checked out as a git worktree (where .git is a file, not a directory).
      const main = tempDir();
      projectWithHooksConfig(main);
      expect(git(main, ['init', '-q']).status).toBe(0);
      expect(git(main, ['add', '.']).status).toBe(0);
      expect(git(main, ['commit', '-q', '-m', 'init']).status).toBe(0);
      const worktree = join(tempDir(), 'feature');
      expect(git(main, ['worktree', 'add', '-q', '-b', 'feat/x', worktree]).status).toBe(0);

      const hookPath = resolve(worktree, git(worktree, ['rev-parse', '--git-path', 'hooks/pre-commit']).output.trim());
      expect(existsSync(hookPath)).toBe(false);

      const install = pnpmInstall(worktree, ci);
      expect(install.status, `CI=${ci}: ${install.output}`).toBe(0);

      expect(existsSync(hookPath), `CI=${ci}`).toBe(true);
      expect(readFileSync(hookPath, 'utf8')).toContain('call_lefthook run "pre-commit"');
    }
  });

  it('pnpm install outside a git repository installs no hooks and succeeds', () => {
    // As in the build stage of the Docker images, where there is no .git.
    const dir = tempDir();
    projectWithHooksConfig(dir);
    expect(git(dir, ['rev-parse', '--git-dir']).status).not.toBe(0);

    const install = pnpmInstall(dir, '1');

    expect(install.status, install.output).toBe(0);
    expect(existsSync(join(dir, '.git'))).toBe(false);
  });
});

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { repoRoot, run } from './repo.js';

const read = (relativePath: string) => readFileSync(join(repoRoot, relativePath), 'utf8');

/** Keys of `KEY=value` lines, active or commented out (`# KEY=`), with the value of the active ones. */
function parseEnvExample(text: string): { listed: Set<string>; active: Map<string, string> } {
  const listed = new Set<string>();
  const active = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^(#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    listed.add(match[2]!);
    if (!match[1]) active.set(match[2]!, match[3]!);
  }
  return { listed, active };
}

function matches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1]!);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(join(repoRoot, directory), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.ts$/.test(file) && !file.includes('node_modules'))
    .map((file) => join(directory, file));
}

/** Every variable the web, the api, the migrate entrypoint, the compose file and the e2e run read. */
function variablesInUse(): string[] {
  const names = new Set<string>();
  // The Zod schemas of loadEnv (api, migrate) and loadServerEnv (web).
  for (const file of ['apps/api/src/config/env.ts', 'apps/web/src/lib/env.ts']) {
    for (const name of matches(read(file), /^\s+([A-Z][A-Z0-9_]*):\s*z\./gm)) names.add(name);
  }
  // PORT is read by the api and by srvx, which serves the web.
  names.add('PORT');
  // Interpolations of the compose file and the keys scripts/worktree.sh writes.
  for (const name of matches(read('compose.yaml'), /\$\{([A-Z][A-Z0-9_]*)/g)) names.add(name);
  for (const name of matches(read('scripts/worktree.sh'), /set_env "\$root\/\.env" ([A-Z][A-Z0-9_]*)/g)) names.add(name);
  // Variables the Playwright run reads.
  for (const file of sourceFiles('tests/e2e')) {
    for (const name of matches(read(file), /process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(name);
  }
  return [...names].sort();
}

describe('.env.example', () => {
  it('lists every variable read by web, api and migrate with placeholders only', () => {
    const { listed, active } = parseEnvExample(read('.env.example'));

    const missing = variablesInUse().filter((name) => !listed.has(name));
    expect(missing, 'variables read by the code but absent from .env.example').toEqual([]);

    for (const [name, value] of active) {
      if (/PASSWORD|SECRET|TOKEN|KEY/.test(name)) expect(value, name).toBe('change-me');
      // A credential embedded in a URL is a placeholder too.
      const password = /^[a-z]+:\/\/[^:@/]+:([^@/]*)@/.exec(value)?.[1];
      if (password !== undefined) expect(password, `${name} password`).toBe('change-me');
      // Nothing that looks like a real token: long, unbroken base64 or hex.
      expect(value, name).not.toMatch(/^[A-Za-z0-9+/=_-]{32,}$/);
    }
  });
});

describe('worktree init', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('keeps working from .env.example', () => {
    const base = mkdtempSync(join(tmpdir(), 'am-guardrails-'));
    tempDirs.push(base);
    const main = join(base, 'main');
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) if (!key.startsWith('GIT_')) env[key] = value;
    const git = (cwd: string, ...args: string[]) =>
      run('git', ['-c', 'user.name=Guardrails Test', '-c', 'user.email=guardrails@example.test', '-c', 'commit.gpgsign=false', ...args], { cwd, env });

    // A throwaway repository holding the real script and the real .env.example, plus a worktree of it.
    mkdirSync(join(main, 'scripts'), { recursive: true });
    cpSync(join(repoRoot, 'scripts/worktree.sh'), join(main, 'scripts/worktree.sh'));
    cpSync(join(repoRoot, '.env.example'), join(main, '.env.example'));
    expect(git(main, 'init', '-q', '-b', 'main').status).toBe(0);
    expect(git(main, 'add', '.').status).toBe(0);
    expect(git(main, 'commit', '-q', '-m', 'init').status).toBe(0);
    const worktree = join(base, 'main.worktrees', 'sample-feature');
    mkdirSync(dirname(worktree), { recursive: true });
    expect(git(main, 'worktree', 'add', '-q', '-b', 'feat/sample-feature', worktree).status).toBe(0);

    const init = run('bash', ['scripts/worktree.sh', 'init'], { cwd: worktree, env });
    expect(init.status, init.output).toBe(0);

    expect(existsSync(join(worktree, '.env'))).toBe(true);
    const { active } = parseEnvExample(readFileSync(join(worktree, '.env'), 'utf8'));
    // The script picked slot 1 and wrote that slot's ports and project name over the example values.
    expect(Object.fromEntries(active)).toMatchObject({
      WORKTREE_SLOT: '1',
      COMPOSE_PROJECT_NAME: 'am-sample-feature',
      WEB_PORT: '3010',
      API_PORT: '3343',
      POSTGRES_PORT: '5442',
      // The rest of the example survives.
      POSTGRES_PASSWORD: 'change-me',
    });
    expect(statSync(join(worktree, '.env')).isFile()).toBe(true);
  });
});

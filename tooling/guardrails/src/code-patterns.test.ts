import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, run } from './repo.js';

// Fast pattern checks over the files git knows (about a second, so they run with `pnpm test` on every
// commit). They hold the rules of AGENTS.md that ESLint cannot see; each failure names the file and line.

const files = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: repoRoot,
})
  .output.split('\0')
  .filter((file) => file !== '' && existsSync(join(repoRoot, file)));

const isSource = (file: string) =>
  /\.(ts|tsx)$/.test(file) && !file.includes('/node_modules/') && !file.includes('/dist/');
/** Generated files carry their own directives. */
const isGenerated = (file: string) => /\.gen\.ts$/.test(file);

/** Process entrypoints report a fatal start-up error before the logger exists. */
const entrypoints = new Set([
  'apps/api/src/main.ts',
  'apps/api/src/cli.ts',
  'apps/api/src/migrate.ts',
  'apps/web/src/server.ts',
]);

const isTest = (file: string) =>
  /\.(test|spec|int\.test)\.(ts|tsx)$/.test(file) || file.startsWith('tests/e2e/specs/');

/** `file:line` of every line of `file` that matches. */
function matches(file: string, pattern: RegExp): string[] {
  return readFileSync(join(repoRoot, file), 'utf8')
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1}  ${line.trim()}`] : []));
}

function scan(selected: string[], pattern: RegExp): string[] {
  return selected.flatMap((file) => matches(file, pattern));
}

describe('code patterns', () => {
  it('never skips, focuses or leaves a test as todo (AGENTS.md: no weakening a test to make it pass)', () => {
    const pattern =
      /\b(it|test|describe)\.(only|skip|todo|fixme)\b|\b(xit|xdescribe|xtest|fit|fdescribe)\(/;
    const tests = files.filter(
      (file) =>
        isSource(file) && isTest(file) && file !== 'tooling/guardrails/src/code-patterns.test.ts',
    );
    expect(scan(tests, pattern)).toEqual([]);
  });

  it('keeps TypeScript and ESLint directives out of the code', () => {
    const pattern = /@ts-ignore|@ts-nocheck|eslint-disable/;
    const sources = files.filter(
      (file) =>
        isSource(file) &&
        !isGenerated(file) &&
        file !== 'tooling/guardrails/src/code-patterns.test.ts',
    );
    expect(scan(sources, pattern)).toEqual([]);
  });

  it('logs through the structured logger, not console, in application code', () => {
    const pattern = /\bconsole\.(log|debug|info|warn|error)\(/;
    const app = files.filter(
      (file) =>
        /^(apps\/(api|web)|packages\/(ui|contracts))\/src\//.test(file) &&
        isSource(file) &&
        !isTest(file) &&
        !entrypoints.has(file) &&
        !/stories\.tsx$/.test(file),
    );
    expect(scan(app, pattern)).toEqual([]);
  });

  it('gives every packages/ui component and layout a story and a test (AGENTS.md)', () => {
    const missing: string[] = [];
    for (const group of ['components', 'layouts']) {
      const base = join(repoRoot, 'packages/ui/src', group);
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const names = readdirSync(join(base, entry.name));
        if (!names.some((name) => name.endsWith('.stories.tsx')))
          missing.push(`packages/ui/src/${group}/${entry.name}: no story`);
        if (!names.some((name) => /\.test\.tsx?$/.test(name)))
          missing.push(`packages/ui/src/${group}/${entry.name}: no test`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps raw HTML controls out of the screens: they come from packages/ui', () => {
    const pattern = /<(button|input|select|textarea)\b/;
    const screens = files.filter((file) => /^apps\/web\/src\/.*\.tsx$/.test(file) && !isTest(file));
    expect(scan(screens, pattern)).toEqual([]);
  });
});

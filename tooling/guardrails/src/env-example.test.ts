import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './repo.js';

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

const generated = /(^|\/)(node_modules|dist|storybook-static|coverage|\.turbo)(\/|$)/;
const testFile = /\.(test|spec|stories)\.[cm]?[jt]sx?$/;

/** Every `process.env.X` and `process.env['X']` read by the code of apps/ and packages/, tests aside, per file. */
function processEnvReads(): Map<string, string[]> {
  const reads = new Map<string, string[]>();
  for (const directory of ['apps', 'packages']) {
    const files = readdirSync(join(repoRoot, directory), { recursive: true, encoding: 'utf8' })
      .map((file) => join(directory, file))
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !generated.test(file) && !testFile.test(file));
    for (const file of files) {
      const text = read(file);
      const names = [
        ...matches(text, /process\.env\.([A-Z][A-Z0-9_]*)/g),
        ...matches(text, /process\.env\[\s*['"`]([A-Z][A-Z0-9_]*)['"`]\s*\]/g),
      ];
      if (names.length > 0) reads.set(file, names);
    }
  }
  return reads;
}

/** Every variable the web, the api, the migrate entrypoint, the compose file and the e2e run read. */
function variablesInUse(): string[] {
  const names = new Set<string>();
  // The Zod schemas of loadEnv (api, migrate) and loadServerEnv (web).
  for (const file of ['apps/api/src/config/env.ts', 'apps/web/src/lib/env.ts']) {
    for (const name of matches(read(file), /^\s+([A-Z][A-Z0-9_]*):\s*z\./gm)) names.add(name);
  }
  // Variables read straight from process.env anywhere in apps/ and packages/ (vite.config.ts, say).
  for (const found of processEnvReads().values()) for (const name of found) names.add(name);
  // Interpolations of the compose file.
  for (const name of matches(read('compose.yaml'), /\$\{([A-Z][A-Z0-9_]*)/g)) names.add(name);
  // Variables the Playwright run reads.
  for (const file of sourceFiles('tests/e2e')) {
    for (const name of matches(read(file), /process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(name);
  }
  return [...names].sort();
}

describe('.env.example', () => {
  it('lists every variable read by web, api and migrate with placeholders only', () => {
    const { listed, active } = parseEnvExample(read('.env.example'));
    // Control: the scan reaches files outside the schemas, such as the web's vite.config.ts.
    expect(processEnvReads().get(join('apps', 'web', 'vite.config.ts'))).toEqual(['PORT']);

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

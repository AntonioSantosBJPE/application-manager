import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesDir = path.dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(path.join(stylesDir, 'tokens.css'), 'utf8');
const require = createRequire(import.meta.url);

/** The first family of a theme font stack in tokens.css, unquoted. */
function firstFamily(variable: 'font-sans' | 'font-mono'): string {
  const stack = new RegExp(`--${variable}:\\s*([^;]+);`).exec(tokensCss)?.[1] ?? '';
  return (stack.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

const packages = [
  { name: '@fontsource-variable/geist', variable: 'font-sans', family: 'Geist' },
  { name: '@fontsource-variable/geist-mono', variable: 'font-mono', family: 'Geist Mono' },
] as const;

describe('Geist and Geist Mono', () => {
  for (const { name, variable, family } of packages) {
    it(`PRU-01 AC09 serves ${family} as ${variable} from the local package ${name}`, () => {
      // The package resolves from packages/ui and tokens.css imports it.
      const entry = require.resolve(name);
      expect(tokensCss).toContain(`@import '${name}';`);

      // The family the stack asks for first is a face the package declares.
      const fontCss = readFileSync(entry, 'utf8');
      const faces = [...fontCss.matchAll(/font-family:\s*'([^']+)'/g)].map((match) => match[1]);
      const requested = firstFamily(variable);
      expect(requested.startsWith(family)).toBe(true);
      expect(faces.length).toBeGreaterThan(0);
      expect(new Set(faces)).toEqual(new Set([requested]));

      // Every face points to a .woff2 inside the package, which exists on disk.
      const sources = [...fontCss.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1] ?? '');
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source, source).toMatch(/^\.\/files\/[\w-]+\.woff2$/);
        expect(existsSync(path.join(path.dirname(entry), source)), source).toBe(true);
      }
    });
  }

  it('PRU-01 AC09 asks no third-party host for a font: no http(s) URL in the CSS', () => {
    const stylesheets = [
      tokensCss,
      ...packages.map(({ name }) => readFileSync(require.resolve(name), 'utf8')),
    ];
    for (const css of stylesheets) {
      expect(css).not.toMatch(/https?:\/\//);
    }
  });
});

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

/**
 * `import ... from 'lucide-react'` statements (a subpath such as `lucide-react/icons` counts too). The
 * negative lookahead leaves out `import type { LucideIcon } from 'lucide-react'`, which draws nothing.
 */
const LUCIDE_IMPORT = /import\s+(?!type\b)([^;]*?)\s+from\s+['"]lucide-react(?:\/[^'"]*)?['"]/g;

/** Local names a source binds to a Lucide value (`Mail`, `Mail as MailIcon`, a default import) and its namespaces (`* as Lucide`). */
function lucideBindings(source: string): { icons: string[]; namespaces: string[] } {
  const icons: string[] = [];
  const namespaces: string[] = [];
  for (const [, clause = ''] of source.matchAll(LUCIDE_IMPORT)) {
    const namespace = /\*\s+as\s+(\w+)/.exec(clause)?.[1];
    if (namespace !== undefined) namespaces.push(namespace);
    const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? '';
    for (const entry of named.split(',')) {
      const item = entry.trim();
      if (item === '' || /^type\s/.test(item)) continue; // `type LucideIcon` is only a type
      icons.push(item.split(/\s+as\s+/).at(-1)!.trim());
    }
    const defaults = clause.replace(/\{[^}]*\}|\*\s+as\s+\w+/g, '').split(',');
    icons.push(...defaults.map((name) => name.trim()).filter((name) => name !== ''));
  }
  return { icons, namespaces };
}

/**
 * `line  code` of every JSX element that renders a Lucide icon straight from `lucide-react`. An icon
 * handed as a value (`icon={Mail}`, `icon={open ? Eye : EyeOff}`) is the allowed way: the wrapper
 * `packages/ui/src/icons/icon.tsx` draws it with the stroke, size, color and `aria-hidden` of PRU-01.
 * This reads text, so an icon first copied to another variable (`const Glyph = Mail; <Glyph />`) is
 * out of its sight; the review catches that one.
 */
function lucideRenderedDirectly(source: string): string[] {
  const { icons, namespaces } = lucideBindings(source);
  if (icons.length === 0 && namespaces.length === 0) return [];
  const rendered = new RegExp(
    [...icons.map((name) => `<${name}(?![\\w.$])`), ...namespaces.map((name) => `<${name}\\.`)].join('|'),
  );
  return source.split('\n').flatMap((line, index) => {
    const code = line.trim();
    const isComment = code.startsWith('//') || code.startsWith('*') || code.startsWith('/*');
    return !isComment && rendered.test(code) ? [`${index + 1}  ${code}`] : [];
  });
}

/** Source that must draw icons through `Icon`: packages/ui and the web app, except the wrapper itself, stories and tests. */
const drawsIcons = (file: string) =>
  /^(packages\/ui|apps\/web)\/src\//.test(file) &&
  isSource(file) &&
  !isTest(file) &&
  !/\.stories\.tsx$/.test(file) &&
  file !== 'packages/ui/src/icons/icon.tsx';

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

  it('draws every icon through the Icon wrapper, never straight from lucide-react (PRU-01 AC11)', () => {
    const violations = files
      .filter((file) => drawsIcons(file) && /\.tsx$/.test(file))
      .flatMap((file) =>
        lucideRenderedDirectly(readFileSync(join(repoRoot, file), 'utf8')).map(
          (line) => `${file}:${line}`,
        ),
      );
    expect(violations).toEqual([]);
  });
});

describe('lucide-react wrapper check', () => {
  it('fails an icon rendered straight from lucide-react, however it was imported', () => {
    const planted = {
      direct: `import { Mail } from 'lucide-react';\nexport const View = () => <Mail />;\n`,
      withProps: `import { Mail } from 'lucide-react';\nexport const View = () => <Mail size={16} className="x" />;\n`,
      aliased: `import { Mail as MailIcon } from 'lucide-react';\nexport const View = () => <MailIcon />;\n`,
      multiline: `import {\n  Eye,\n  type LucideIcon,\n  Mail,\n} from 'lucide-react';\nexport const View = () => <span><Mail></Mail></span>;\n`,
      namespace: `import * as Lucide from 'lucide-react';\nexport const View = () => <Lucide.Mail />;\n`,
      defaultOfSubpath: `import Mail from 'lucide-react/dist/esm/icons/mail';\nexport const View = () => <Mail />;\n`,
    };

    for (const [name, source] of Object.entries(planted)) {
      expect(lucideRenderedDirectly(source), name).toHaveLength(1);
    }
    expect(lucideRenderedDirectly(planted.direct)).toEqual(['2  export const View = () => <Mail />;']);
  });

  it('allows types and icons handed as a value to a prop', () => {
    const allowed = [
      `import type { LucideIcon } from 'lucide-react';\nexport interface Props { icon: LucideIcon }\n`,
      `import { Mail, type LucideIcon } from 'lucide-react';\nexport const View = () => <Button icon={Mail} />;\n`,
      `import { Eye, EyeOff } from 'lucide-react';\nexport const View = () => <Icon icon={open ? EyeOff : Eye} />;\n`,
      `import { CircleAlert, Info } from 'lucide-react';\nconst byIntent = { danger: CircleAlert, info: Info };\nexport const View = () => <Icon icon={byIntent.danger} />;\n`,
      `import { Mail } from 'lucide-react';\n// <Mail /> would bypass Icon\n/**\n * Use <Mail /> through Icon.\n */\nexport const View = () => <MailForm />;\n`,
      `export const View = () => <Mail />;\n`,
    ];

    for (const source of allowed) {
      expect(lucideRenderedDirectly(source), source).toEqual([]);
    }
  });

  it('covers packages/ui and apps/web but not the wrapper, stories or tests', () => {
    expect(drawsIcons('packages/ui/src/components/alert/alert.tsx')).toBe(true);
    expect(drawsIcons('apps/web/src/routes/_member.tsx')).toBe(true);
    expect(drawsIcons('packages/ui/src/icons/icon.tsx')).toBe(false);
    expect(drawsIcons('packages/ui/src/components/alert/alert.stories.tsx')).toBe(false);
    expect(drawsIcons('packages/ui/src/components/alert/alert.test.tsx')).toBe(false);
    expect(drawsIcons('apps/web/src/routes/login.test.tsx')).toBe(false);
    expect(drawsIcons('apps/api/src/main.ts')).toBe(false);
  });
});

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './repo.js';

const eslint = new ESLint({ cwd: repoRoot });

/** Lints source as if it lived at `filePath` (relative to the repo root) with the real config. */
async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error(`no lint result for ${filePath}`);
  const formatter = await eslint.loadFormatter('stylish');
  return {
    messages: result.messages,
    report: await formatter.format([result]),
  };
}

const classes = (names: string) => `export const View = () => <div className="${names}" />;\n`;
/** The classes in a string held by a variable, later passed to className. */
const classesInVariable = (names: string) =>
  `const look = '${names}';\nexport const View = () => <div className={look} />;\n`;
const importing = (source: string) =>
  `import { Slot } from '${source}';\nexport const View = Slot;\n`;

const appFile = 'apps/web/src/features/system-status/components/panel.tsx';
const uiFile = 'packages/ui/src/components/panel/panel.tsx';

describe('design system lint', () => {
  it('fails a radix import outside packages/ui naming the file', async () => {
    const { messages, report } = await lint(appFile, importing('@radix-ui/react-slot'));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ ruleId: 'no-restricted-imports' });
    expect(messages[0]?.message).toContain('Radix packages are only allowed inside packages/ui');
    expect(report).toContain(appFile);
    expect(report).toContain('no-restricted-imports');
  });

  it('fails the radix-ui umbrella import outside packages/ui naming the file', async () => {
    const { messages, report } = await lint(appFile, importing('radix-ui'));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ ruleId: 'no-restricted-imports' });
    expect(messages[0]?.message).toContain("'radix-ui'");
    expect(report).toContain(appFile);
  });

  it('allows a radix import inside packages/ui', async () => {
    const { messages } = await lint(uiFile, importing('@radix-ui/react-slot'));

    expect(messages).toEqual([]);
  });

  it('fails raw colors and arbitrary values naming file and class', async () => {
    // Brackets and the Tailwind 4 parentheses shorthand are both arbitrary values.
    const offending = ['bg-purple-500', 'hover:text-red-600/50', 'p-[13px]', 'p-(--foo)', 'md:bg-(--color-x)'];

    for (const [filePath, source] of [appFile, uiFile].flatMap((file) => [
      [file, classes(offending.join(' '))],
      [file, classesInVariable(offending.join(' '))],
    ] as const)) {
      const { messages, report } = await lint(filePath, source);
      const restricted = messages.filter(
        (m) => m.ruleId === 'better-tailwindcss/no-restricted-classes',
      );

      expect(report).toContain(filePath);
      for (const name of offending) {
        expect(restricted.map((m) => m.message)).toContainEqual(
          expect.stringContaining(`'${name}'`),
        );
        expect(report).toContain(name);
      }
    }
  });

  it('fails a class that is not a token naming file and class', async () => {
    const { messages, report } = await lint(appFile, classes('flex made-up-class'));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ ruleId: 'better-tailwindcss/no-unknown-classes' });
    expect(report).toContain(appFile);
    expect(report).toContain('made-up-class');
  });

  it('allows token classes in apps/web and packages/ui', async () => {
    const tokens =
      'flex border border-border bg-surface px-2 text-text hover:text-text-muted md:grid';

    for (const filePath of [appFile, uiFile]) {
      for (const source of [
        classes(tokens),
        classesInVariable(tokens),
        // A string that is not a class list, held by a variable, is not a class violation.
        "export const apiUrl = 'http://api.test/health?x=(y)';\n",
      ]) {
        const { messages } = await lint(filePath, source);

        expect(messages).toEqual([]);
      }
    }
  });
});

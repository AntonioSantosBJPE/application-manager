import { fileURLToPath } from 'node:url';
import { defineConfig } from 'eslint/config';
import betterTailwind from 'eslint-plugin-better-tailwindcss';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import { MatcherType, SelectorKind } from 'eslint-plugin-better-tailwindcss/types';

const uiDir = fileURLToPath(new URL('../../ui/', import.meta.url));
const tokensCss = `${uiDir}src/styles/tokens.css`;

const palette = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'taupe',
  'mauve',
  'olive',
  'mist',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|');

// Group 1 is the whole class (variants and opacity included) so the message can repeat it.
const rawColor = `^((?:.*:)?[a-z-]+-(?:(?:${palette})-[0-9]{2,3}|black|white)(?:/[0-9.]+)?)$`;
// Square brackets (`p-[13px]`) and the Tailwind 4 parentheses shorthand (`p-(--foo)`, `bg-(color:--x)`).
const arbitraryValue = '^(.*(?:\\[[^\\]]*\\]|-\\([^)]*\\)).*)$';

// Besides the default places (className, cn(), cva()...), every string assigned to a variable is
// checked, since a variable can end up in a className. Only the restrictions use this: an ordinary
// string (a URL, a message) would be an unknown class, but it is not a raw color or an arbitrary value.
// A string holding square brackets (a regex source, say) is reported too; it belongs outside UI code.
const everyVariableString = [
  ...getDefaultSelectors(),
  { kind: SelectorKind.Variable, name: '^.*$', match: [{ type: MatcherType.String }] },
];

/**
 * Design system rules (GUARD-09, GUARD-10): UI comes only through packages/ui and only
 * through tokens. Radix primitives stay inside packages/ui; app code uses the components.
 */
export default defineConfig(
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    ignores: ['packages/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'radix-ui',
              message:
                "Import of 'radix-ui' is only allowed inside packages/ui. Use a component from @am/ui.",
            },
          ],
          patterns: [
            {
              group: ['@radix-ui/*'],
              message:
                'Radix packages are only allowed inside packages/ui. Use a component from @am/ui.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}', 'packages/ui/**/*.{js,jsx,ts,tsx}'],
    plugins: { 'better-tailwindcss': betterTailwind },
    // cwd is where tailwindcss resolves from, so the rules work from any workspace.
    settings: { 'better-tailwindcss': { cwd: uiDir, entryPoint: tokensCss } },
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          selectors: everyVariableString,
          restrict: [
            {
              pattern: rawColor,
              message:
                "Raw Tailwind color '$1' is forbidden. Use a semantic token (for example bg-surface, text-text, border-border).",
            },
            {
              pattern: arbitraryValue,
              message: "Arbitrary value '$1' is forbidden. Use a token or a scale value.",
            },
          ],
        },
      ],
      'better-tailwindcss/no-unknown-classes': 'error',
    },
  },
);

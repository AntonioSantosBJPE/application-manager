import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './docker.js';

export type Scheme = 'light' | 'dark';
export type TokenName = 'surface' | 'text' | 'status-operational';

/** Declared values of the semantic color tokens for each scheme, read from the design system CSS. */
export function readTokens(): Record<Scheme, Record<TokenName, string>> {
  const css = readFileSync(join(repoRoot, 'packages/ui/src/styles/tokens.css'), 'utf8');
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
  const darkEnd = css.indexOf(":root[data-theme='dark']");
  if (darkStart < 0 || darkEnd < darkStart) throw new Error('tokens.css: dark block not found');
  const names: TokenName[] = ['surface', 'text', 'status-operational'];
  const valuesIn = (block: string) =>
    Object.fromEntries(
      names.map((name) => {
        const match = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(block);
        if (!match) throw new Error(`tokens.css: --color-${name} not found`);
        return [name, match[1]!.trim()];
      }),
    ) as Record<TokenName, string>;
  return { light: valuesIn(css.slice(0, darkStart)), dark: valuesIn(css.slice(darkStart, darkEnd)) };
}

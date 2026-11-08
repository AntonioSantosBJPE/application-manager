import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesDir = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(stylesDir, 'tokens.css'), 'utf8');

type Theme = 'light' | 'dark';
const themes: Theme[] = ['light', 'dark'];

/** The Prumo reference: docs/design/system/tokens.json, the binding source of the values. */
interface PrumoTokens {
  color: { tokens: { name: string; value: Record<Theme, string> }[] };
  type: {
    families: Record<'sans' | 'mono', string>;
    groups: {
      styles: {
        name: string;
        fontSize: string;
        lineHeight: string;
        fontWeight: number;
        letterSpacing?: string;
      }[];
    }[];
  };
  spacing: { tokens: { name: string; value: string }[] };
  radius: { tokens: { name: string; value: string }[] };
  shadow: { tokens: { name: string; value: Record<Theme, string> }[] };
  size: { tokens: { name: string; value: string }[] };
}

const prumo = JSON.parse(
  readFileSync(path.join(stylesDir, '../../../../docs/design/system/tokens.json'), 'utf8'),
) as PrumoTokens;

/** The body of the first `{ ... }` block that follows `selector` in `source`. */
function blockAfter(selector: string, source = css): string {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`tokens.css: no ${selector}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`tokens.css: unclosed ${selector}`);
}

/** The custom properties a block declares, name without the leading dashes. */
function declarations(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+|[\w-]*\*)\s*:\s*([^;]+);/g)) {
    found.set(match[1] ?? '', (match[2] ?? '').replace(/\s+/g, ' ').trim());
  }
  return found;
}

const lightBlock = declarations(blockAfter('@theme static'));
/** The dark theme twice: from the system preference, and forced by `data-theme`. */
const darkBlocks = {
  'prefers-color-scheme': declarations(blockAfter(":root:not([data-theme='light'])")),
  "data-theme='dark'": declarations(blockAfter(":root[data-theme='dark']")),
};
const baseLayer = blockAfter('@layer base');

/** A `{token}` reference of tokens.json is a `var(--color-token)` in tokens.css. */
function expectedColor(value: string): string {
  return value.startsWith('{') ? `var(--color-${value.slice(1, -1)})` : value;
}

/** The value of a color token in a theme, following `var()` aliases to the declared value. */
function colorIn(theme: Theme, name: string): string {
  const declared = theme === 'light' ? lightBlock : darkBlocks['prefers-color-scheme'];
  let value = declared.get(`color-${name}`) ?? lightBlock.get(`color-${name}`);
  for (let hops = 0; value?.startsWith('var(') && hops < 5; hops += 1) {
    const alias = /^var\(--([\w-]+)\)$/.exec(value)?.[1] ?? '';
    value = declared.get(alias) ?? lightBlock.get(alias);
  }
  if (value === undefined) throw new Error(`tokens.css: no --color-${name} in ${theme}`);
  return value;
}

/** OKLCH to gamma-encoded sRGB channels (0 to 1), clipped to the gamut (CSS Color 4 matrices). */
function oklchToSrgb(color: string): [number, number, number] {
  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(color);
  if (match === null) throw new Error(`not an oklch() color: ${color}`);
  const [lightness, chroma, hue] = match.slice(1).map(Number) as [number, number, number];
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((channel) => {
    const clipped = Math.min(1, Math.max(0, channel));
    return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

/** WCAG 2 relative luminance of an sRGB color. */
function luminance(color: string): number {
  const [red, green, blue] = oklchToSrgb(color).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The WCAG contrast ratio of two OKLCH colors, from 1 to 21. */
function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (x, y) => y - x,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

const surfaces = ['surface', 'surface-raised', 'surface-hover', 'surface-overlay'];

describe('Prumo tokens', () => {
  it('PRU-01 AC01 defines every color token of tokens.json in the light and the dark theme', () => {
    for (const { name, value } of prumo.color.tokens) {
      expect(lightBlock.get(`color-${name}`), `light --color-${name}`).toBe(
        expectedColor(value.light),
      );
      for (const [source, block] of Object.entries(darkBlocks)) {
        expect(block.get(`color-${name}`), `dark (${source}) --color-${name}`).toBe(
          expectedColor(value.dark),
        );
      }
    }
  });

  it('PRU-01 AC01 defines every type, spacing, radius, shadow and size token of tokens.json', () => {
    for (const group of prumo.type.groups) {
      for (const style of group.styles) {
        expect(lightBlock.get(`text-${style.name}`), `--text-${style.name}`).toBe(style.fontSize);
        expect(lightBlock.get(`text-${style.name}--line-height`)).toBe(style.lineHeight);
        expect(lightBlock.get(`text-${style.name}--font-weight`)).toBe(String(style.fontWeight));
        if (style.letterSpacing !== undefined) {
          expect(lightBlock.get(`text-${style.name}--letter-spacing`)).toBe(style.letterSpacing);
        }
      }
    }

    const quotes = (family: string) => family.replaceAll('"', "'");
    // The packaged faces come first (@fontsource names them "<family> Variable"), then the Prumo stack.
    expect(lightBlock.get('font-sans')).toBe(
      `'Geist Variable', ${quotes(prumo.type.families.sans)}`,
    );
    expect(lightBlock.get('font-mono')).toBe(
      `'Geist Mono Variable', ${quotes(prumo.type.families.mono)}`,
    );

    // space-<n> is the Tailwind step <n> on a 4px grid: space-1-5 is 1.5 steps, 6px.
    expect(lightBlock.get('spacing')).toBe('4px');
    for (const { name, value } of prumo.spacing.tokens) {
      const step = Number(name.replace('space-', '').replace('-', '.'));
      expect(`${step * 4}px`, name).toBe(value);
    }

    for (const { name, value } of prumo.radius.tokens) {
      expect(lightBlock.get(name), name).toBe(value);
    }

    for (const { name, value } of prumo.shadow.tokens) {
      expect(lightBlock.get(name), `light ${name}`).toBe(value.light);
      for (const block of Object.values(darkBlocks)) {
        expect(block.get(name), `dark ${name}`).toBe(value.dark);
      }
    }

    // The sizes the Prumo names, under the theme namespaces that generate utilities (design.md).
    const sizeVariable: Record<string, string> = {
      'control-sm': 'spacing-control-sm',
      'control-md': 'spacing-control-md',
      'row-height': 'spacing-row',
      'sidebar-width': 'spacing-sidebar',
      'properties-width': 'spacing-properties',
      'content-max': 'container-content',
      'form-max': 'container-form',
      'auth-max': 'container-auth',
    };
    for (const { name, value } of prumo.size.tokens) {
      expect(sizeVariable[name], `${name} has a theme variable`).toBeDefined();
      expect(lightBlock.get(sizeVariable[name] ?? ''), name).toBe(value);
    }
  });

  it('PRU-01 AC02 keeps the 13 token names the provisional tokens defined', () => {
    const colors = [
      'surface',
      'surface-raised',
      'text',
      'text-muted',
      'border',
      'status-operational',
      'status-unavailable',
      'accent',
      'focus',
      'on-accent',
      'danger',
    ];
    for (const name of colors) {
      expect(lightBlock.has(`color-${name}`), `light --color-${name}`).toBe(true);
      for (const block of Object.values(darkBlocks)) {
        expect(block.has(`color-${name}`), `dark --color-${name}`).toBe(true);
      }
    }
    expect(lightBlock.has('radius-sm')).toBe(true);
    expect(lightBlock.has('radius-md')).toBe(true);
  });

  it('PRU-01 AC03 sets the Prumo accent in both themes', () => {
    expect(lightBlock.get('color-accent')).toBe('oklch(0.5 0.08 195)');
    expect(darkBlocks['prefers-color-scheme'].get('color-accent')).toBe('oklch(0.74 0.105 195)');
    expect(darkBlocks["data-theme='dark'"].get('color-accent')).toBe('oklch(0.74 0.105 195)');
  });

  it("PRU-01 AC04 keeps Tailwind's default palette removed", () => {
    expect(lightBlock.get('color-*')).toBe('initial');
    const colorNames = [...lightBlock.keys()].filter((name) => name.startsWith('color-'));
    const prumoNames = prumo.color.tokens.map(({ name }) => `color-${name}`);
    expect(colorNames.filter((name) => name !== 'color-*').sort()).toEqual(prumoNames.sort());
  });

  it('PRU-01 AC07 renders every listed text pair at 4.5:1 or more in both themes', () => {
    const pairs: [string, string][] = [
      ...surfaces.flatMap((surface): [string, string][] => [
        ['text', surface],
        ['text-muted', surface],
      ]),
      ['accent-text', 'accent-subtle'],
      ['danger', 'danger-subtle'],
      ['warning', 'warning-subtle'],
      ['on-accent', 'accent'],
      ['on-accent', 'danger'],
    ];
    expect(pairs).toHaveLength(13);
    for (const theme of themes) {
      for (const [text, background] of pairs) {
        const ratio = contrast(colorIn(theme, text), colorIn(theme, background));
        expect(ratio, `${theme}: ${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('PRU-01 AC08 renders focus, border-control and every status color at 3:1 on their surfaces', () => {
    const statuses = prumo.color.tokens
      .map(({ name }) => name)
      .filter((name) => name.startsWith('status-'));
    expect(statuses).toHaveLength(10);
    // Where each sits: tokens.json gives border-control the surfaces of a form (no hover).
    const sitsOn: [string, string[]][] = [
      ['focus', surfaces],
      ['border-control', ['surface', 'surface-raised', 'surface-overlay']],
      ...statuses.map((status): [string, string[]] => [status, surfaces]),
    ];
    for (const theme of themes) {
      for (const [color, backgrounds] of sitsOn) {
        for (const background of backgrounds) {
          const ratio = contrast(colorIn(theme, color), colorIn(theme, background));
          expect(ratio, `${theme}: ${color} on ${background}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('PRU-01 AC10 sets the base text to 13/20 and the scale to the sizes of tokens.json', () => {
    const body = new Map(
      [...blockAfter('body', baseLayer).matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map(
        ([, property, value]): [string, string] => [property ?? '', (value ?? '').trim()],
      ),
    );
    expect(body.get('font-size')).toBe('var(--text-body)');
    expect(body.get('line-height')).toBe('var(--text-body--line-height)');
    expect(body.get('font-family')).toBe('var(--font-sans)');
    expect(lightBlock.get('text-body')).toBe('13px');
    expect(lightBlock.get('text-body--line-height')).toBe('20px');

    const scale = [
      'caption',
      'label',
      'body',
      'body-lg',
      'heading-sm',
      'heading-md',
      'heading-lg',
      'heading-xl',
    ];
    const sizes = new Map(
      prumo.type.groups.flatMap(({ styles }) =>
        styles.map(({ name, fontSize }): [string, string] => [name, fontSize]),
      ),
    );
    for (const name of scale) {
      expect(lightBlock.get(`text-${name}`), name).toBe(sizes.get(name));
    }
  });
});

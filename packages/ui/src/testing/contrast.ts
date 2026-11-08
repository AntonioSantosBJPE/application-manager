import { expect } from 'storybook/test';

/**
 * Helpers for stories that judge a color the way a person sees it (UI-24). They run in the browser
 * of the Storybook tests, where the engine resolves any CSS color, `oklch()` included.
 */

/** The sRGB channels (0 to 255) of any CSS color, as the browser paints it. */
function toRgb(color: string): [number, number, number] {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('no 2d canvas to resolve a color');
  context.fillStyle = '#000';
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return [red ?? 0, green ?? 0, blue ?? 0];
}

function luminance(color: string): number {
  const [red, green, blue] = toRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The WCAG contrast ratio between two CSS colors, from 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** The page background of the active theme: the `--color-surface` token on the root element. */
export function pageBackground(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim();
}

/** Waits for running transitions to finish, so a computed color is the settled one. */
export async function settle(element: Element): Promise<void> {
  await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
}

/** What a person sees of the keyboard focus ring of an element right now (UI-24). */
export interface FocusRing {
  /** The ring is drawn: an outline style other than `none` with a width above zero. */
  drawn: boolean;
  /** Contrast of the ring against the page background of the active theme. */
  ratio: number;
  /** The ring is the `--color-focus` token of the active theme, not a browser default. */
  isFocusToken: boolean;
  /** The ring has the text color of the element, which is what made it vanish before. */
  isTextColor: boolean;
}

/** Reads the outline of a focused element against the page, the way Button's story judges it. */
export function focusRing(element: Element): FocusRing {
  const style = getComputedStyle(element);
  const probe = document.createElement('span');
  probe.style.color = 'var(--color-focus)';
  document.body.append(probe);
  const token = getComputedStyle(probe).color;
  probe.remove();
  return {
    isFocusToken: style.outlineColor === token,
    drawn: style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0,
    ratio: contrastRatio(style.outlineColor, pageBackground()),
    isTextColor: style.outlineColor === style.color,
  };
}

/** True when a CSS color paints nothing (alpha 0), like the default `transparent` background. */
function isTransparent(color: string): boolean {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('no 2d canvas to resolve a color');
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return context.getImageData(0, 0, 1, 1).data[3] === 0;
}

/** The color painted behind an element: the first background up the tree, else the page. */
export function backgroundBehind(element: Element): string {
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    const background = getComputedStyle(node).backgroundColor;
    if (!isTransparent(background)) return background;
  }
  return pageBackground();
}

/** The color of an element that a person reads against its background. */
export type ContrastProperty = 'color' | 'borderTopColor' | 'outlineColor' | 'stroke' | 'fill';

/**
 * Asserts, in a story's play, that a color of the element reaches `minimum` against what is painted
 * behind it (PRU-08): 4.5 for text, 3 for focus rings, control borders and status icons. Transitions
 * are settled first, so the ratio is the one a person sees once the screen is still.
 */
export async function expectContrast(
  element: Element,
  minimum: number,
  property: ContrastProperty = 'color',
  background?: string,
): Promise<void> {
  await settle(element);
  const foreground = getComputedStyle(element)[property];
  const behind = background ?? backgroundBehind(element);
  const ratio = contrastRatio(foreground, behind);
  const label = `${property} ${foreground} on ${behind}`;
  await expect(ratio, label).toBeGreaterThanOrEqual(minimum);
}

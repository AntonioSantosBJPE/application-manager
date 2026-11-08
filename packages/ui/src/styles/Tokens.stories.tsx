import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect } from 'storybook/test';
import prumo from '../../../../docs/design/system/tokens.json';
import { expectContrast, settle } from '../testing/contrast';

/*
 * The Prumo tokens as the Storybook paints them (PRU-08). Every class is written out in full so
 * Tailwind generates it; the plays compare what the browser paints with tokens.json.
 */

const colors = [
  { name: 'surface', className: 'bg-surface' },
  { name: 'surface-raised', className: 'bg-surface-raised' },
  { name: 'surface-hover', className: 'bg-surface-hover' },
  { name: 'surface-overlay', className: 'bg-surface-overlay' },
  { name: 'backdrop', className: 'bg-backdrop' },
  { name: 'border', className: 'bg-border' },
  { name: 'border-strong', className: 'bg-border-strong' },
  { name: 'border-control', className: 'bg-border-control' },
  { name: 'text', className: 'bg-text' },
  { name: 'text-muted', className: 'bg-text-muted' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'accent-hover', className: 'bg-accent-hover' },
  { name: 'accent-subtle', className: 'bg-accent-subtle' },
  { name: 'accent-text', className: 'bg-accent-text' },
  { name: 'on-accent', className: 'bg-on-accent' },
  { name: 'focus', className: 'bg-focus' },
  { name: 'danger', className: 'bg-danger' },
  { name: 'danger-hover', className: 'bg-danger-hover' },
  { name: 'danger-subtle', className: 'bg-danger-subtle' },
  { name: 'warning', className: 'bg-warning' },
  { name: 'warning-subtle', className: 'bg-warning-subtle' },
  { name: 'info-subtle', className: 'bg-info-subtle' },
  { name: 'status-operational', className: 'bg-status-operational' },
  { name: 'status-unavailable', className: 'bg-status-unavailable' },
  { name: 'status-saved', className: 'bg-status-saved' },
  { name: 'status-applied', className: 'bg-status-applied' },
  { name: 'status-interviewing', className: 'bg-status-interviewing' },
  { name: 'status-offer', className: 'bg-status-offer' },
  { name: 'status-accepted', className: 'bg-status-accepted' },
  { name: 'status-rejected', className: 'bg-status-rejected' },
  { name: 'status-withdrawn', className: 'bg-status-withdrawn' },
  { name: 'status-ghosted', className: 'bg-status-ghosted' },
  { name: 'paper', className: 'bg-paper' },
  { name: 'paper-ink', className: 'bg-paper-ink' },
  { name: 'paper-rule', className: 'bg-paper-rule' },
];

/** The text pairs of PRU-01 AC 7, each at 4.5:1. */
const textPairs = [
  { name: 'text / surface', className: 'bg-surface text-text' },
  { name: 'text-muted / surface', className: 'bg-surface text-text-muted' },
  { name: 'text / surface-raised', className: 'bg-surface-raised text-text' },
  { name: 'text-muted / surface-raised', className: 'bg-surface-raised text-text-muted' },
  { name: 'text / surface-hover', className: 'bg-surface-hover text-text' },
  { name: 'text-muted / surface-hover', className: 'bg-surface-hover text-text-muted' },
  { name: 'text / surface-overlay', className: 'bg-surface-overlay text-text' },
  { name: 'text-muted / surface-overlay', className: 'bg-surface-overlay text-text-muted' },
  { name: 'accent-text / accent-subtle', className: 'bg-accent-subtle text-accent-text' },
  { name: 'danger / danger-subtle', className: 'bg-danger-subtle text-danger' },
  { name: 'warning / warning-subtle', className: 'bg-warning-subtle text-warning' },
  { name: 'on-accent / accent', className: 'bg-accent text-on-accent' },
  { name: 'on-accent / danger', className: 'bg-danger text-on-accent' },
];

const surfaces = [
  { name: 'surface', className: 'bg-surface' },
  { name: 'surface-raised', className: 'bg-surface-raised' },
  { name: 'surface-hover', className: 'bg-surface-hover' },
  { name: 'surface-overlay', className: 'bg-surface-overlay' },
];

/** The graphic colors of PRU-01 AC 8, each at 3:1 on the surfaces it sits on. */
const graphics = [
  { name: 'focus', className: 'border-focus', onHover: true },
  { name: 'border-control', className: 'border-border-control', onHover: false },
  { name: 'status-operational', className: 'border-status-operational', onHover: true },
  { name: 'status-unavailable', className: 'border-status-unavailable', onHover: true },
  { name: 'status-saved', className: 'border-status-saved', onHover: true },
  { name: 'status-applied', className: 'border-status-applied', onHover: true },
  { name: 'status-interviewing', className: 'border-status-interviewing', onHover: true },
  { name: 'status-offer', className: 'border-status-offer', onHover: true },
  { name: 'status-accepted', className: 'border-status-accepted', onHover: true },
  { name: 'status-rejected', className: 'border-status-rejected', onHover: true },
  { name: 'status-withdrawn', className: 'border-status-withdrawn', onHover: true },
  { name: 'status-ghosted', className: 'border-status-ghosted', onHover: true },
];

const typeStyles = [
  { name: 'heading-xl', className: 'text-heading-xl' },
  { name: 'heading-lg', className: 'text-heading-lg' },
  { name: 'heading-md', className: 'text-heading-md' },
  { name: 'heading-sm', className: 'text-heading-sm' },
  { name: 'body-lg', className: 'text-body-lg' },
  { name: 'body', className: 'text-body' },
  { name: 'body-strong', className: 'text-body-strong' },
  { name: 'label', className: 'text-label' },
  { name: 'caption', className: 'text-caption' },
  { name: 'mono', className: 'font-mono text-mono' },
  { name: 'kbd', className: 'font-mono text-kbd' },
];

const spaces = [
  { name: 'space-0-5', className: 'w-0.5' },
  { name: 'space-1', className: 'w-1' },
  { name: 'space-1-5', className: 'w-1.5' },
  { name: 'space-2', className: 'w-2' },
  { name: 'space-3', className: 'w-3' },
  { name: 'space-4', className: 'w-4' },
  { name: 'space-6', className: 'w-6' },
  { name: 'space-8', className: 'w-8' },
  { name: 'space-12', className: 'w-12' },
];

const radii = [
  { name: 'radius-sm', className: 'rounded-sm' },
  { name: 'radius-md', className: 'rounded-md' },
  { name: 'radius-lg', className: 'rounded-lg' },
  { name: 'radius-full', className: 'rounded-full' },
];

/** The sizes the Prumo names, with the CSS property each one sets. */
const sizes = [
  { name: 'control-sm', className: 'h-control-sm w-8', property: 'height' },
  { name: 'control-md', className: 'h-control-md w-8', property: 'height' },
  { name: 'row-height', className: 'h-row w-8', property: 'height' },
  { name: 'sidebar-width', className: 'h-2 w-sidebar', property: 'width' },
  { name: 'properties-width', className: 'h-2 w-properties', property: 'width' },
  { name: 'auth-max', className: 'h-2 w-full max-w-auth', property: 'maxWidth' },
  { name: 'form-max', className: 'h-2 w-full max-w-form', property: 'maxWidth' },
  { name: 'content-max', className: 'h-2 w-full max-w-content', property: 'maxWidth' },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-heading-md">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Name({ children }: { children: ReactNode }) {
  return <span className="font-mono text-mono text-text-muted">{children}</span>;
}

function TokensSheet() {
  return (
    <div className="flex flex-col gap-8 bg-surface p-6 text-text">
      <Section id="cores" title="Cores">
        <ul className="grid grid-cols-4 gap-3">
          {colors.map(({ name, className }) => (
            <li key={name} className="flex items-center gap-2">
              <span
                data-token={name}
                className={`size-8 shrink-0 rounded-sm border border-border ${className}`}
              />
              <Name>{name}</Name>
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-3 gap-2">
          {textPairs.map(({ name, className }) => (
            <li key={name} data-pair={name} className={`rounded-sm p-2 ${className}`}>
              {name}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          {surfaces.map((surface) => (
            <div
              key={surface.name}
              data-surface={surface.name}
              className={`flex flex-wrap gap-2 p-2 ${surface.className}`}
            >
              {graphics
                .filter(({ onHover }) => onHover || surface.name !== 'surface-hover')
                .map(({ name, className }) => (
                  <span
                    key={name}
                    data-graphic={name}
                    title={name}
                    className={`size-5 rounded-full border-2 ${className}`}
                  />
                ))}
            </div>
          ))}
        </div>
      </Section>

      <Section id="tipografia" title="Tipografia">
        {typeStyles.map(({ name, className }) => (
          <p key={name} data-type={name} className={className}>
            {name} · Rumo Carreira 0193a2f4
          </p>
        ))}
      </Section>

      <Section id="espaco" title="Espaço">
        {spaces.map(({ name, className }) => (
          <div key={name} className="flex items-center gap-3">
            <span data-space={name} className={`h-2 bg-accent ${className}`} />
            <Name>{name}</Name>
          </div>
        ))}
      </Section>

      <Section id="raios" title="Raios">
        <div className="flex gap-4">
          {radii.map(({ name, className }) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <span
                data-radius={name}
                className={`size-12 border border-border-strong bg-surface-raised ${className}`}
              />
              <Name>{name}</Name>
            </div>
          ))}
        </div>
      </Section>

      <Section id="sombra" title="Sombra">
        <div
          data-shadow="shadow-overlay"
          className="w-60 rounded-lg border border-border-strong bg-surface-overlay p-4 shadow-overlay"
        >
          <Name>shadow-overlay</Name>
        </div>
      </Section>

      <Section id="tamanhos" title="Tamanhos">
        {sizes.map(({ name, className }) => (
          <div key={name} className="flex flex-col gap-1">
            <span data-size={name} className={`block rounded-sm bg-accent-subtle ${className}`} />
            <Name>{name}</Name>
          </div>
        ))}
      </Section>
    </div>
  );
}

const meta = {
  title: 'Tokens',
  component: TokensSheet,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TokensSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

type Theme = 'light' | 'dark';

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function one(canvasElement: HTMLElement, selector: string): HTMLElement {
  const element = canvasElement.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`no ${selector}`);
  return element;
}

/** Shows every token of tokens.json with the value of the active theme, and checks the pairs. */
function sheetPlay(theme: Theme): Story['play'] {
  return async ({ canvas, canvasElement }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', theme);
    for (const title of ['Cores', 'Tipografia', 'Espaço', 'Raios', 'Sombra', 'Tamanhos']) {
      await expect(canvas.getByRole('region', { name: title })).toBeVisible();
    }

    // Colors: a swatch per token of tokens.json, painted with the value of this theme.
    await expect(colors.map(({ name }) => name)).toEqual(
      prumo.color.tokens.map(({ name }) => name),
    );
    for (const { name, value } of prumo.color.tokens) {
      const swatch = one(canvasElement, `[data-token="${name}"]`);
      await settle(swatch);
      const declared = value[theme].startsWith('{')
        ? `var(--color-${value[theme].slice(1, -1)})`
        : value[theme];
      await expect(getComputedStyle(swatch).backgroundColor, name).toBe(resolvedColor(declared));
    }

    // The pairs of PRU-01: text at 4.5:1, focus, control border and status at 3:1.
    for (const { name } of textPairs) {
      await expectContrast(one(canvasElement, `[data-pair="${name}"]`), 4.5);
    }
    for (const row of canvasElement.querySelectorAll('[data-surface]')) {
      for (const mark of row.querySelectorAll('[data-graphic]')) {
        await expectContrast(mark, 3, 'borderTopColor');
      }
    }

    // Type scale: the size, line height and weight of tokens.json.
    const styles = prumo.type.groups.flatMap(({ styles: group }) => group);
    await expect(typeStyles.map(({ name }) => name).sort()).toEqual(
      styles.map(({ name }) => name).sort(),
    );
    for (const style of styles) {
      const sample = getComputedStyle(one(canvasElement, `[data-type="${style.name}"]`));
      await expect([sample.fontSize, sample.lineHeight, sample.fontWeight], style.name).toEqual([
        style.fontSize,
        style.lineHeight,
        String(style.fontWeight),
      ]);
    }

    for (const { name, value } of prumo.spacing.tokens) {
      await expect(getComputedStyle(one(canvasElement, `[data-space="${name}"]`)).width).toBe(
        value,
      );
    }
    for (const { name, value } of prumo.radius.tokens) {
      const radius = getComputedStyle(one(canvasElement, `[data-radius="${name}"]`));
      await expect(radius.borderTopLeftRadius, name).toBe(value);
    }

    const shadow = getComputedStyle(one(canvasElement, '[data-shadow="shadow-overlay"]'));
    const shadowValue = prumo.shadow.tokens[0]?.value[theme] ?? '';
    const probe = document.createElement('div');
    probe.style.boxShadow = shadowValue;
    document.body.append(probe);
    await expect(shadow.boxShadow).toBe(getComputedStyle(probe).boxShadow);
    probe.remove();

    for (const { name, value } of prumo.size.tokens) {
      const size = sizes.find((entry) => entry.name === name);
      await expect(size, `${name} is shown`).toBeDefined();
      const element = getComputedStyle(one(canvasElement, `[data-size="${name}"]`));
      await expect(element[size?.property ?? 'height'], name).toBe(value);
    }
  };
}

/** PRU-08 AC 5: the tokens in the light theme. */
export const TokensClaro: Story = {
  name: 'PRU-08 AC05 Tokens, tema claro',
  globals: { theme: 'light' },
  play: sheetPlay('light'),
};

/** PRU-08 AC 5: the tokens in the dark theme. */
export const TokensEscuro: Story = {
  name: 'PRU-08 AC05 Tokens, tema escuro',
  globals: { theme: 'dark' },
  play: sheetPlay('dark'),
};

/** The page background of each theme in tokens.json. */
const surfaceOf: Record<Theme, string> = {
  light: 'oklch(0.99 0.002 250)',
  dark: 'oklch(0.165 0.005 250)',
};

/** The Storybook loads tokens.css with its fonts and switches the theme through data-theme. */
function setupPlay(theme: Theme): Story['play'] {
  return async ({ canvasElement }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', theme);
    await settle(document.body);
    await expect(getComputedStyle(document.body).backgroundColor).toBe(
      resolvedColor(surfaceOf[theme]),
    );

    const sample = one(canvasElement, '[data-type="body"]');
    await expect(getComputedStyle(sample).fontFamily.startsWith('"Geist Variable"')).toBe(true);
    const mono = one(canvasElement, '[data-type="mono"]');
    await expect(getComputedStyle(mono).fontFamily.startsWith('"Geist Mono Variable"')).toBe(true);
    const faces = [
      ...(await document.fonts.load('13px "Geist Variable"', 'Rumo')),
      ...(await document.fonts.load('12px "Geist Mono Variable"', '0193')),
    ];
    await expect(faces.map((face) => [face.family, face.status]).sort()).toEqual([
      ['Geist Mono Variable', 'loaded'],
      ['Geist Variable', 'loaded'],
    ]);
  };
}

/** PRU-08 AC 2: tokens and fonts loaded, light theme through data-theme. */
export const StorybookClaro: Story = {
  name: 'PRU-08 AC02 Tokens e fontes carregados, tema claro',
  globals: { theme: 'light' },
  play: setupPlay('light'),
};

/** PRU-08 AC 2: tokens and fonts loaded, dark theme through data-theme. */
export const StorybookEscuro: Story = {
  name: 'PRU-08 AC02 Tokens e fontes carregados, tema escuro',
  globals: { theme: 'dark' },
  play: setupPlay('dark'),
};

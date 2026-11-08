import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import {
  contrastRatio,
  expectContrast,
  focusRing,
  pageBackground,
  settle as settled,
} from '../../testing/contrast';
import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/** Waits for a running color transition to finish, so the assertion reads the settled value. */
async function settle(element: Element): Promise<void> {
  await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
}

export const Primario: Story = {
  name: 'Primário',
  args: { intent: 'primary', children: 'Entrar' },
};

export const Secundario: Story = {
  name: 'Secundário',
  args: { intent: 'secondary', children: 'Cancelar' },
};

export const Fantasma: Story = {
  name: 'Fantasma',
  args: { intent: 'ghost', children: 'Ver convites' },
};

export const Pequeno: Story = {
  name: 'Pequeno',
  args: { intent: 'secondary', size: 'sm', children: 'Revogar' },
};

export const Perigo: Story = {
  name: 'Perigo',
  args: { intent: 'danger', children: 'Revogar' },
};

export const Desabilitado: Story = {
  name: 'Desabilitado',
  args: { intent: 'primary', children: 'Entrar', disabled: true },
};

/** Light theme through the toolbar global; asserts the light accent token reaches the button. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { intent: 'primary', children: 'Entrar' },
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Entrar' });

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await settle(button);
    // The light value of --color-accent in tokens.css.
    await expect(getComputedStyle(button).backgroundColor).toBe(resolvedColor('oklch(0.5 0.08 195)'));
    // The light value of --color-on-accent in tokens.css.
    await expect(getComputedStyle(button).color).toBe(resolvedColor('oklch(0.99 0.002 250)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark accent token reaches the button. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { intent: 'primary', children: 'Entrar' },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Entrar' });

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await settle(button);
    // The dark value of --color-accent in tokens.css.
    await expect(getComputedStyle(button).backgroundColor).toBe(resolvedColor('oklch(0.74 0.105 195)'));
    // The dark value of --color-on-accent in tokens.css.
    await expect(getComputedStyle(button).color).toBe(resolvedColor('oklch(0.165 0.005 250)'));
  },
};

const intents = [
  { intent: 'primary', label: 'Entrar' },
  { intent: 'secondary', label: 'Cancelar' },
  { intent: 'danger', label: 'Revogar' },
] as const;

/**
 * Tabs through the three intents and asserts each focus indicator stands out from the page (UI-24). The ring
 * is read the instant the button takes focus, as a person sees it, and again once transitions are over.
 */
const focusContrast: Story['play'] = async ({ canvas }) => {
  // Let the theme switch finish first, so only the focus itself can move a color from here on.
  for (const { label } of intents) await settled(canvas.getByRole('button', { name: label }));

  for (const { intent, label } of intents) {
    await userEvent.tab();
    const button = canvas.getByRole('button', { name: label });
    await expect(button).toHaveFocus();

    const style = getComputedStyle(button);
    await expect(style.outlineStyle, `${intent} draws an outline`).not.toBe('none');
    await expect(Number.parseFloat(style.outlineWidth), `${intent} outline width`).toBeGreaterThan(
      0,
    );
    await expect(
      contrastRatio(style.outlineColor, pageBackground()),
      `${intent} focus ring against the page`,
    ).toBeGreaterThanOrEqual(3);
    // The ring is not the text color of the button, which is what made it vanish.
    await expect(style.outlineColor, `${intent} ring is not its label color`).not.toBe(style.color);

    // And it stays there once the transitions are over.
    await settled(button);
    await expect(
      contrastRatio(getComputedStyle(button).outlineColor, pageBackground()),
      `${intent} settled focus ring against the page`,
    ).toBeGreaterThanOrEqual(3);
  }
};

const threeIntents: Story['render'] = () => (
  <div className="flex gap-3 bg-surface p-4">
    {intents.map(({ intent, label }) => (
      <Button key={intent} intent={intent}>
        {label}
      </Button>
    ))}
  </div>
);

/** Keyboard focus in the light theme: every intent keeps a ring of at least 3:1 (UI-24). */
export const FocoTemaClaro: Story = {
  name: 'Foco por teclado, tema claro',
  globals: { theme: 'light' },
  render: threeIntents,
  play: focusContrast,
};

/** Keyboard focus in the dark theme: every intent keeps a ring of at least 3:1 (UI-24). */
export const FocoTemaEscuro: Story = {
  name: 'Foco por teclado, tema escuro',
  globals: { theme: 'dark' },
  render: threeIntents,
  play: focusContrast,
};

const prumoIntents = [
  { intent: 'primary', label: 'Entrar' },
  { intent: 'secondary', label: 'Cancelar' },
  { intent: 'ghost', label: 'Ver convites' },
  { intent: 'danger', label: 'Revogar' },
] as const;

const fourIntents: Story['render'] = () => (
  <div className="flex flex-col gap-3 bg-surface p-4">
    <div className="flex gap-3">
      {prumoIntents.map(({ intent, label }) => (
        <Button key={intent} intent={intent}>
          {label}
        </Button>
      ))}
    </div>
    <div className="flex gap-3">
      {prumoIntents.map(({ intent, label }) => (
        <Button key={intent} intent={intent} size="sm">
          {`${label} sm`}
        </Button>
      ))}
    </div>
  </div>
);

/**
 * Every intent, at both sizes: the label reaches 4.5:1 on its own fill, and the keyboard ring of each
 * one is the focus token at 3:1 against the page (PRU-08 AC03, PRU-01 AC13).
 */
const prumoContrast: Story['play'] = async ({ canvas }) => {
  for (const { label } of prumoIntents) {
    await settled(canvas.getByRole('button', { name: label }));
    await settled(canvas.getByRole('button', { name: `${label} sm` }));
  }
  for (const { label } of prumoIntents) {
    await expectContrast(canvas.getByRole('button', { name: label }), 4.5);
    await expectContrast(canvas.getByRole('button', { name: `${label} sm` }), 4.5);
  }
  for (const { intent, label } of prumoIntents) {
    await userEvent.tab();
    const button = canvas.getByRole('button', { name: label });
    await expect(button, `${intent} takes the focus`).toHaveFocus();
    await settled(button);
    const ring = focusRing(button);
    await expect(ring.drawn, `${intent} draws the ring`).toBe(true);
    await expect(ring.isFocusToken, `${intent} ring is the focus token`).toBe(true);
    await expect(ring.ratio, `${intent} ring against the page`).toBeGreaterThanOrEqual(3);
    await expect(getComputedStyle(button).outlineWidth).toBe('2px');
    await expect(getComputedStyle(button).outlineOffset).toBe('2px');
  }
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: fourIntents,
  play: prumoContrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: fourIntents,
  play: prumoContrast,
};

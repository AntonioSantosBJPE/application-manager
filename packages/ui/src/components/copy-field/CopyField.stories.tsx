import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { focusRing, settle } from '../../testing/contrast';
import { CopyField } from './copy-field';

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

const meta = {
  title: 'Components/CopyField',
  component: CopyField,
  args: {
    value: 'https://app.example.com/invite/abc123',
    onCopy: fn(),
    copyLabel: 'Copiar',
    copiedLabel: 'Copiado',
    failureMessage: 'Não foi possível copiar. Selecione o link.',
    valueLabel: 'Link do convite',
  },
} satisfies Meta<typeof CopyField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Copiar' }));
    await expect(args.onCopy).toHaveBeenCalledTimes(1);
  },
};

export const Copiado: Story = {
  args: { status: 'copied' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Copiado' })).toBeVisible();
  },
};

export const Falha: Story = {
  name: 'Falha',
  args: { status: 'failed' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('Não foi possível copiar. Selecione o link.'),
    ).toBeVisible();
  },
};

/** Light theme through the toolbar global; asserts the light danger token reaches the failure. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { status: 'failed' },
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    // The light value of --color-danger in tokens.css.
    await expect(getComputedStyle(alert).color).toBe(resolvedColor('oklch(0.52 0.17 27)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark danger token reaches the failure. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { status: 'failed' },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    // The dark value of --color-danger in tokens.css.
    await expect(getComputedStyle(alert).color).toBe(resolvedColor('oklch(0.72 0.15 25)'));
  },
};

const longValue = `https://app.example.com/invite/${'a1b2c3d4'.repeat(16)}`;

/**
 * A link wider than the line (UI-25): the field stays inside its parent, the value stays whole and
 * selectable, and the copy action stays on screen.
 */
export const LinkLongo: Story = {
  name: 'Link longo',
  args: { value: longValue },
  decorators: [
    (Story) => (
      <div data-testid="narrow" style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const narrow = canvasElement.querySelector<HTMLElement>('[data-testid="narrow"]')!;
    const value = canvas.getByLabelText('Link do convite');
    const copy = canvas.getByRole('button', { name: 'Copiar' });

    await expect(value).toHaveValue(longValue);
    await expect(value).toHaveAttribute('readonly');
    await expect(
      narrow.scrollWidth,
      'the field does not push its parent wider',
    ).toBeLessThanOrEqual(narrow.clientWidth);
    const bounds = narrow.getBoundingClientRect();
    const copyBounds = copy.getBoundingClientRect();
    await expect(copyBounds.left).toBeGreaterThanOrEqual(bounds.left);
    await expect(copyBounds.right).toBeLessThanOrEqual(bounds.right);
    await expect(copy).toBeVisible();
    // The whole link is shown, wrapped, instead of a line cut by the box.
    await expect(value.scrollWidth, 'no hidden width in the value').toBeLessThanOrEqual(
      value.clientWidth,
    );
    await expect(value.scrollHeight, 'no hidden lines in the value').toBeLessThanOrEqual(
      value.clientHeight,
    );

    const selected = value as HTMLTextAreaElement;
    selected.focus();
    await expect(selected.selectionEnd - selected.selectionStart).toBe(longValue.length);
  },
};

/** Tabs to the value box and asserts its focus ring stands out from the page (UI-24). */
const focusContrast: Story['play'] = async ({ canvas }) => {
  const value = canvas.getByLabelText('Link do convite');
  // Let the theme switch finish first, so only the focus itself can move a color from here on.
  await settle(value);
  await userEvent.tab();
  await expect(value).toHaveFocus();

  const ring = focusRing(value);
  await expect(ring.drawn, 'the value box draws an outline').toBe(true);
  await expect(ring.ratio, 'focus ring against the page').toBeGreaterThanOrEqual(3);
  await expect(ring.isFocusToken, 'the ring is the --color-focus token').toBe(true);
  await expect(ring.isTextColor, 'the ring is not the text color').toBe(false);
};

/** Keyboard focus of the value box in the light theme: a ring of at least 3:1 (UI-24). */
export const FocoTemaClaro: Story = {
  name: 'Foco por teclado, tema claro',
  globals: { theme: 'light' },
  play: focusContrast,
};

/** Keyboard focus of the value box in the dark theme: a ring of at least 3:1 (UI-24). */
export const FocoTemaEscuro: Story = {
  name: 'Foco por teclado, tema escuro',
  globals: { theme: 'dark' },
  play: focusContrast,
};

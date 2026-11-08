import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { focusRing, settle } from '../../testing/contrast';
import { Field } from './field';

const meta = {
  title: 'Components/Field',
  component: Field.Root,
  render: (args) => (
    <Field.Root {...args}>
      <Field.Label htmlFor="field-email">E-mail</Field.Label>
      <Field.Control id="field-email" name="email" type="email" placeholder="nome@exemplo.com" />
      <Field.Hint>A senha é enviada no convite.</Field.Hint>
      <Field.Error>E-mail inválido.</Field.Error>
    </Field.Root>
  ),
} satisfies Meta<typeof Field.Root>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
};

export const Invalido: Story = {
  name: 'Inválido',
  args: { invalid: true },
};

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/** Light theme through the toolbar global; asserts the light danger token reaches the error. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { invalid: true },
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const error = canvas.getByText('E-mail inválido.');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    // The light value of --color-danger in tokens.css.
    await expect(getComputedStyle(error).color).toBe(resolvedColor('oklch(0.52 0.17 27)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark danger token reaches the error. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { invalid: true },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const error = canvas.getByText('E-mail inválido.');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    // The dark value of --color-danger in tokens.css.
    await expect(getComputedStyle(error).color).toBe(resolvedColor('oklch(0.72 0.15 25)'));
  },
};

/** Tabs to the control and asserts its focus ring stands out from the page (UI-24). */
const focusContrast: Story['play'] = async ({ canvas }) => {
  const control = canvas.getByLabelText('E-mail');
  // Let the theme switch finish first, so only the focus itself can move a color from here on.
  await settle(control);
  await userEvent.tab();
  await expect(control).toHaveFocus();

  const ring = focusRing(control);
  await expect(ring.drawn, 'the control draws an outline').toBe(true);
  await expect(ring.ratio, 'focus ring against the page').toBeGreaterThanOrEqual(3);
  await expect(ring.isFocusToken, 'the ring is the --color-focus token').toBe(true);
  await expect(ring.isTextColor, 'the ring is not the text color').toBe(false);
};

/** Keyboard focus of the control in the light theme: a ring of at least 3:1 (UI-24). */
export const FocoTemaClaro: Story = {
  name: 'Foco por teclado, tema claro',
  globals: { theme: 'light' },
  play: focusContrast,
};

/** Keyboard focus of the control in the dark theme: a ring of at least 3:1 (UI-24). */
export const FocoTemaEscuro: Story = {
  name: 'Foco por teclado, tema escuro',
  globals: { theme: 'dark' },
  play: focusContrast,
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { expectContrast, focusRing, settle } from '../../testing/contrast';
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

export const SomenteLeitura: Story = {
  name: 'Somente leitura',
  render: () => (
    <Field.Root>
      <Field.Label htmlFor="field-invite-email">E-mail</Field.Label>
      <Field.Control id="field-invite-email" type="email" readOnly value="ana@exemplo.com" />
    </Field.Root>
  ),
};

export const Textarea: Story = {
  name: 'Textarea',
  render: () => (
    <Field.Root className="w-80">
      <Field.Label htmlFor="field-notes">Notas</Field.Label>
      <Field.Textarea id="field-notes" placeholder="O que ficou combinado na entrevista" />
      <Field.Hint>Até 2000 caracteres.</Field.Hint>
    </Field.Root>
  ),
};

export const TextareaInvalida: Story = {
  name: 'Textarea inválida',
  render: () => (
    <Field.Root className="w-80" invalid>
      <Field.Label htmlFor="field-notes-invalid">Notas</Field.Label>
      <Field.Textarea id="field-notes-invalid" />
      <Field.Error>As notas passam de 2000 caracteres.</Field.Error>
    </Field.Root>
  ),
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

/** Every state of a field side by side: default with hint, invalid, read-only and textarea. */
const allStates: Story['render'] = () => (
  <div className="flex w-80 flex-col gap-4 bg-surface p-4">
    <Field.Root>
      <Field.Label htmlFor="contrast-name">Nome</Field.Label>
      <Field.Control id="contrast-name" />
      <Field.Hint>Como aparece no currículo.</Field.Hint>
    </Field.Root>
    <Field.Root invalid>
      <Field.Label htmlFor="contrast-password">Senha</Field.Label>
      <Field.Control id="contrast-password" type="password" />
      <Field.Error>A senha precisa ter de 12 a 128 caracteres.</Field.Error>
    </Field.Root>
    <Field.Root>
      <Field.Label htmlFor="contrast-email">E-mail</Field.Label>
      <Field.Control id="contrast-email" readOnly value="ana@exemplo.com" />
    </Field.Root>
    <Field.Root>
      <Field.Label htmlFor="contrast-notes">Notas</Field.Label>
      <Field.Textarea id="contrast-notes" />
    </Field.Root>
  </div>
);

/**
 * Texts at 4.5:1, control borders and the error icon at 3:1, and the keyboard focus of a text
 * field drawn 1px inside with the border in focus (PRU-08 AC03, PRU-01 AC13).
 */
const contrast: Story['play'] = async ({ canvas }) => {
  const name = canvas.getByLabelText('Nome');
  await settle(name);
  for (const label of ['Nome', 'Senha', 'E-mail', 'Notas']) {
    await expectContrast(canvas.getByText(label), 4.5);
  }
  await expectContrast(canvas.getByText('Como aparece no currículo.'), 4.5);
  const error = canvas.getByText('A senha precisa ter de 12 a 128 caracteres.');
  await expectContrast(error, 4.5);
  await expectContrast(error.querySelector('svg')!, 3);
  await expectContrast(name, 3, 'borderTopColor');
  await expectContrast(canvas.getByLabelText('Notas'), 3, 'borderTopColor');
  await expectContrast(canvas.getByLabelText('Senha'), 3, 'borderTopColor');
  await expectContrast(canvas.getByLabelText('E-mail'), 4.5);

  await userEvent.tab();
  await expect(name).toHaveFocus();
  await settle(name);
  const ring = focusRing(name);
  await expect(ring.drawn).toBe(true);
  await expect(ring.isFocusToken).toBe(true);
  await expect(getComputedStyle(name).outlineOffset).toBe('-1px');
  await expect(getComputedStyle(name).borderTopColor).toBe(getComputedStyle(name).outlineColor);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: allStates,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: allStates,
  play: contrast,
};

const passwordField: Story['render'] = () => (
  <Field.Root className="w-80">
    <Field.Label htmlFor="field-password">Senha</Field.Label>
    <Field.PasswordControl
      id="field-password"
      name="password"
      autoComplete="current-password"
      toggleLabel="Mostrar senha"
    />
    <Field.Hint>Use de 12 a 128 caracteres.</Field.Hint>
  </Field.Root>
);

/**
 * Types a password, shows it and hides it again with the toggle; the toggle icon reaches 3:1 and
 * its keyboard ring is the focus token (PRU-03 AC03, PRU-08 AC03).
 */
const showAndHide: Story['play'] = async ({ canvas }) => {
  const control = canvas.getByLabelText<HTMLInputElement>('Senha');
  await settle(control);
  await userEvent.type(control, 'correct-horse-battery');
  await expect(control).toHaveAttribute('type', 'password');

  await userEvent.click(canvas.getByRole('button', { name: 'Mostrar senha' }));
  await expect(control).toHaveAttribute('type', 'text');
  await expect(control).toHaveValue('correct-horse-battery');

  const toggle = canvas.getByRole('button', { name: 'Mostrar senha', pressed: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await settle(toggle);
  await expectContrast(toggle.querySelector('svg')!, 3);
  const ring = focusRing(toggle);
  await expect(ring.drawn, 'the focused toggle draws its ring').toBe(true);
  await expect(ring.ratio).toBeGreaterThanOrEqual(3);

  await userEvent.click(toggle);
  await expect(control).toHaveAttribute('type', 'password');
  await expect(control).toHaveValue('correct-horse-battery');
};

export const Senha: Story = {
  name: 'Senha',
  render: passwordField,
};

export const SenhaClaro: Story = {
  name: 'PRU-03 AC03 Senha, tema claro',
  globals: { theme: 'light' },
  render: passwordField,
  play: showAndHide,
};

export const SenhaEscuro: Story = {
  name: 'PRU-03 AC03 Senha, tema escuro',
  globals: { theme: 'dark' },
  render: passwordField,
  play: showAndHide,
};

const disabledFields: Story['render'] = () => (
  <div className="flex w-80 flex-col gap-4 bg-surface p-4">
    <Field.Root>
      <Field.Label htmlFor="field-disabled-email">E-mail</Field.Label>
      <Field.Control id="field-disabled-email" type="email" disabled defaultValue="ana@exemplo.com" />
    </Field.Root>
    <Field.Root>
      <Field.Label htmlFor="field-disabled-password">Senha</Field.Label>
      <Field.PasswordControl
        id="field-disabled-password"
        autoComplete="current-password"
        toggleLabel="Mostrar senha"
        disabled
        defaultValue="correct-horse-battery"
      />
    </Field.Root>
  </div>
);

/**
 * A disabled control and a disabled password field: neither takes typing nor focus, and the toggle is
 * disabled with the field, so the value stays hidden (PRU-08 AC04, PRU-03 AC07).
 */
const disabledPlay: Story['play'] = async ({ canvas }) => {
  const email = canvas.getByLabelText<HTMLInputElement>('E-mail');
  const password = canvas.getByLabelText<HTMLInputElement>('Senha');
  const toggle = canvas.getByRole('button', { name: 'Mostrar senha' });

  await expect(email).toBeDisabled();
  await expect(password).toBeDisabled();
  await expect(toggle).toBeDisabled();
  await userEvent.type(email, 'x');
  await expect(email).toHaveValue('ana@exemplo.com');
  await userEvent.click(toggle);
  await expect(password).toHaveAttribute('type', 'password');
  await userEvent.tab();
  await expect(document.activeElement).not.toBe(email);
  await expect(document.activeElement).not.toBe(password);
  await expect(document.activeElement).not.toBe(toggle);
};

export const DesabilitadoClaro: Story = {
  name: 'Desabilitado, tema claro',
  globals: { theme: 'light' },
  render: disabledFields,
  play: disabledPlay,
};

export const DesabilitadoEscuro: Story = {
  name: 'Desabilitado, tema escuro',
  globals: { theme: 'dark' },
  render: disabledFields,
  play: disabledPlay,
};

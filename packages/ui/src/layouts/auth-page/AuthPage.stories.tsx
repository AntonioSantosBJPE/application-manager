import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { Alert } from '../../components/alert';
import { Button } from '../../components/button';
import { Field } from '../../components/field';
import { AuthPage } from './auth-page';

const meta = {
  title: 'Layouts/AuthPage',
  component: AuthPage.Root,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AuthPage.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

function LoginPage({ error }: { error?: string }) {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-lg font-medium">Entrar</h1>
        <p className="text-xs text-text-muted">Use o e-mail e a senha da sua conta.</p>
      </AuthPage.Header>
      <AuthPage.Form>
        {error === undefined ? null : <Alert intent="danger">{error}</Alert>}
        <Field.Root>
          <Field.Label htmlFor="auth-email">E-mail</Field.Label>
          <Field.Control id="auth-email" name="email" type="email" />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor="auth-password">Senha</Field.Label>
          <Field.Control id="auth-password" name="password" type="password" />
          <Field.Hint>Mínimo de 12 caracteres.</Field.Hint>
        </Field.Root>
        <Button type="submit">Entrar</Button>
      </AuthPage.Form>
      <AuthPage.Footer>
        <a className="text-xs text-text-muted" href="/invite/exemplo">
          Tenho um convite
        </a>
      </AuthPage.Footer>
    </AuthPage.Root>
  );
}

export const Padrao: Story = {
  name: 'Padrão',
  render: () => <LoginPage />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('E-mail'), 'ana@example.com');
    await expect(canvas.getByLabelText('E-mail')).toHaveValue('ana@example.com');
  },
};

export const ComErro: Story = {
  name: 'Com erro',
  render: () => <LoginPage error="E-mail ou senha incorretos." />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  },
};

/** Light theme through the toolbar global; asserts the light text token reaches the page. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  render: () => <LoginPage />,
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const main = canvas.getByRole('main');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await expect(main).toHaveAttribute('data-archetype', 'auth');
    // The light value of --color-text in tokens.css.
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.24 0.02 260)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark text token reaches the page. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  render: () => <LoginPage />,
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const main = canvas.getByRole('main');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await expect(main).toHaveAttribute('data-archetype', 'auth');
    // The dark value of --color-text in tokens.css.
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.96 0.005 260)'));
  },
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

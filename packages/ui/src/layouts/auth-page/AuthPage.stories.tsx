import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { expect, userEvent } from 'storybook/test';
import { Alert } from '../../components/alert';
import { Button } from '../../components/button';
import { Field } from '../../components/field';
import { expectContrast } from '../../testing/contrast';
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
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.21 0.012 250)'));
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
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.955 0.003 250)'));
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

/** The sign-in screen as the Prumo draws it: mark, title, line, alert, fields, button and footer. */
function EntrarPage() {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-heading-xl">Entrar</h1>
        <p className="text-text-muted">Rumo Carreira — suas candidaturas e currículos</p>
      </AuthPage.Header>
      <Alert intent="info">Sua sessão expirou. Entre de novo para continuar.</Alert>
      <AuthPage.Form>
        <Field.Root>
          <Field.Label htmlFor="entrar-email">E-mail</Field.Label>
          <Field.Control id="entrar-email" type="email" defaultValue="marina@exemplo.com" />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor="entrar-senha">Senha</Field.Label>
          <Field.PasswordControl
            id="entrar-senha"
            toggleLabel="Mostrar senha"
            defaultValue="senha-de-exemplo"
          />
        </Field.Root>
        <Button type="submit">Entrar</Button>
      </AuthPage.Form>
      <AuthPage.Footer>
        O acesso é por convite. Esqueceu a senha? Fale com quem te convidou.
      </AuthPage.Footer>
    </AuthPage.Root>
  );
}

/** The invitation screen: read-only e-mail, a hint and the expiry in the footer. */
function ConvitePage() {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-heading-xl">Criar conta</h1>
        <p className="text-text-muted">Você recebeu um convite para o Rumo Carreira.</p>
      </AuthPage.Header>
      <AuthPage.Form>
        <Field.Root>
          <Field.Label htmlFor="convite-email">E-mail</Field.Label>
          <Field.Control id="convite-email" readOnly defaultValue="ana@exemplo.com" />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor="convite-nome">Nome</Field.Label>
          <Field.Control id="convite-nome" />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor="convite-senha">Senha</Field.Label>
          <Field.PasswordControl id="convite-senha" toggleLabel="Mostrar senha" />
          <Field.Hint>Use de 12 a 128 caracteres.</Field.Hint>
        </Field.Root>
        <Button type="submit">Criar conta</Button>
      </AuthPage.Form>
      <AuthPage.Footer>O convite vale até 15 de novembro de 2026.</AuthPage.Footer>
    </AuthPage.Root>
  );
}

/** An access screen: a message and one way out, no form. */
function AcessoPage() {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-heading-xl">Convite inválido</h1>
        <p className="text-text-muted">
          Este convite expirou ou já foi usado. Peça um novo link a quem te convidou.
        </p>
      </AuthPage.Header>
      <Button asChild intent="secondary">
        <a href="/login">Ir para o login</a>
      </Button>
    </AuthPage.Root>
  );
}

export const Entrar: Story = {
  name: 'Entrar',
  render: () => <EntrarPage />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Sua sessão expirou');
    await userEvent.click(canvas.getByRole('button', { name: 'Mostrar senha' }));
    await expect(canvas.getByLabelText('Senha')).toHaveAttribute('type', 'text');
  },
};

export const Convite: Story = {
  name: 'Convite',
  render: () => <ConvitePage />,
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('E-mail')).toHaveAttribute('readonly');
    await expect(canvas.getByText('Use de 12 a 128 caracteres.')).toBeVisible();
  },
};

export const Acesso: Story = {
  name: 'Acesso',
  render: () => <AcessoPage />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Convite inválido' })).toBeVisible();
    await expect(canvas.queryByRole('textbox')).toBeNull();
  },
};

/** At 360 px the column shrinks to the screen and nothing scrolls sideways (PRU-04 AC07). */
export const Estreito: Story = {
  name: 'PRU-04 AC07 Estreito, 360 px',
  render: () => <EntrarPage />,
  play: async ({ canvas }) => {
    await page.viewport(360, 800);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    await expect(canvas.getByRole('button', { name: 'Entrar' }).getBoundingClientRect().right).toBeLessThanOrEqual(360);
    await page.viewport(1280, 800);
  },
};

/** Title and line at 4.5:1 over `surface`, and the footer note over `surface`. */
const contrast: Story['play'] = async ({ canvas }) => {
  await expectContrast(canvas.getByRole('heading', { name: 'Entrar' }), 4.5);
  await expectContrast(canvas.getByText('Rumo Carreira — suas candidaturas e currículos'), 4.5);
  await expectContrast(canvas.getByText(/O acesso é por convite/), 4.5);
  await expectContrast(canvas.getByText('E-mail'), 4.5);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => <EntrarPage />,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => <EntrarPage />,
  play: contrast,
};

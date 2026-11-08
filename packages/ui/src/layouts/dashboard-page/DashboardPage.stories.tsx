import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { expect } from 'storybook/test';
import { StatusBadge } from '../../components/status-badge';
import { expectContrast } from '../../testing/contrast';
import { AppShell } from '../app-shell';
import { DashboardPage } from './dashboard-page';

const meta = {
  title: 'Layouts/DashboardPage',
  component: DashboardPage.Root,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DashboardPage.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  render: () => (
    <DashboardPage.Root>
      <AppShell.Topbar>
        <b className="text-body font-medium">Status do sistema</b>
      </AppShell.Topbar>
      <DashboardPage.Content>
        <DashboardPage.Header>
          <h1 className="text-heading-lg">Status do sistema</h1>
        </DashboardPage.Header>
        <DashboardPage.Grid>
          <DashboardPage.Widget span={6}>
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>API</DashboardPage.Widget.Title>
            </DashboardPage.Widget.Header>
            <StatusBadge intent="operational">Operacional</StatusBadge>
          </DashboardPage.Widget>
          <DashboardPage.Widget span={6}>
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>Banco de dados</DashboardPage.Widget.Title>
            </DashboardPage.Widget.Header>
            <StatusBadge intent="unavailable">Indisponível</StatusBadge>
          </DashboardPage.Widget>
        </DashboardPage.Grid>
      </DashboardPage.Content>
    </DashboardPage.Root>
  ),
};

/**
 * The admin panel as the Prumo draws it: the topbar edge to edge, then a context line, widgets that
 * lead somewhere, a number.
 */
function Painel() {
  return (
    <DashboardPage.Root>
      <AppShell.Topbar>
        <b className="text-body font-medium">Painel</b>
      </AppShell.Topbar>
      <DashboardPage.Content>
        <DashboardPage.Header>
          <h1 className="text-heading-lg">Administração</h1>
          <p className="text-text-muted">Estado do produto e dos convites.</p>
        </DashboardPage.Header>
        <DashboardPage.Grid>
          <DashboardPage.Widget span={6}>
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>Status do sistema</DashboardPage.Widget.Title>
              <StatusBadge intent="operational">Operacional</StatusBadge>
            </DashboardPage.Widget.Header>
            <p className="text-text-muted">Verificado às 14:32 de 08 nov 2026.</p>
          </DashboardPage.Widget>
          <DashboardPage.Widget span={6}>
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>Convites pendentes</DashboardPage.Widget.Title>
              <DashboardPage.Widget.Action asChild>
                <a href="/admin/invitations" onClick={(event) => event.preventDefault()}>
                  Ver convites
                </a>
              </DashboardPage.Widget.Action>
            </DashboardPage.Widget.Header>
            <p className="font-mono text-heading-xl">3</p>
            <p className="text-caption text-text-muted">O mais antigo expira em 2 d.</p>
          </DashboardPage.Widget>
          <DashboardPage.Widget span={4}>
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>Um terço</DashboardPage.Widget.Title>
            </DashboardPage.Widget.Header>
            <p className="text-text-muted">3 de 12 colunas.</p>
          </DashboardPage.Widget>
          <DashboardPage.Widget span={8}>
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>Dois terços</DashboardPage.Widget.Title>
            </DashboardPage.Widget.Header>
            <p className="text-text-muted">8 de 12 colunas.</p>
          </DashboardPage.Widget>
        </DashboardPage.Grid>
      </DashboardPage.Content>
    </DashboardPage.Root>
  );
}

export const PainelComWidgets: Story = {
  name: 'Painel com widgets',
  render: () => <Painel />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Administração' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Ver convites' })).toBeVisible();
    await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  },
};

/** At 360 px the widgets stack in one column and the page does not scroll sideways (PRU-04 AC13). */
export const Estreito: Story = {
  name: 'PRU-04 AC13 Estreito, 360 px',
  render: () => <Painel />,
  play: async () => {
    await page.viewport(360, 800);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    await page.viewport(1280, 800);
  },
};

/** Title, context line, widget titles, the number and the link at 4.5:1 over what is behind them. */
const contrast: Story['play'] = async ({ canvas }) => {
  await expectContrast(canvas.getByRole('heading', { level: 1 }), 4.5);
  await expectContrast(canvas.getByText('Estado do produto e dos convites.'), 4.5);
  for (const title of canvas.getAllByRole('heading', { level: 2 })) await expectContrast(title, 4.5);
  await expectContrast(canvas.getByText('3', { selector: 'p' }), 4.5);
  await expectContrast(canvas.getByRole('link', { name: 'Ver convites' }), 4.5);
  await expectContrast(canvas.getByText('O mais antigo expira em 2 d.'), 4.5);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => <Painel />,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Painel />,
  play: contrast,
};

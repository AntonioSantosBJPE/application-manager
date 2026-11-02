import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusBadge } from '../../components/status-badge';
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
      <DashboardPage.Header>
        <h1 className="text-lg font-medium">Status do sistema</h1>
      </DashboardPage.Header>
      <DashboardPage.Grid>
        <div className="rounded-md border border-border bg-surface-raised p-4">
          <p className="text-text-muted">API</p>
          <StatusBadge intent="operational">Operacional</StatusBadge>
        </div>
        <div className="rounded-md border border-border bg-surface-raised p-4">
          <p className="text-text-muted">Banco de dados</p>
          <StatusBadge intent="unavailable">Indisponível</StatusBadge>
        </div>
      </DashboardPage.Grid>
    </DashboardPage.Root>
  ),
};

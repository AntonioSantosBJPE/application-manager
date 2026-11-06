import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Button } from '../../components/button';
import { ListPage } from './list-page';

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
  title: 'Layouts/ListPage',
  component: ListPage.Root,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ListPage.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const invitations = ['ana@example.com', 'bruno@example.com', 'carla@example.com'];

function InvitationsList({ empty = false }: { empty?: boolean }) {
  return (
    <ListPage.Root>
      <ListPage.Header>
        <h1 className="text-lg font-medium">Convites pendentes</h1>
        <Button>Convidar</Button>
      </ListPage.Header>
      <ListPage.Filters>
        <label className="text-xs text-text-muted" htmlFor="list-filter">
          E-mail
        </label>
        <input
          id="list-filter"
          className="h-8 rounded-sm border border-border bg-surface px-2 text-xs text-text"
        />
      </ListPage.Filters>
      <ListPage.Content>
        {empty ? (
          <p className="text-xs text-text-muted">Nenhum convite pendente.</p>
        ) : (
          invitations.map((email) => (
            <div
              key={email}
              className="flex items-center justify-between border-b border-border py-2 text-xs"
            >
              <span>{email}</span>
              <Button intent="secondary" size="sm">
                Revogar
              </Button>
            </div>
          ))
        )}
      </ListPage.Content>
    </ListPage.Root>
  );
}

export const Padrao: Story = {
  name: 'Padrão',
  render: () => <InvitationsList />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('search')).toBeVisible();
    await expect(canvas.getByText('ana@example.com')).toBeVisible();
  },
};

export const Vazio: Story = {
  name: 'Vazio',
  render: () => <InvitationsList empty />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Nenhum convite pendente.')).toBeVisible();
  },
};

/** Light theme through the toolbar global; asserts the light text token reaches the page. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  render: () => <InvitationsList />,
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const main = canvas.getByRole('main');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await expect(main).toHaveAttribute('data-archetype', 'list');
    // The light value of --color-text in tokens.css.
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.24 0.02 260)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark text token reaches the page. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  render: () => <InvitationsList />,
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const main = canvas.getByRole('main');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await expect(main).toHaveAttribute('data-archetype', 'list');
    // The dark value of --color-text in tokens.css.
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.96 0.005 260)'));
  },
};

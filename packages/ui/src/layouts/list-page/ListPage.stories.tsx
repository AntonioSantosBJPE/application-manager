import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { expect } from 'storybook/test';
import { Button } from '../../components/button';
import { expectContrast } from '../../testing/contrast';
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
      <ListPage.Filters aria-label="Filtrar convites">
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
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.21 0.012 250)'));
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
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.955 0.003 250)'));
  },
};

const longEmail = `${'a'.repeat(60)}@${'d'.repeat(55)}.example.com`;

/**
 * A row at 375 px (UI-28): the text takes the whole line instead of a squeezed column, the action stays
 * inside the viewport and the page has no horizontal scroll.
 */
export const LinhaEstreita: Story = {
  name: 'Linha estreita',
  render: () => (
    <ListPage.Root>
      <ListPage.Header>
        <h1 className="text-lg font-medium">Convites pendentes</h1>
      </ListPage.Header>
      <ListPage.Content>
        <ul aria-label="Convites">
          {['ana@example.com', longEmail].map((email) => (
            <ListPage.Row key={email}>
              <ListPage.RowText>{email}</ListPage.RowText>
              <Button intent="secondary" size="sm">
                Revogar
              </Button>
            </ListPage.Row>
          ))}
        </ul>
      </ListPage.Content>
    </ListPage.Root>
  ),
  play: async ({ canvas }) => {
    await page.viewport(375, 700);
    const width = document.documentElement.clientWidth;
    const rows = canvas.getAllByRole('listitem');

    for (const row of rows) {
      const text = row.firstElementChild!.getBoundingClientRect();
      const action = row.querySelector('button')!.getBoundingClientRect();
      await expect(text.width, 'the text uses the whole row').toBeGreaterThanOrEqual(
        row.clientWidth - 1,
      );
      await expect(text.left).toBeGreaterThanOrEqual(0);
      await expect(action.right, 'the action stays on screen').toBeLessThanOrEqual(width);
    }
    await expect(document.documentElement.scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(
      width,
    );
  },
};

/** The collection as the Prumo draws it: topbar, filter row, two groups of dense rows. */
function Candidaturas() {
  return (
    <ListPage.Root>
      <ListPage.Header>
        <h1>Candidaturas</h1>
        <span className="font-mono text-caption font-normal text-text-muted">3</span>
        <Button size="sm" className="ml-auto">
          Nova
        </Button>
      </ListPage.Header>
      <ListPage.Filters aria-label="Filtros de candidaturas">
        <Button intent="secondary" size="sm">
          Ativas
        </Button>
        <Button intent="ghost" size="sm">
          Nível
        </Button>
      </ListPage.Filters>
      <ListPage.Content>
        <ListPage.Group count={2}>Em entrevistas</ListPage.Group>
        <ul aria-label="Em entrevistas">
          <ListPage.Row selected>
            <ListPage.RowText>Acme Pagamentos · Backend Pleno</ListPage.RowText>
            <ListPage.RowMeta>
              <span className="w-20 text-right font-mono text-caption">há 2 d</span>
            </ListPage.RowMeta>
          </ListPage.Row>
          <ListPage.Row>
            <ListPage.RowText>Nimbus Saúde · Full Stack Sênior</ListPage.RowText>
            <ListPage.RowMeta>
              <span className="w-20 text-right font-mono text-caption">há 5 d</span>
            </ListPage.RowMeta>
          </ListPage.Row>
        </ul>
        <ListPage.Group count={1}>Enviadas</ListPage.Group>
        <ul aria-label="Enviadas">
          <ListPage.Row>
            <ListPage.RowText>Orbe Logística · Desenvolvedor Node.js</ListPage.RowText>
            <ListPage.RowMeta>
              <span className="w-20 text-right font-mono text-caption">há 9 d</span>
            </ListPage.RowMeta>
          </ListPage.Row>
        </ul>
      </ListPage.Content>
    </ListPage.Root>
  );
}

export const ListaComGrupos: Story = {
  name: 'Lista com grupos',
  render: () => <Candidaturas />,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
    await expect(canvas.getByRole('search', { name: 'Filtros de candidaturas' })).toBeVisible();
  },
};

/** At 360 px the rows wrap and the page does not scroll sideways (PRU-04 AC12). */
export const Estreito: Story = {
  name: 'PRU-04 AC12 Estreito, 360 px',
  render: () => <Candidaturas />,
  play: async () => {
    await page.viewport(360, 800);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    await page.viewport(1280, 800);
  },
};

/** Title, count, group labels, row text and metadata at 4.5:1 over what is painted behind them. */
const contrast: Story['play'] = async ({ canvas }) => {
  await expectContrast(canvas.getByRole('heading', { name: 'Candidaturas' }), 4.5);
  await expectContrast(canvas.getByText('3', { selector: 'span' }), 4.5);
  for (const group of canvas.getAllByRole('heading', { level: 2 })) await expectContrast(group, 4.5);
  for (const row of canvas.getAllByRole('listitem')) await expectContrast(row, 4.5);
  for (const date of canvas.getAllByText(/^há \d d$/)) await expectContrast(date, 4.5);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => <Candidaturas />,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Candidaturas />,
  play: contrast,
};

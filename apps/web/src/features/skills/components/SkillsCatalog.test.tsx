// @vitest-environment jsdom
import type { AdminSkill } from '@am/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadAdminSkills } from '../api/server-functions';
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from '../model/filters';
import { apiInternalUrl, context, problem } from '../testing/api';
import { fakeCatalog, uuid } from '../testing/fake-api';
import { SkillsCatalog } from './SkillsCatalog';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const alfa: AdminSkill = {
  id: uuid(1),
  name: 'Skill Fictícia Alfa',
  category: 'language',
  scope: 'global',
  aliases: [{ id: uuid(11), alias: 'alfa' }],
};
const beta: AdminSkill = {
  id: uuid(2),
  name: 'Skill Fictícia Beta',
  category: 'database',
  scope: 'global',
  aliases: [],
};
const drizzle: AdminSkill = {
  id: uuid(3),
  name: 'Drizzle ORM de Teste',
  category: 'tool',
  scope: 'private',
  aliases: [],
};

function renderCatalog(options: {
  filters?: CatalogFilters;
  onExpired?: (outcome: unknown) => boolean;
} = {}) {
  const client = new QueryClient();
  const onExpired = vi.fn(options.onExpired ?? (() => false));
  render(
    <QueryClientProvider client={client}>
      <SkillsCatalog
        filters={options.filters ?? DEFAULT_CATALOG_FILTERS}
        onExpired={onExpired}
        api={{
          list: (filters, cursor) =>
            loadAdminSkills(
              {
                scope: filters.scope,
                category: filters.category,
                q: filters.q === '' ? undefined : filters.q,
                cursor,
              },
              context,
            ),
        }}
      />
    </QueryClientProvider>,
  );
  return { onExpired };
}

const rows = async () => within(await screen.findByRole('list', { name: 'Skills' })).getAllByRole('listitem');

describe('SkillsCatalog', () => {
  it('SKL-38 shows the title with the total of the catalog in mono, the Apelido button with the plus icon and the info note', async () => {
    fakeCatalog(server, [beta, drizzle, alfa]);
    renderCatalog();
    await rows();

    const title = screen.getByRole('heading', { level: 1 });
    expect(title.textContent).toBe('Catálogo de skills');
    const total = screen.getByText('3');
    expect(total).toHaveClass('font-mono');
    expect(title.parentElement).toContainElement(total);
    const add = within(title.parentElement!).getByRole('button', { name: 'Apelido' });
    expect(add.firstElementChild).toHaveClass('lucide-plus');
    expect(add.textContent).toBe('Apelido');
    const note = screen.getByRole('status');
    expect(note.textContent).toBe(
      'Promover torna a skill global. Se a chave já existir como global, a promoção é recusada e a fusão é manual.',
    );
  });

  it('SKL-38 lists the skills in the alphabetical order the api answers, with no "N vagas" and no group "Mais usadas" (AD-013)', async () => {
    fakeCatalog(server, [beta, drizzle, alfa]);
    renderCatalog();

    const list = await rows();

    expect(list.map((row) => within(row).getAllByText(/^(Skill|Drizzle)/)[0]!.textContent)).toEqual([
      'Drizzle ORM de Teste',
      'Skill Fictícia Alfa',
      'Skill Fictícia Beta',
    ]);
    expect(screen.queryByText(/vagas/)).toBeNull();
    expect(screen.queryByText('Mais usadas')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('SKL-44 shows Carregar mais only while the answer has a nextCursor and appends the next page', async () => {
    const calls = fakeCatalog(server, [alfa, beta, drizzle], 2);
    renderCatalog();
    expect(await rows()).toHaveLength(2);
    expect(screen.queryByText('Skill Fictícia Beta')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('Skill Fictícia Beta')).toBeInTheDocument();
    expect(await rows()).toHaveLength(3);
    expect(screen.getByText('Drizzle ORM de Teste')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
    expect(calls.calls).toEqual(['GET /admin/skills?scope=all', `GET /admin/skills?scope=all&cursor=${uuid(1)}`]);
  });

  it('SKL-44 hides Carregar mais when the first answer has no nextCursor', async () => {
    fakeCatalog(server, [alfa, beta]);
    renderCatalog();
    await rows();

    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('SKL-44 moves the focus to the first row added by Carregar mais', async () => {
    fakeCatalog(server, [alfa, beta, drizzle], 2);
    renderCatalog();
    await rows();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    const row = (await screen.findByText('Skill Fictícia Beta')).closest('li');
    await waitFor(() => expect(row).toHaveFocus());
  });

  it('SKL-51 shows a danger Alert with the unavailable text and no rows when the read fails', async () => {
    server.use(http.get(`${apiInternalUrl}/admin/skills`, () => problem(503)));
    renderCatalog();

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe('Serviço indisponível. Tente novamente em instantes.');
    expect(alert).toHaveClass('bg-danger-subtle');
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Skills' })).toBeNull();
  });

  it('SKL-51 hands a 401 to onExpired with the failed outcome and shows no alert while the login opens', async () => {
    server.use(http.get(`${apiInternalUrl}/admin/skills`, () => problem(401)));
    const { onExpired } = renderCatalog({ onExpired: () => true });

    await waitFor(() =>
      expect(onExpired).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: 401 })),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});

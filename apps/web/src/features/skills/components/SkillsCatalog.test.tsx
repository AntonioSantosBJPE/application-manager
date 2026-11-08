// @vitest-environment jsdom
import type { AdminSkill } from '@am/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import { useState } from 'react';
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

/** The catalog the way the route holds it: the filters live outside it and come back through `onFiltersChange`. */
function Harness({
  initial,
  onChange,
  onExpired,
}: {
  initial: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onExpired: (outcome: unknown) => boolean;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <SkillsCatalog
      filters={filters}
      onFiltersChange={(next) => {
        onChange(next);
        setFilters(next);
      }}
      onExpired={onExpired}
      api={{
        list: (current, cursor) =>
          loadAdminSkills(
            {
              scope: current.scope,
              category: current.category,
              q: current.q === '' ? undefined : current.q,
              cursor,
            },
            context,
          ),
      }}
    />
  );
}

function renderCatalog(options: {
  filters?: CatalogFilters;
  onExpired?: (outcome: unknown) => boolean;
} = {}) {
  const client = new QueryClient();
  const onExpired = vi.fn(options.onExpired ?? (() => false));
  const onFiltersChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <Harness
        initial={options.filters ?? DEFAULT_CATALOG_FILTERS}
        onChange={onFiltersChange}
        onExpired={onExpired}
      />
    </QueryClientProvider>,
  );
  return { onExpired, onFiltersChange };
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

const global_ = (n: number, name: string, category: AdminSkill['category']): AdminSkill => ({
  id: uuid(n),
  name,
  category,
  scope: 'global',
  aliases: [],
});

describe('SkillsCatalog filters', () => {
  it('SKL-38 shows the chips Todas and Privadas with its count, the seven category chips and the search field Nome ou apelido', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    await rows();

    const filters = screen.getByRole('search', { name: 'Filtros' });
    expect(
      within(filters)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual([
      'Todas',
      'Privadas1',
      'Linguagem',
      'Framework',
      'Banco de dados',
      'Cloud/DevOps',
      'Ferramenta',
      'Prática',
      'Soft skill',
    ]);
    expect(within(filters).getByText('1')).toHaveClass('font-mono');
    expect(within(filters).getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    const search = within(filters).getByRole('searchbox', { name: 'Nome ou apelido' });
    expect(search).toHaveAttribute('placeholder', 'Nome ou apelido');
  });

  it('SKL-41 lists only the private skills and puts scope=private in the filters when Privadas is chosen, keeping the counts', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    const { onFiltersChange } = renderCatalog();
    await rows();

    fireEvent.click(screen.getByRole('button', { name: /^Privadas/ }));

    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ scope: 'private', category: undefined, q: '' });
    expect(screen.getByText('Drizzle ORM de Teste')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Privadas/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('3')).toHaveClass('font-mono');

    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    await waitFor(async () => expect(await rows()).toHaveLength(3));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ scope: 'all', category: undefined, q: '' });
  });

  it('SKL-41 lists only the category chosen and puts category in the filters', async () => {
    const calls = fakeCatalog(server, [alfa, beta, drizzle]);
    const { onFiltersChange } = renderCatalog();
    await rows();

    fireEvent.click(screen.getByRole('button', { name: 'Banco de dados' }));

    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(screen.getByText('Skill Fictícia Beta')).toBeInTheDocument();
    expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ scope: 'all', category: 'database', q: '' });
    expect(calls.calls.at(-1)).toBe('GET /admin/skills?scope=all&category=database');
  });

  it('SKL-41 starts from the filters the address holds: chips pressed, search text filled and only the matches listed', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog({ filters: { scope: 'private', category: 'tool', q: 'drizzle' } });

    expect(await rows()).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Privadas/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ferramenta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Linguagem' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('searchbox', { name: 'Nome ou apelido' })).toHaveValue('drizzle');
  });

  it('SKL-42 removes the category filter when the pressed category chip is used again', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    const { onFiltersChange } = renderCatalog({ filters: { scope: 'all', category: 'database', q: '' } });
    expect(await rows()).toHaveLength(1);
    const chip = screen.getByRole('button', { name: 'Banco de dados' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(chip);

    expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ scope: 'all', category: undefined, q: '' });
    await waitFor(async () => expect(await rows()).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Banco de dados' })).toHaveAttribute('aria-pressed', 'false');
  });

  describe('search with a simulated clock', () => {
    async function typing() {
      fakeCatalog(server, [alfa, beta, drizzle]);
      const rendered = renderCatalog();
      await rows();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      return { ...rendered, field: screen.getByRole('searchbox', { name: 'Nome ou apelido' }) };
    }
    const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });
    afterEach(() => vi.useRealTimers());

    it('SKL-41 changes q only 300 ms after the last key: nothing at 299 ms, one change at 300 ms', async () => {
      const { onFiltersChange, field } = await typing();

      type(field, 'post');
      act(() => vi.advanceTimersByTime(299));
      expect(onFiltersChange).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));

      expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ scope: 'all', category: undefined, q: 'post' });
      act(() => vi.advanceTimersByTime(1000));
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
    });

    it('SKL-41 starts the wait again with every key, so a burst of typing changes q once with the final text', async () => {
      const { onFiltersChange, field } = await typing();

      type(field, 'p');
      act(() => vi.advanceTimersByTime(200));
      type(field, 'po');
      act(() => vi.advanceTimersByTime(200));
      type(field, 'pos');
      act(() => vi.advanceTimersByTime(299));
      expect(onFiltersChange).not.toHaveBeenCalled();
      expect(field).toHaveValue('pos');
      act(() => vi.advanceTimersByTime(1));

      expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ scope: 'all', category: undefined, q: 'pos' });
    });

    it('SKL-41 keeps the other filters when the search settles', async () => {
      const { onFiltersChange, field } = await typing();
      fireEvent.click(screen.getByRole('button', { name: 'Ferramenta' }));
      expect(onFiltersChange).toHaveBeenLastCalledWith({ scope: 'all', category: 'tool', q: '' });

      type(field, 'driz');
      act(() => vi.advanceTimersByTime(300));

      expect(onFiltersChange).toHaveBeenLastCalledWith({ scope: 'all', category: 'tool', q: 'driz' });
      expect(onFiltersChange).toHaveBeenCalledTimes(2);
    });
  });

  it('SKL-41 lists only the skills whose name or alias match the search once it settles', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    await rows();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Nome ou apelido' }), { target: { value: 'alfa' } });

    await waitFor(async () => expect(await rows()).toHaveLength(1), { timeout: 2000 });
    expect(screen.getByText('Skill Fictícia Alfa')).toBeInTheDocument();
  });

  it('SKL-43 shows the empty state with Limpar filtros, which resets scope, category and q', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    const { onFiltersChange } = renderCatalog({ filters: { scope: 'private', category: 'language', q: 'zzz' } });

    expect(await screen.findByText('Nenhuma skill encontrada.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Nome ou apelido' })).toHaveValue('zzz');

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ scope: 'all', category: undefined, q: '' });
    expect(await rows()).toHaveLength(3);
    expect(screen.getByRole('searchbox', { name: 'Nome ou apelido' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Linguagem' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Nenhuma skill encontrada.')).toBeNull();
  });

  it('SKL-43 clears a search text that has not settled yet when Limpar filtros is used', async () => {
    fakeCatalog(server, [alfa]);
    const { onFiltersChange } = renderCatalog({ filters: { scope: 'all', category: 'database', q: '' } });
    await screen.findByText('Nenhuma skill encontrada.');
    const field = screen.getByRole('searchbox', { name: 'Nome ou apelido' });
    fireEvent.change(field, { target: { value: 'abc' } });

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(field).toHaveValue('');
    await rows();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ scope: 'all', category: undefined, q: '' });
  });

  it('SKL-43 does not show the empty state while the catalog has skills', async () => {
    fakeCatalog(server, [global_(1, 'Skill Fictícia Alfa', 'language')]);
    renderCatalog();
    await rows();

    expect(screen.queryByText('Nenhuma skill encontrada.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
  });
});

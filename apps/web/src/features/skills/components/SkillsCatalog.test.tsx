// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiInternalUrl, problem } from '../testing/api';
import { alfa, beta, drizzle, global_, renderCatalog, rowOf, rows } from '../testing/catalog-harness';
import { fakeCatalog, uuid } from '../testing/fake-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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

  it('SKL-38 lists the skills in the alphabetical order the api answers, with no group "Mais usadas" (AD-013)', async () => {
    fakeCatalog(server, [beta, drizzle, alfa]);
    renderCatalog();

    const list = await rows();

    expect(list.map((row) => within(row).getAllByText(/^(Skill|Drizzle)/)[0]!.textContent)).toEqual([
      'Drizzle ORM de Teste',
      'Skill Fictícia Alfa',
      'Skill Fictícia Beta',
    ]);
    // The old "no N vagas" line is superseded by APP-85: each row now counts its postings.
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

const confirmPromotion = async (name: string) => {
  fireEvent.click(within(rowOf(name)).getByRole('button', { name: 'Promover' }));
  return within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Promover' });
};

describe('SkillsCatalog promotion', () => {
  it('SKL-45 asks "Promover {nome}?" saying the skill becomes visible to everyone and that this screen cannot undo it', async () => {
    const api = fakeCatalog(server, [alfa, drizzle]);
    renderCatalog();
    await rows();

    fireEvent.click(within(rowOf('Drizzle ORM de Teste')).getByRole('button', { name: 'Promover' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Promover Drizzle ORM de Teste?' });
    expect(dialog).toHaveTextContent('A skill passa a ser visível para todas as pessoas.');
    expect(dialog).toHaveTextContent('A promoção não se desfaz por aqui.');
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(api.callsTo('POST', '/promote')).toEqual([]);
  });

  it('SKL-45 calls the promotion on confirm and shows the row without the badge and the button, with Privadas one lower and the total equal', async () => {
    const api = fakeCatalog(server, [
      alfa,
      drizzle,
      global_(4, 'Skill Fictícia Gama', 'tool'),
      { ...drizzle, id: uuid(5), name: 'Skill Fictícia Delta' },
    ]);
    renderCatalog();
    await rows();
    expect(screen.getByRole('button', { name: 'Privadas2' })).toBeInTheDocument();
    expect(screen.getByText('4')).toHaveClass('font-mono');

    fireEvent.click(await confirmPromotion('Drizzle ORM de Teste'));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    const row = rowOf('Drizzle ORM de Teste');
    expect(within(row).queryByText('Privada')).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Promover' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Ações de Drizzle ORM de Teste' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privadas1' })).toBeInTheDocument();
    expect(screen.getByText('4')).toHaveClass('font-mono');
    expect(api.callsTo('POST', '/promote')).toEqual([`POST /skills/${drizzle.id}/promote`]);
    expect(rowOf('Skill Fictícia Delta')).toHaveTextContent('Privada');
  });

  it('SKL-45 moves the focus to the updated row after the promotion', async () => {
    fakeCatalog(server, [alfa, drizzle]);
    renderCatalog();
    await rows();

    fireEvent.click(await confirmPromotion('Drizzle ORM de Teste'));

    await waitFor(() => expect(rowOf('Drizzle ORM de Teste')).toHaveFocus());
    expect(rowOf('Drizzle ORM de Teste')).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(rowOf('Drizzle ORM de Teste'));
  });

  it('SKL-46 does not call the api on Cancelar and gives the focus back to the Promover button of the row', async () => {
    const api = fakeCatalog(server, [alfa, drizzle]);
    renderCatalog();
    await rows();
    const button = within(rowOf('Drizzle ORM de Teste')).getByRole('button', { name: 'Promover' });
    fireEvent.click(button);

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(api.callsTo('POST', '/promote')).toEqual([]);
    expect(rowOf('Drizzle ORM de Teste')).toHaveTextContent('Privada');
  });

  it('SKL-46 does not call the api when the dialog is closed with Esc and gives the focus back to the Promover button', async () => {
    const api = fakeCatalog(server, [alfa, drizzle]);
    renderCatalog();
    await rows();
    const button = within(rowOf('Drizzle ORM de Teste')).getByRole('button', { name: 'Promover' });
    fireEvent.click(button);
    const dialog = await screen.findByRole('alertdialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(api.callsTo('POST', '/promote')).toEqual([]);
  });

  it('SKL-47 closes the dialog on a 409, keeps the row private and shows the danger Alert with the exact text', async () => {
    fakeCatalog(server, [alfa, drizzle]);
    server.use(http.post(`${apiInternalUrl}/skills/:id/promote`, () => problem(409)));
    renderCatalog();
    await rows();

    fireEvent.click(await confirmPromotion('Drizzle ORM de Teste'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Já existe uma skill global com esse nome ou apelido. A fusão é manual.');
    expect(alert).toHaveClass('bg-danger-subtle');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    const row = rowOf('Drizzle ORM de Teste');
    expect(within(row).getByText('Privada')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Promover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privadas1' })).toBeInTheDocument();
  });

  it('SKL-47 hands a 401 of the promotion to onExpired and shows no alert', async () => {
    fakeCatalog(server, [alfa, drizzle]);
    server.use(http.post(`${apiInternalUrl}/skills/:id/promote`, () => problem(401)));
    const { onExpired } = renderCatalog({ onExpired: () => true });
    await rows();

    fireEvent.click(await confirmPromotion('Drizzle ORM de Teste'));

    await waitFor(() =>
      expect(onExpired).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: 401 })),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('SKL-47 says the service is unavailable when the promotion fails for another reason', async () => {
    fakeCatalog(server, [alfa, drizzle]);
    server.use(http.post(`${apiInternalUrl}/skills/:id/promote`, () => problem(503)));
    renderCatalog();
    await rows();

    fireEvent.click(await confirmPromotion('Drizzle ORM de Teste'));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(within(rowOf('Drizzle ORM de Teste')).getByText('Privada')).toBeInTheDocument();
  });

  it('SKL-50 keeps the confirm button disabled and busy while the promotion is pending, and a second click sends no second call', async () => {
    const api = fakeCatalog(server, [alfa, drizzle]);
    const release = api.hold('promote');
    renderCatalog();
    await rows();
    const confirm = await confirmPromotion('Drizzle ORM de Teste');

    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(api.callsTo('POST', '/promote')).toHaveLength(1);
    expect(within(rowOf('Drizzle ORM de Teste')).queryByText('Privada')).toBeNull();
  });
});

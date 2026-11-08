// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPLICATIONS_FILTERS, parseApplicationsSearch } from '../model/filters';
import { application, postingSkill } from '../testing/fixtures';
import { fakeApplications } from '../testing/fake-api';
import { companiesOf, renderList, rows } from '../testing/list-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
});
afterAll(() => server.close());

const portfolio = () => [
  application(1, {
    status: 'applied',
    company: 'Empresa Fictícia Alfa',
    level: 'mid',
    workModel: 'remote',
    skills: [postingSkill(1, 'required', 'NestJS')],
    createdAt: '2026-11-01T12:00:00.000Z',
    lastActivityAt: '2026-11-07T12:00:00.000Z',
  }),
  application(2, {
    status: 'applied',
    company: 'Empresa Fictícia Beta',
    level: 'senior',
    workModel: 'hybrid',
    skills: [postingSkill(2, 'required', 'React')],
    createdAt: '2026-11-03T12:00:00.000Z',
    lastActivityAt: '2026-11-05T12:00:00.000Z',
  }),
  application(3, {
    status: 'saved',
    company: 'Empresa Fictícia Gama',
    level: 'junior',
    workModel: 'onsite',
    skills: [postingSkill(3, 'required', 'Docker')],
  }),
  application(4, {
    status: 'offer',
    company: 'Empresa Fictícia Delta',
    level: 'mid',
    workModel: 'remote',
    skills: [postingSkill(4, 'required', 'Kafka')],
  }),
  application(5, { status: 'rejected', company: 'Empresa Fictícia Épsilon', level: 'mid', workModel: 'remote' }),
  application(6, { status: 'accepted', company: 'Empresa Fictícia Zeta', level: 'senior', workModel: null }),
];

const companiesShown = () => screen.queryAllByRole('listitem').map((row) => within(row).getAllByRole('link')[0]!.textContent);

/** Opens a menu of the filter row the way a keyboard does. */
async function openMenu(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'Enter' });
  return screen.findByRole('menu', { name });
}

describe('ApplicationsFilters', () => {
  it('APP-46 changes the tab with Ativas and Encerradas, keeps it in the filters and lists only that tab', async () => {
    const api = fakeApplications(server, portfolio());
    const { onFiltersChange } = renderList();
    await rows();
    expect(companiesShown()).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Encerradas2' }));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, tab: 'closed' });
    await waitFor(() => expect(companiesShown()).toEqual(['Empresa Fictícia Zeta', 'Empresa Fictícia Épsilon']));
    expect(screen.getByRole('button', { name: 'Encerradas2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ativas4' })).toHaveAttribute('aria-pressed', 'false');
    expect(api.calls.at(-1)).toBe('GET /applications?tab=closed&sort=activity');

    fireEvent.click(screen.getByRole('button', { name: 'Ativas4' }));

    await waitFor(() => expect(companiesShown()).toHaveLength(4));
    expect(api.calls.at(-1)).toBe('GET /applications?tab=active&sort=activity');
  });

  it('APP-46 filters by level with several items on at once and keeps the menu open between choices', async () => {
    const api = fakeApplications(server, portfolio());
    const { onFiltersChange } = renderList();
    await rows();

    const menu = await openMenu('Nível');
    expect(within(menu).getAllByRole('menuitemcheckbox').map((item) => item.textContent)).toEqual([
      'Estágio',
      'Júnior',
      'Pleno',
      'Sênior',
      'Especialista',
    ]);
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Pleno' }));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, level: ['mid'] });
    await waitFor(() => expect(companiesShown().sort()).toEqual(['Empresa Fictícia Alfa', 'Empresa Fictícia Delta']));
    expect(screen.getByRole('menu', { name: 'Nível' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Pleno' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Sênior' })).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Sênior' }));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, level: ['mid', 'senior'] });
    await waitFor(() => expect(companiesShown()).toHaveLength(3));
    expect(companiesShown()).toContain('Empresa Fictícia Beta');
    expect(api.calls.at(-1)).toBe('GET /applications?tab=active&level=mid%2Csenior&sort=activity');

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Pleno' }));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, level: ['senior'] });
    await waitFor(() => expect(companiesShown()).toEqual(['Empresa Fictícia Beta']));
  });

  it('APP-46 filters by work model, and the chip stays pressed while an item is on', async () => {
    const api = fakeApplications(server, portfolio());
    const { onFiltersChange } = renderList();
    await rows();
    expect(screen.getByRole('button', { name: 'Modelo' })).toHaveAttribute('aria-pressed', 'false');

    const menu = await openMenu('Modelo');
    expect(within(menu).getAllByRole('menuitemcheckbox').map((item) => item.textContent)).toEqual(['Remoto', 'Híbrido', 'Presencial']);
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Híbrido' }));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, workModel: ['hybrid'] });
    await waitFor(() => expect(companiesShown()).toEqual(['Empresa Fictícia Beta']));
    expect(screen.getByRole('button', { name: 'Modelo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Híbrido' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Remoto' })).toHaveAttribute('aria-checked', 'false');
    expect(api.calls.at(-1)).toBe('GET /applications?tab=active&workModel=hybrid&sort=activity');
  });

  it('APP-47 offers in "Filtro" only the four statuses of the active tab, with several on at once', async () => {
    const api = fakeApplications(server, portfolio());
    const { onFiltersChange } = renderList();
    await rows();

    const menu = await openMenu('Filtro');
    expect(within(menu).getAllByRole('menuitemcheckbox').map((item) => item.textContent)).toEqual([
      'Salva',
      'Enviada',
      'Em entrevistas',
      'Proposta',
    ]);
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Enviada' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Proposta' }));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, status: ['applied', 'offer'] });
    await waitFor(() => expect(companiesShown()).toHaveLength(3));
    expect(companiesShown()).not.toContain('Empresa Fictícia Gama');
    expect(screen.getByRole('button', { name: 'Filtro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Enviada' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Proposta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Salva' })).toHaveAttribute('aria-checked', 'false');
    expect(api.calls.at(-1)).toBe('GET /applications?tab=active&status=applied%2Coffer&sort=activity');
  });

  it('APP-47 offers the four closed statuses on the closed tab', async () => {
    fakeApplications(server, portfolio());
    renderList({ filters: { ...DEFAULT_APPLICATIONS_FILTERS, tab: 'closed' } });
    await rows();

    const menu = await openMenu('Filtro');

    expect(within(menu).getAllByRole('menuitemcheckbox').map((item) => item.textContent)).toEqual([
      'Aceita',
      'Recusada',
      'Desisti',
      'Sem retorno',
    ]);
  });

  it('APP-47 clears the status filter when the tab changes, and asks the api with no status', async () => {
    const api = fakeApplications(server, portfolio());
    const { onFiltersChange } = renderList({ filters: { ...DEFAULT_APPLICATIONS_FILTERS, status: ['applied'] } });
    await rows();
    expect(companiesShown()).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /^Encerradas/ }));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, tab: 'closed', status: [] });
    await waitFor(() => expect(companiesShown()).toHaveLength(2));
    expect(companiesShown()).toContain('Empresa Fictícia Zeta');
    expect(api.calls.at(-1)).toBe('GET /applications?tab=closed&sort=activity');
    expect(screen.getByRole('button', { name: 'Filtro' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('APP-46 opens with every control as the address holds it, so a reload keeps the filters', async () => {
    const api = fakeApplications(server, portfolio());
    renderList({
      filters: parseApplicationsSearch({ tab: 'active', level: 'mid', workModel: 'remote', status: 'applied', q: 'nest', sort: 'created' }),
    });
    await rows();

    expect(companiesShown()).toEqual(['Empresa Fictícia Alfa']);
    expect(screen.getByRole('searchbox', { name: 'Empresa, título ou skill' })).toHaveValue('nest');
    expect(screen.getByRole('button', { name: 'Nível' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Modelo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Filtro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Cadastro' })).toBeInTheDocument();
    expect(api.calls[0]).toBe('GET /applications?tab=active&status=applied&level=mid&workModel=remote&q=nest&sort=created');
    await openMenu('Nível');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Pleno' })).toHaveAttribute('aria-checked', 'true');
  });

  describe('search', () => {
    async function typing() {
      fakeApplications(server, portfolio());
      const rendered = renderList();
      await rows();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      return { ...rendered, field: screen.getByRole('searchbox', { name: 'Empresa, título ou skill' }) };
    }
    const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

    it('APP-46 changes q only 300 ms after the last key: nothing at 299 ms, one change at 300 ms', async () => {
      const { onFiltersChange, field } = await typing();

      type(field, 'nest');
      act(() => vi.advanceTimersByTime(299));
      expect(onFiltersChange).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));

      expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_APPLICATIONS_FILTERS, q: 'nest' });
      act(() => vi.advanceTimersByTime(1000));
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
    });

    it('APP-46 starts the wait again with every key, so a burst of typing changes q once with the final text', async () => {
      const { onFiltersChange, field } = await typing();

      type(field, 'n');
      act(() => vi.advanceTimersByTime(200));
      type(field, 'ne');
      act(() => vi.advanceTimersByTime(200));
      type(field, 'nes');
      act(() => vi.advanceTimersByTime(299));
      expect(onFiltersChange).not.toHaveBeenCalled();
      expect(field).toHaveValue('nes');
      act(() => vi.advanceTimersByTime(1));

      expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_APPLICATIONS_FILTERS, q: 'nes' });
    });

    it('APP-46 lists what matches by skill and by company, ignoring case and accents, once the search settles', async () => {
      const { field } = await typing();

      type(field, 'NESTJS');
      act(() => vi.advanceTimersByTime(300));
      vi.useRealTimers();
      await waitFor(() => expect(companiesShown()).toEqual(['Empresa Fictícia Alfa']));

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      type(field, 'ficticia gama');
      act(() => vi.advanceTimersByTime(300));
      vi.useRealTimers();
      await waitFor(() => expect(companiesShown()).toEqual(['Empresa Fictícia Gama']));
    });

    it('APP-46 changes q to the empty text when the field is emptied', async () => {
      const { onFiltersChange, field } = await typing();
      type(field, 'nest');
      act(() => vi.advanceTimersByTime(300));
      onFiltersChange.mockClear();

      type(field, '');
      act(() => vi.advanceTimersByTime(300));

      expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_APPLICATIONS_FILTERS, q: '' });
    });

    it('APP-53 shows the text again as the address holds it after "Limpar filtros" empties it', async () => {
      fakeApplications(server, portfolio());
      renderList({ filters: { ...DEFAULT_APPLICATIONS_FILTERS, q: 'zzz' } });
      fireEvent.click(await screen.findByRole('button', { name: 'Limpar filtros' }));

      await rows();
      expect(screen.getByRole('searchbox', { name: 'Empresa, título ou skill' })).toHaveValue('');
    });
  });

  describe('sort', () => {
    it('APP-48 alternates between "Última atividade" and "Cadastro", writes sort and lists in the new order', async () => {
      const api = fakeApplications(server, portfolio());
      const { onFiltersChange } = renderList();
      await rows();
      expect(companiesOf('Enviadas')).toEqual(['Empresa Fictícia Alfa', 'Empresa Fictícia Beta']);

      fireEvent.click(screen.getByRole('button', { name: 'Última atividade' }));

      expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, sort: 'created' });
      expect(screen.getByRole('button', { name: 'Cadastro' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Última atividade' })).toBeNull();
      await waitFor(() => expect(companiesOf('Enviadas')).toEqual(['Empresa Fictícia Beta', 'Empresa Fictícia Alfa']));
      expect(api.calls.at(-1)).toBe('GET /applications?tab=active&sort=created');

      fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }));

      expect(onFiltersChange).toHaveBeenLastCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, sort: 'activity' });
      await waitFor(() => expect(companiesOf('Enviadas')).toEqual(['Empresa Fictícia Alfa', 'Empresa Fictícia Beta']));
    });
  });
});

// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_APPLICATIONS_FILTERS } from '../model/filters';
import { application, uuid } from '../testing/fixtures';
import { fakeApplications } from '../testing/fake-api';
import { companiesOf, groupsOnScreen, renderList, rows } from '../testing/list-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Seven applications across the four active statuses and two closed ones, in no particular order. */
const portfolio = () => [
  application(1, { status: 'saved', company: 'Empresa Fictícia Salva Um', lastActivityAt: '2026-11-07T10:00:00.000Z' }),
  application(2, { status: 'applied', company: 'Empresa Fictícia Enviada Um', lastActivityAt: '2026-11-06T10:00:00.000Z' }),
  application(3, { status: 'applied', company: 'Empresa Fictícia Enviada Dois', lastActivityAt: '2026-11-05T10:00:00.000Z' }),
  application(4, { status: 'interviewing', company: 'Empresa Fictícia Entrevista Um' }),
  application(5, { status: 'offer', company: 'Empresa Fictícia Proposta Um' }),
  application(6, { status: 'rejected', company: 'Empresa Fictícia Recusada Um' }),
  application(7, { status: 'ghosted', company: 'Empresa Fictícia Silêncio Um' }),
];

describe('ApplicationsList', () => {
  it('APP-42 shows the title with the total in mono, the sort button, "Nova candidatura" with C, the tabs with their numbers, the three filters, the search and the groups', async () => {
    fakeApplications(server, portfolio());
    renderList();
    await rows();

    const title = screen.getByRole('heading', { level: 1 });
    expect(title.textContent).toBe('Candidaturas');
    const total = within(title.parentElement!).getByText('7');
    expect(total).toHaveClass('font-mono');
    expect(within(title.parentElement!).getByRole('button', { name: 'Última atividade' })).toBeInTheDocument();
    const add = within(title.parentElement!).getByRole('button', { name: /Nova candidatura/ });
    expect(add.querySelector('kbd')?.textContent).toBe('C');
    const filters = screen.getByRole('search', { name: 'Filtros' });
    expect(within(filters).getByRole('button', { name: 'Ativas5' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(filters).getByRole('button', { name: 'Encerradas2' })).toHaveAttribute('aria-pressed', 'false');
    for (const name of ['Nível', 'Modelo', 'Filtro']) {
      expect(within(filters).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(filters).getByPlaceholderText('Empresa, título ou skill')).toBeInTheDocument();
    expect(groupsOnScreen()).toEqual([
      { name: 'Propostas', count: '1' },
      { name: 'Em entrevistas', count: '1' },
      { name: 'Enviadas', count: '2' },
      { name: 'Salvas', count: '1' },
    ]);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('APP-42 lists the rows in the order the api answers inside each group, without reordering them', async () => {
    fakeApplications(server, portfolio());
    renderList();
    await rows();

    expect(companiesOf('Enviadas')).toEqual(['Empresa Fictícia Enviada Um', 'Empresa Fictícia Enviada Dois']);
    expect(screen.queryByText('Empresa Fictícia Recusada Um')).toBeNull();
  });

  it('APP-45 shows the status icon, the plural label, the count of the whole group and a "+" named after the status', async () => {
    fakeApplications(server, portfolio(), { pageSize: 3 });
    const { onNew } = renderList();
    await rows();

    // The api cut the page after three rows, so "Enviadas" holds one of its two rows and still counts two.
    expect(groupsOnScreen().find((group) => group.name === 'Salvas')).toBeUndefined();
    const applied = screen.getAllByRole('heading', { level: 2 }).find((heading) => heading.textContent?.startsWith('Enviadas'))!;
    expect(applied.querySelector('[data-status-icon="applied"]')).not.toBeNull();
    expect(within(applied).getByText('2')).toHaveClass('font-mono');
    expect(within(applied).queryByRole('button')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Nova candidatura em Enviada' }));

    expect(onNew).toHaveBeenCalledWith('applied');
    for (const name of ['Proposta', 'Em entrevistas', 'Enviada']) {
      expect(screen.getByRole('button', { name: `Nova candidatura em ${name}` })).toBeInTheDocument();
    }
  });

  it('APP-45 leaves a status with no row out of the list', async () => {
    fakeApplications(server, [application(1, { status: 'saved' })]);
    renderList();
    await rows();

    expect(groupsOnScreen().map((group) => group.name)).toEqual(['Salvas']);
    expect(screen.queryByRole('button', { name: 'Nova candidatura em Proposta' })).toBeNull();
  });

  it('APP-42 opens the dialog through "Nova candidatura" in the topbar, with no status', async () => {
    fakeApplications(server, portfolio());
    const { onNew } = renderList();
    await rows();

    fireEvent.click(within(screen.getByRole('heading', { level: 1 }).parentElement!).getByRole('button', { name: /Nova candidatura/ }));

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onNew).toHaveBeenCalledWith();
  });

  it('APP-51 shows Carregar mais only while the answer has a nextCursor and appends the next page to the groups', async () => {
    const api = fakeApplications(server, portfolio(), { pageSize: 3 });
    renderList();
    expect(await rows()).toHaveLength(3);
    expect(screen.queryByText('Empresa Fictícia Salva Um')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('Empresa Fictícia Salva Um')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(companiesOf('Enviadas')).toEqual(['Empresa Fictícia Enviada Um', 'Empresa Fictícia Enviada Dois']);
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
    expect(api.calls).toEqual([
      'GET /applications?tab=active&sort=activity',
      `GET /applications?tab=active&sort=activity&cursor=${uuid(2)}`,
    ]);
  });

  it('APP-51 hides Carregar mais when the first answer has no nextCursor', async () => {
    fakeApplications(server, portfolio());
    renderList();
    await rows();

    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('APP-51 moves the focus to the first row added by Carregar mais', async () => {
    fakeApplications(server, portfolio(), { pageSize: 3 });
    renderList();
    await rows();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    const row = (await screen.findByText('Empresa Fictícia Enviada Dois')).closest('li');
    await waitFor(() => expect(row).toHaveFocus());
  });

  it('APP-52 shows the EmptyState "Nenhuma candidatura ainda." and a "Nova candidatura" button that opens the dialog', async () => {
    fakeApplications(server, []);
    const { onNew } = renderList();

    expect(await screen.findByText('Nenhuma candidatura ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma candidatura com esses filtros.')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    const empty = screen.getByText('Nenhuma candidatura ainda.').parentElement!;
    fireEvent.click(within(empty).getByRole('button', { name: 'Nova candidatura' }));

    expect(onNew).toHaveBeenCalledWith();
  });

  it('APP-53 shows "Nenhuma candidatura com esses filtros." and "Limpar filtros" empties every filter but the tab', async () => {
    const api = fakeApplications(server, portfolio());
    const { onFiltersChange } = renderList({
      filters: { ...DEFAULT_APPLICATIONS_FILTERS, tab: 'closed', level: ['intern'], q: 'zzz', status: ['rejected'] },
    });

    expect(await screen.findByText('Nenhuma candidatura com esses filtros.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma candidatura ainda.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(onFiltersChange).toHaveBeenCalledWith({ ...DEFAULT_APPLICATIONS_FILTERS, tab: 'closed' });
    expect(await screen.findByText('Empresa Fictícia Recusada Um')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma candidatura com esses filtros.')).toBeNull();
    expect(api.calls.at(-1)).toBe('GET /applications?tab=closed&sort=activity');
  });

  it('APP-54 shows the danger Alert with the failure text and no row when the list does not load, and Tentar de novo reads it again', async () => {
    const api = fakeApplications(server, portfolio());
    api.fail('list', 503);
    renderList();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Não foi possível carregar as candidaturas.');
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryByText('Nenhuma candidatura ainda.')).toBeNull();

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Empresa Fictícia Proposta Um')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.callsTo('GET', '/applications?')).toHaveLength(2);
  });

  it('APP-54 leaves the failure to the login redirect when the answer is 401', async () => {
    const api = fakeApplications(server, portfolio());
    api.fail('list', 401);
    const { onExpired } = renderList({ onExpired: () => true });

    await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

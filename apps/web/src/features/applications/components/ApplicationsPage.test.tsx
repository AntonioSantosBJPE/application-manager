// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_APPLICATIONS_FILTERS } from '../model/filters';
import { application } from '../testing/fixtures';
import { fakeApplications } from '../testing/fake-api';
import { groupsOnScreen, rows } from '../testing/list-harness';
import { renderPage } from '../testing/page-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const portfolio = () => [
  application(1, { status: 'applied', company: 'Empresa Fictícia Alfa' }),
  application(2, { status: 'saved', company: 'Empresa Fictícia Beta' }),
];

const dialog = () => screen.queryByRole('dialog', { name: 'Nova candidatura' });
const topbarNew = () => within(screen.getByRole('heading', { level: 1 }).parentElement!).getByRole('button', { name: /Nova candidatura/ });

describe('ApplicationsPage', () => {
  it('APP-57 opens the dialog with "Nova candidatura" in the topbar, entering as Salva', async () => {
    fakeApplications(server, portfolio());
    renderPage();
    await rows();
    expect(dialog()).toBeNull();

    fireEvent.click(topbarNew());

    const box = await screen.findByRole('dialog', { name: 'Nova candidatura' });
    expect(within(box).getByText(/Entra como/).parentElement?.textContent).toBe('Entra como Salva.⌘↵para criar');
  });

  it('APP-57 opens the dialog with the C key when the focus is not in a field, and leaves the key alone while typing or with a modifier', async () => {
    fakeApplications(server, portfolio());
    renderPage();
    await rows();

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Empresa, título ou skill' }), { key: 'c' });
    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'c', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(dialog()).toBeNull();

    fireEvent.keyDown(document.body, { key: 'c' });

    expect(await screen.findByRole('dialog', { name: 'Nova candidatura' })).toBeInTheDocument();
  });

  it('APP-57 does not take the C key while the dialog is open, so a letter in a field stays a letter', async () => {
    fakeApplications(server, portfolio());
    renderPage();
    await rows();
    fireEvent.keyDown(document.body, { key: 'c' });
    const box = await screen.findByRole('dialog', { name: 'Nova candidatura' });

    fireEvent.keyDown(within(box).getByLabelText('Empresa'), { key: 'c' });

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('APP-58 opens the dialog in the status of the group whose "+" was used', async () => {
    fakeApplications(server, portfolio());
    renderPage();
    await rows();

    fireEvent.click(screen.getByRole('button', { name: 'Nova candidatura em Enviada' }));

    const box = await screen.findByRole('dialog', { name: 'Nova candidatura' });
    expect(within(box).getByText(/Entra como/).parentElement?.textContent).toBe('Entra como Enviada.⌘↵para criar');
  });

  it('APP-62 shows the new row in its group, with the numbers read from the api, after the dialog creates it, and tells the page', async () => {
    const api = fakeApplications(server, portfolio());
    const { onCreated } = renderPage();
    await rows();
    fireEvent.click(screen.getByRole('button', { name: 'Nova candidatura em Enviada' }));
    const box = await screen.findByRole('dialog', { name: 'Nova candidatura' });
    fireEvent.change(within(box).getByLabelText('Empresa'), { target: { value: 'Empresa Fictícia Gama' } });
    fireEvent.change(within(box).getByLabelText('Título'), { target: { value: 'Vaga de Teste Pleno' } });
    fireEvent.click(within(box).getByRole('radio', { name: 'Pleno' }));

    fireEvent.click(within(box).getByRole('button', { name: 'Criar candidatura' }));

    await waitFor(() => expect(dialog()).toBeNull());
    expect(await screen.findByText('Empresa Fictícia Gama')).toBeInTheDocument();
    expect(groupsOnScreen()).toEqual([
      { name: 'Enviadas', count: '2' },
      { name: 'Salvas', count: '1' },
    ]);
    expect(within(screen.getByText('Empresa Fictícia Gama').closest('li')!).getByRole('img', { name: 'Enviada' })).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(api.callsTo('GET', '/applications?')).toHaveLength(2);
  });

  it('APP-83 opens the dialog on arrival with new=1, and takes new=1 out of the filters when it closes', async () => {
    fakeApplications(server, portfolio());
    const { onFiltersChange } = renderPage({ filters: { ...DEFAULT_APPLICATIONS_FILTERS, newApplication: true } });

    const box = await screen.findByRole('dialog', { name: 'Nova candidatura' });
    fireEvent.click(within(box).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(dialog()).toBeNull());
    expect(onFiltersChange).toHaveBeenCalledExactlyOnceWith(DEFAULT_APPLICATIONS_FILTERS);
  });

  it('APP-65 closes the dialog without creating and without touching the filters when it was opened with the button', async () => {
    const api = fakeApplications(server, portfolio());
    const { onFiltersChange, onCreated } = renderPage();
    await rows();
    fireEvent.click(topbarNew());
    await screen.findByRole('dialog', { name: 'Nova candidatura' });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(dialog()).toBeNull());
    expect(onFiltersChange).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(api.callsTo('POST', '/applications')).toHaveLength(0);
  });
});

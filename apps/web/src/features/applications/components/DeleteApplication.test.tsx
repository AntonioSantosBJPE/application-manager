// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderDetail } from '../testing/detail-harness';
import { fakeDetail } from '../testing/fake-detail';
import { detail } from '../testing/fixtures';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const opened = () => detail(1, { company: 'Empresa Fictícia Alfa' });
const sidebarButton = () =>
  within(screen.getByRole('complementary', { name: 'Propriedades' })).getByRole('button', { name: 'Excluir candidatura' });

describe('DeleteApplication', () => {
  it('APP-75 asks "Excluir candidatura?" from the sidebar button, and deletes nothing before the confirmation', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.click(sidebarButton());

    const box = await screen.findByRole('alertdialog', { name: 'Excluir candidatura?' });
    expect(within(box).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    fireEvent.click(within(box).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(api.calls).toEqual([]);
  });

  it('APP-75 deletes and tells the route to open the list when the person confirms', async () => {
    const api = fakeDetail(server, opened());
    const { onDeleted } = renderDetail(opened());

    fireEvent.click(sidebarButton());
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(api.callsTo('DELETE', '/applications')).toEqual([`DELETE /applications/${opened().id}`]);
    expect(api.removed).toBe(true);
  });

  it('APP-75 opens the same confirmation from "Excluir candidatura" in the "⋯" menu', async () => {
    const api = fakeDetail(server, opened());
    const { onDeleted } = renderDetail(opened());

    fireEvent.keyDown(screen.getByRole('button', { name: 'Mais ações' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir candidatura' }));
    const box = await screen.findByRole('alertdialog', { name: 'Excluir candidatura?' });
    fireEvent.click(within(box).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(api.removed).toBe(true);
  });

  it('APP-75 stays on the page with a danger Alert when the api refuses', async () => {
    const api = fakeDetail(server, opened());
    api.fail('remove', 500);
    const { onDeleted } = renderDetail(opened());

    fireEvent.click(sidebarButton());
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível. Tente novamente em instantes.');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(api.removed).toBe(false);
  });
});

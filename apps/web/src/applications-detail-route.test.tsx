// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { countApplications, deleteApplication, getApplication, listApplications, snoozeGhost } from './features/applications';
import { getSession } from './features/identity';
import { detail } from './features/applications/testing/fixtures';
import { here, member, openApplications, pageOf, summary } from './testing/applications-route';

// The session and the applications calls are the BFF boundary, answered here.
vi.mock('./features/identity/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/identity/api/server-functions')>()),
  getSession: vi.fn(),
}));

vi.mock('./features/applications/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/applications/api/server-functions')>()),
  countApplications: vi.fn(),
  listApplications: vi.fn(),
  getApplication: vi.fn(),
  deleteApplication: vi.fn(),
  snoozeGhost: vi.fn(),
}));

beforeAll(() => {
  window.scrollTo = () => undefined;
});

const opened = detail(1, { company: 'Empresa Fictícia Alfa', title: 'Vaga de Teste Pleno', status: 'applied' });

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ kind: 'authenticated', user: member });
  vi.mocked(countApplications).mockResolvedValue({ ok: true, data: { total: 24 } });
  vi.mocked(listApplications).mockResolvedValue({ ok: true, data: pageOf([summary]) });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('application detail route', () => {
  it('APP-66 loads the detail of the address and shows it, with "Candidaturas" current in the sidebar', async () => {
    vi.mocked(getApplication).mockResolvedValue({ ok: true, data: opened });

    await openApplications(`/applications/${opened.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Vaga de Teste Pleno' })).toBeInTheDocument();
    expect(vi.mocked(getApplication)).toHaveBeenCalledWith({ data: opened.id });
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: /Candidaturas/ })).toHaveAttribute('aria-current', 'page');
  });

  it('APP-77 shows "Candidatura não encontrada." on a 404 and the link goes back to the list', async () => {
    vi.mocked(getApplication).mockResolvedValue({ ok: false, status: 404 });

    const router = await openApplications(`/applications/${opened.id}`);

    expect(await screen.findByText('Candidatura não encontrada.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Voltar para Candidaturas' }));
    await waitFor(() => expect(here(router)).toBe('/applications'));
  });

  it('APP-66 sends an expired session to the login with the page to come back to', async () => {
    // The session ended while the page was loading: the api answers 401 and the login finds nobody.
    vi.mocked(getApplication).mockImplementation(() => {
      vi.mocked(getSession).mockResolvedValue({ kind: 'anonymous' });
      return Promise.resolve({ ok: false, status: 401 });
    });

    const router = await openApplications(`/applications/${opened.id}`);

    await waitFor(() => expect(here(router)).toContain('/login'));
    expect(router.state.location.search).toMatchObject({ redirect: `/applications/${opened.id}`, reason: 'expired' });
  });

  it('APP-82 snoozes on the detail and the list, opened again, no longer shows "sem retorno?" on the row', async () => {
    const suggested = { ...summary, id: detail(1).id, ghostSuggested: true, lastActivityAt: '2026-10-16T12:00:00.000Z' };
    const open = detail(1, { company: 'Empresa Fictícia Alfa', title: 'Vaga de Teste Pleno', status: 'applied', ghostSuggested: true, lastActivityAt: suggested.lastActivityAt });
    vi.mocked(listApplications).mockResolvedValueOnce({ ok: true, data: pageOf([suggested]) });
    vi.mocked(getApplication).mockResolvedValue({ ok: true, data: open });
    vi.mocked(snoozeGhost).mockResolvedValue({ ok: true, data: { ...open, ghostSuggested: false } });

    const router = await openApplications('/applications');
    const row = await screen.findByRole('link', { name: 'Empresa Fictícia Alfa' });
    expect(within(row.closest('li')!).getByText('sem retorno?')).toBeInTheDocument();
    expect(vi.mocked(listApplications)).toHaveBeenCalledTimes(1);

    fireEvent.click(row);
    await screen.findByRole('heading', { level: 1, name: 'Vaga de Teste Pleno' });
    // From here on the api no longer suggests it.
    vi.mocked(listApplications).mockResolvedValue({ ok: true, data: pageOf([{ ...suggested, ghostSuggested: false }]) });
    fireEvent.click(screen.getByRole('button', { name: 'Ainda não' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ainda não' })).toBeNull());
    expect(vi.mocked(snoozeGhost)).toHaveBeenCalledWith({ data: open.id });

    fireEvent.click(screen.getByRole('link', { name: 'Candidaturas' }));
    await waitFor(() => expect(here(router)).toBe('/applications'));
    const again = await screen.findByRole('link', { name: 'Empresa Fictícia Alfa' });
    await waitFor(() => expect(vi.mocked(listApplications).mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(within(again.closest('li')!).queryByText('sem retorno?')).toBeNull());
  });

  it('APP-75 deletes from the detail and opens /applications', async () => {
    vi.mocked(getApplication).mockResolvedValue({ ok: true, data: opened });
    vi.mocked(deleteApplication).mockResolvedValue({ ok: true, data: undefined });

    const router = await openApplications(`/applications/${opened.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Vaga de Teste Pleno' });
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Propriedades' })).getByRole('button', { name: 'Excluir candidatura' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(here(router)).toBe('/applications'));
    expect(vi.mocked(deleteApplication)).toHaveBeenCalledWith({ data: opened.id });
  });
});

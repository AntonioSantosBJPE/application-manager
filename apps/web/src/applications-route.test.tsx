// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { countApplications, listApplications } from './features/applications';
import { getSession } from './features/identity';
import { here, member, openApplications, pageOf, summary } from './testing/applications-route';

// The dialog tests of the applications route are split in two files: the route tree renders the whole
// document, and a test that opens a Radix dialog and then another test that opens one more in the same
// file stalls React's event dispatch in jsdom. The session and the applications calls are the BFF
// boundary, answered here.
vi.mock('./features/identity/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/identity/api/server-functions')>()),
  getSession: vi.fn(),
}));

vi.mock('./features/applications/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/applications/api/server-functions')>()),
  countApplications: vi.fn(),
  listApplications: vi.fn(),
}));

// jsdom has no scrolling; the router asks for it on every navigation.
beforeAll(() => {
  window.scrollTo = () => undefined;
});

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ kind: 'authenticated', user: member });
  vi.mocked(countApplications).mockResolvedValue({ ok: true, data: { total: 24 } });
  vi.mocked(listApplications).mockResolvedValue({ ok: true, data: pageOf([summary]) });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('applications route dialog', () => {
  it('APP-57 opens the dialog with the C key when the focus is not in a field, and not while typing', async () => {
    await openApplications('/applications');
    await screen.findByText('Vaga de Teste Pleno');

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Empresa, título ou skill' }), { key: 'c' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.keyDown(document.body, { key: 'c' });

    expect(await screen.findByRole('dialog', { name: 'Nova candidatura' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText(/Entra como/).parentElement?.textContent).toBe('Entra como Salva.⌘↵para criar');
  });

  it('APP-83 opens the dialog on arrival with new=1 and takes new=1 out of the address when it closes', async () => {
    const router = await openApplications('/applications?new=1');

    const dialog = await screen.findByRole('dialog', { name: 'Nova candidatura' });
    expect(here(router)).toBe('/applications?new=1');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(here(router)).toBe('/applications'));
  });
});

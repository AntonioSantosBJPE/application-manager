// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { countApplications, createApplication, listApplications } from './features/applications';
import { getSession } from './features/identity';
import { counts, member, openApplications, pageOf, sidebar, summary } from './testing/applications-route';

// Creating from the dialog, through the route tree: see the note in `applications-route.test.tsx` on why
// this test has a file of its own. The session and the applications calls are the BFF boundary.
vi.mock('./features/identity/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/identity/api/server-functions')>()),
  getSession: vi.fn(),
}));

vi.mock('./features/applications/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/applications/api/server-functions')>()),
  countApplications: vi.fn(),
  listApplications: vi.fn(),
  createApplication: vi.fn(),
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

describe('applications route create', () => {
  it('APP-62 shows the new application in its group and the new total in the sidebar after the dialog creates it', async () => {
    const created = { ...summary, id: '0190a5b4-7c3a-7c8e-9f2a-000000000002', company: 'Empresa Fictícia Beta', status: 'saved' as const };
    vi.mocked(createApplication).mockImplementation(() => {
      vi.mocked(countApplications).mockResolvedValue({ ok: true, data: { total: 25 } });
      vi.mocked(listApplications).mockResolvedValue({
        ok: true,
        data: pageOf([summary, created], { ...counts.byStatus, saved: 1 }),
      });
      return Promise.resolve({ ok: true, data: { ...created, skills: [], url: null, location: null, description: null, events: [] } });
    });
    await openApplications('/applications');
    await screen.findByText('Vaga de Teste Pleno');
    fireEvent.click(screen.getByRole('button', { name: 'Nova candidatura em Enviada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova candidatura' });
    fireEvent.change(within(dialog).getByLabelText('Empresa'), { target: { value: 'Empresa Fictícia Beta' } });
    fireEvent.change(within(dialog).getByLabelText('Título'), { target: { value: 'Vaga de Teste Júnior' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Júnior' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar candidatura' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Empresa Fictícia Beta')).toBeInTheDocument();
    expect(vi.mocked(createApplication)).toHaveBeenCalledWith({
      data: {
        jobPosting: { company: 'Empresa Fictícia Beta', title: 'Vaga de Teste Júnior', level: 'junior' },
        skills: [],
        status: 'applied',
      },
    });
    await waitFor(async () =>
      expect(within(await sidebar()).getByRole('link', { name: /^Candidaturas/ }).textContent).toBe('Candidaturas25'),
    );
  });
});

// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { countApplications } from './features/applications';
import { getSession, pendingInvitations } from './features/identity';
import { listAdminSkills } from './features/skills';
import { getSystemStatus } from './features/system-status';
import { getResume } from './features/resume';
import { bullet, experience, masterResume } from './features/resume/testing/fixtures';
import { here, member, openApplications } from './testing/applications-route';

// The session and the resume read are the BFF boundary, answered here; the route tree is the real one.
vi.mock('./features/identity/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/identity/api/server-functions')>()),
  getSession: vi.fn(),
  pendingInvitations: vi.fn(),
}));

vi.mock('./features/skills/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/skills/api/server-functions')>()),
  listAdminSkills: vi.fn(),
}));

vi.mock('./features/system-status/api/get-system-status', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/system-status/api/get-system-status')>()),
  getSystemStatus: vi.fn(),
}));

vi.mock('./features/applications/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/applications/api/server-functions')>()),
  countApplications: vi.fn(),
}));

vi.mock('./features/resume/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/resume/api/server-functions')>()),
  getResume: vi.fn(),
}));

beforeAll(() => {
  window.scrollTo = () => undefined;
});

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ kind: 'authenticated', user: member });
  vi.mocked(countApplications).mockResolvedValue({ ok: true, data: { total: 24 } });
  vi.mocked(getResume).mockResolvedValue({
    ok: true,
    data: masterResume({ experiences: [experience(1, { bullets: [bullet(1)] }), experience(2)] }),
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

const index = () => screen.findByRole('navigation', { name: 'Seções do currículo' });

const admin = { ...member, email: 'root@example.test', name: 'Root Admin', role: 'admin' } as const;
const sidebarOf = async () => within(await screen.findByRole('navigation', { name: 'Navegação principal' }));

describe('resume route', () => {
  it('RES-77 shows "Currículo mestre" in the group "Currículo" of the sidebar, as the current page on /resume', async () => {
    await openApplications('/resume');

    const sidebar = await sidebarOf();
    const group = sidebar.getByRole('group', { name: 'Currículo' });
    const item = within(group).getByRole('link', { name: 'Currículo mestre' });
    expect(item).toHaveAttribute('href', '/resume');
    expect(item).toHaveAttribute('aria-current', 'page');
    expect(sidebar.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
    expect(sidebar.getByRole('link', { name: /^Candidaturas/ })).not.toHaveAttribute('aria-current');
  });

  it('RES-77 does not mark the item on another page, and it takes the member to /resume', async () => {
    const router = await openApplications('/');
    const item = (await sidebarOf()).getByRole('link', { name: 'Currículo mestre' });
    expect(item).not.toHaveAttribute('aria-current');

    fireEvent.click(item);

    await waitFor(() => expect(here(router)).toBe('/resume'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Perfil' })).toBeInTheDocument();
    expect(item).toHaveAttribute('aria-current', 'page');
  });

  it('RES-81 sends an admin session on /resume to /admin', async () => {
    vi.mocked(getSession).mockResolvedValue({ kind: 'authenticated', user: admin });
    vi.mocked(getSystemStatus).mockResolvedValue({
      api: 'operational',
      database: 'operational',
      checkedAt: '2026-11-08T17:32:07.000Z',
    });
    vi.mocked(pendingInvitations).mockResolvedValue({ ok: true, data: { items: [], nextCursor: null, totalPending: 0 } });
    vi.mocked(listAdminSkills).mockResolvedValue({
      ok: true,
      data: { items: [], nextCursor: null, counts: { total: 0, private: 0 } },
    });

    const router = await openApplications('/resume');

    expect(here(router)).toBe('/admin');
    expect(await screen.findByRole('heading', { name: 'Administração' })).toBeInTheDocument();
    expect(vi.mocked(getResume)).not.toHaveBeenCalled();
  });

  it('RES-36 shows the Perfil section when the address has no section', async () => {
    await openApplications('/resume');

    expect(await screen.findByRole('heading', { level: 2, name: 'Perfil' })).toBeInTheDocument();
    expect(within(await index()).getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page');
  });

  it('RES-36 shows the Perfil section when the section in the address is unknown', async () => {
    await openApplications('/resume?section=nope');

    expect(await screen.findByRole('heading', { level: 2, name: 'Perfil' })).toBeInTheDocument();
    expect(within(await index()).getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page');
  });

  it('RES-35 opens the section of the address, and an index link changes the section and the address', async () => {
    const router = await openApplications('/resume?section=experiences');
    expect(await screen.findByRole('heading', { level: 2, name: 'Experiência' })).toBeInTheDocument();

    fireEvent.click(within(await index()).getByRole('link', { name: 'Perfil' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Perfil' })).toBeInTheDocument();
    await waitFor(() => expect(here(router)).toBe('/resume?section=profile'));
    expect(within(await index()).getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page');
  });

  it('RES-35 reads the resume once: changing the section does not read it again (Data Reads)', async () => {
    await openApplications('/resume?section=experiences');
    fireEvent.click(within(await index()).getByRole('link', { name: 'Perfil' }));
    await screen.findByRole('heading', { level: 2, name: 'Perfil' });

    expect(vi.mocked(getResume)).toHaveBeenCalledTimes(1);
  });

  it('RES-40 shows the failure with "Tentar de novo" when the read fails, and reading again shows the page', async () => {
    vi.mocked(getResume).mockResolvedValueOnce({ ok: false, status: 503 });
    await openApplications('/resume');
    expect(await screen.findByText('Não foi possível carregar o currículo.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Perfil' })).toBeInTheDocument();
    expect(vi.mocked(getResume)).toHaveBeenCalledTimes(2);
  });
});

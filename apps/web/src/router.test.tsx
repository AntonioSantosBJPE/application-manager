// @vitest-environment jsdom
import type { MeResponse } from '@am/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminLogin,
  endSession,
  getSession,
  joinWithInvitation,
  memberLogin,
  openInvitation,
  pendingInvitations,
  type SessionState,
} from './features/identity';
import { getSystemStatus } from './features/system-status';
import { routeTree } from './routeTree.gen';

// The session read is the BFF boundary: the guards ask a server function, and the unit test answers for it.
// Everything above it, the guards, the redirects and the screens, is the real route tree.
vi.mock('./features/identity/api/server-functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/identity/api/server-functions')>()),
  getSession: vi.fn(),
  endSession: vi.fn(),
  memberLogin: vi.fn(),
  adminLogin: vi.fn(),
  openInvitation: vi.fn(),
  joinWithInvitation: vi.fn(),
  pendingInvitations: vi.fn(),
}));

vi.mock('./features/system-status/api/get-system-status', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features/system-status/api/get-system-status')>()),
  getSystemStatus: vi.fn(),
}));

const member: MeResponse = {
  id: '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60',
  email: 'ana@example.test',
  name: 'Ana Souza',
  role: 'member',
};
const admin: MeResponse = {
  ...member,
  email: 'root@example.test',
  name: 'Root Admin',
  role: 'admin',
};
const signedInAs = (user: MeResponse): SessionState => ({ kind: 'authenticated', user });
const anonymous: SessionState = { kind: 'anonymous' };

function sessionIs(state: SessionState) {
  vi.mocked(getSession).mockResolvedValue(state);
}

async function open(url: string) {
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createRouter({ routeTree, history, context: { queryClient: new QueryClient() } });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
}

const here = (router: Awaited<ReturnType<typeof open>>) => router.state.location.href;

// jsdom has no scrolling; the router asks for it on every navigation.
beforeAll(() => {
  window.scrollTo = () => undefined;
});

// What the admin dashboard loader reads, so every test that lands on /admin gets a page to render.
beforeEach(() => {
  vi.mocked(getSystemStatus).mockResolvedValue({ api: 'operational', database: 'operational' });
  vi.mocked(pendingInvitations).mockResolvedValue({
    ok: true,
    data: { items: [], nextCursor: null, totalPending: 0 },
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('member area guard', () => {
  it('sends a visitor on / to /login preserving the route', async () => {
    sessionIs(anonymous);

    const router = await open('/');

    expect(here(router)).toBe('/login?redirect=%2F');
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('sends an admin on / to /admin', async () => {
    sessionIs(signedInAs(admin));

    const router = await open('/');

    expect(here(router)).toBe('/admin');
    expect(await screen.findByRole('heading', { name: 'Administração' })).toBeInTheDocument();
  });

  it('shows a member the home with the name and Sair', async () => {
    sessionIs(signedInAs(member));

    const router = await open('/');

    expect(here(router)).toBe('/');
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('PRU-06 AC11 says the service is unavailable on the same url without going to login', async () => {
    sessionIs({ kind: 'unavailable' });

    const router = await open('/');

    expect(here(router)).toBe('/');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.',
    );
  });

  it('Sair ends the session and opens /login for a member', async () => {
    sessionIs(signedInAs(member));
    vi.mocked(endSession).mockResolvedValue({ ok: true, data: undefined });
    const router = await open('/');

    sessionIs(anonymous);
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(here(router)).toBe('/login'));
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});

describe('admin area guard', () => {
  it('sends a visitor on an admin route to /admin/login preserving the route', async () => {
    sessionIs(anonymous);

    const router = await open('/admin');

    expect(here(router)).toBe('/admin/login?redirect=%2Fadmin');
    expect(await screen.findByRole('heading', { name: 'Administração' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('shows an admin the admin home with the name and Sair', async () => {
    sessionIs(signedInAs(admin));

    await open('/admin');

    expect(
      await screen.findByRole('navigation', { name: 'Navegação da administração' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Root Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('PRU-06 AC10 shows a member the no-access message with a link to / and no admin shell', async () => {
    sessionIs(signedInAs(member));

    const router = await open('/admin');

    expect(here(router)).toBe('/admin');
    expect(await screen.findByText('Esta área é da administração. Sua conta é de uso do produto.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('navigation')).toBeNull();
    // The way out is the screen's own (UI-27), not a shell menu: there is no navigation around it.
    expect(screen.getAllByRole('button', { name: 'Sair' })).toHaveLength(1);
  });

  it('says the service is unavailable on the same url without going to login', async () => {
    sessionIs({ kind: 'unavailable' });

    const router = await open('/admin');

    expect(here(router)).toBe('/admin');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.',
    );
  });

  it('Sair ends the session and opens /admin/login for an admin', async () => {
    sessionIs(signedInAs(admin));
    vi.mocked(endSession).mockResolvedValue({ ok: true, data: undefined });
    const router = await open('/admin');

    sessionIs(anonymous);
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(here(router)).toBe('/admin/login'));
  });
});

describe('login doors', () => {
  it('sends a signed-in member from /login to the home', async () => {
    sessionIs(signedInAs(member));

    const router = await open('/login');

    expect(here(router)).toBe('/');
  });

  it('sends a signed-in admin from /admin/login to /admin', async () => {
    sessionIs(signedInAs(admin));

    const router = await open('/admin/login');

    expect(here(router)).toBe('/admin');
  });

  it('keeps the form for a signed-in user on the door of the other area', async () => {
    sessionIs(signedInAs(member));

    const router = await open('/admin/login');

    expect(here(router)).toBe('/admin/login');
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('shows the expired-session message on the login of the area', async () => {
    sessionIs(anonymous);

    await open('/admin/login?redirect=%2Fadmin%2Finvitations&reason=expired');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sua sessão expirou. Entre de novo para continuar.',
    );
  });

  it('opens the preserved route after a member signs in', async () => {
    sessionIs(anonymous);
    vi.mocked(memberLogin).mockImplementation(async () => {
      sessionIs(signedInAs(member));
      return { ok: true, data: undefined };
    });
    const router = await open('/login?redirect=%2Fsome%2Fplace');

    fireEvent.change(await screen.findByLabelText('E-mail'), {
      target: { value: 'ana@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'correct horse battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(here(router)).toBe('/some/place'));
  });

  it('ignores a preserved route that is not an internal path and opens the default one', async () => {
    sessionIs(anonymous);
    vi.mocked(adminLogin).mockImplementation(async () => {
      sessionIs(signedInAs(admin));
      return { ok: true, data: undefined };
    });
    const router = await open('/admin/login?redirect=%2F%2Fevil.test');

    fireEvent.change(await screen.findByLabelText('E-mail'), {
      target: { value: 'root@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'correct horse battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(here(router)).toBe('/admin'));
  });
});

describe('invitation screen', () => {
  const details = { email: 'novo@example.test', expiresAt: '2026-11-13T12:00:00.000Z' };

  it('opens the home signed in after Criar conta', async () => {
    sessionIs(anonymous);
    vi.mocked(openInvitation).mockResolvedValue({ ok: true, data: details });
    vi.mocked(joinWithInvitation).mockImplementation(async () => {
      sessionIs(signedInAs(member));
      return { ok: true, data: undefined };
    });
    const router = await open('/invite/token-from-the-link');

    expect(await screen.findByLabelText('E-mail')).toHaveValue('novo@example.test');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Souza' } });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'a long enough password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(here(router)).toBe('/'));
    expect(vi.mocked(openInvitation)).toHaveBeenCalledWith({ data: 'token-from-the-link' });
    expect(vi.mocked(joinWithInvitation)).toHaveBeenCalledWith({
      data: { token: 'token-from-the-link', name: 'Ana Souza', password: 'a long enough password' },
    });
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
  });

  it('shows the invalid message and no form for a dead link', async () => {
    sessionIs(anonymous);
    vi.mocked(openInvitation).mockResolvedValue({ ok: false, status: 410 });

    await open('/invite/dead-token');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este convite expirou ou já foi usado. Peça um novo link a quem te convidou.',
    );
    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull();
  });
});

describe('admin dashboard', () => {
  const page = { items: [], nextCursor: null, totalPending: 3 };

  it('shows the status panel, the pending total and the link to the invitations screen', async () => {
    sessionIs(signedInAs(admin));
    vi.mocked(getSystemStatus).mockResolvedValue({ api: 'operational', database: 'operational' });
    vi.mocked(pendingInvitations).mockResolvedValue({ ok: true, data: page });

    await open('/admin');

    const api = await screen.findByRole('group', { name: 'API' });
    expect(api).toHaveTextContent('Operacional');
    expect(screen.getByRole('group', { name: 'Banco de dados' })).toHaveTextContent('Operacional');
    expect(screen.getByRole('group', { name: 'Convites pendentes' })).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: 'Ver convites' })).toHaveAttribute(
      'href',
      '/admin/invitations',
    );
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('shows the panel as unavailable when the api is down', async () => {
    sessionIs(signedInAs(admin));
    vi.mocked(getSystemStatus).mockResolvedValue({ api: 'unavailable', database: 'unavailable' });
    vi.mocked(pendingInvitations).mockResolvedValue({ ok: false, status: 503 });

    await open('/admin');

    expect(await screen.findByRole('group', { name: 'API' })).toHaveTextContent('Indisponível');
    expect(screen.getByRole('group', { name: 'Banco de dados' })).toHaveTextContent('Indisponível');
    expect(screen.getByRole('group', { name: 'Convites pendentes' })).toHaveTextContent(
      'Indisponível',
    );
  });

  it('does not read admin data for a member who is shown the no-access screen', async () => {
    sessionIs(signedInAs(member));

    await open('/admin');

    expect(await screen.findByText('Esta área é da administração. Sua conta é de uso do produto.')).toBeInTheDocument();
    expect(vi.mocked(pendingInvitations)).not.toHaveBeenCalled();
    expect(vi.mocked(getSystemStatus)).not.toHaveBeenCalled();
  });
});

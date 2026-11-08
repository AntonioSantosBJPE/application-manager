// @vitest-environment jsdom
import type { MeResponse } from '@am/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
const operationalStatus = {
  api: 'operational',
  database: 'operational',
  checkedAt: '2026-11-08T17:32:07.000Z',
} as const;

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
  vi.mocked(getSystemStatus).mockResolvedValue(operationalStatus);
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

  it('PRU-06 AC13 shows the member shell: wordmark, Início as current, initials, name and Sair', async () => {
    sessionIs(signedInAs(member));

    await open('/');

    const sidebar = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(sidebar).getByText('rumo')).toBeInTheDocument();
    expect(within(sidebar).getByText('carreira')).toBeInTheDocument();
    const links = within(sidebar).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Início']);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar).getByText('AS')).toHaveAttribute('aria-hidden', 'true');
    expect(within(sidebar).getByText('Ana Souza')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    // Only what exists (AD-008): no search button and no destination of a later phase.
    expect(within(sidebar).queryByText(/Buscar|Candidaturas|Currículo|Skills|Insights/)).toBeNull();
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

describe('member home', () => {
  it('PRU-06 AC12 shows the home: h1, greeting, line, the three steps and the empty state', async () => {
    sessionIs(signedInAs(member));

    await open('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    expect(screen.getByText('Olá, Ana Souza')).toBeInTheDocument();
    expect(
      screen.getByText('Três passos para a primeira candidatura com currículo adaptado.'),
    ).toBeInTheDocument();

    const steps = screen.getAllByRole('heading', { level: 2 }).map((heading) => {
      const step = heading.closest('section');
      return [step?.firstElementChild?.firstElementChild?.textContent, heading.textContent];
    });
    expect(steps).toEqual([
      ['01', 'Conta criada'],
      ['02', 'Preencha o currículo mestre'],
      ['03', 'Cadastre uma vaga'],
    ]);
    expect(screen.getByText('Você entrou por convite. Nada a fazer aqui.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Experiências e bullets marcados por skill. É dele que sai cada versão adaptada.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Empresa, título, nível e as skills pedidas. Leva menos de 2 minutos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Quando houver candidaturas, aqui aparecem o pipeline, o que precisa de atenção e a atividade recente.',
      ),
    ).toBeInTheDocument();
  });

  it('PRU-06 AC12 opens the home with the topbar "Início" before the content', async () => {
    sessionIs(signedInAs(member));

    await open('/');
    const title = await screen.findByRole('heading', { level: 1, name: 'Início' });

    const main = screen.getByRole('main');
    const topbar = main.firstElementChild!;
    expect(topbar.textContent).toBe('Início');
    expect(within(topbar as HTMLElement).getByText('Início')).toHaveClass('font-medium');
    expect(topbar).not.toContainElement(title);
    const content = topbar.nextElementSibling!;
    expect(content).toContainElement(title);
    expect(main.children).toHaveLength(2);
  });

  it('PRU-06 AC12 promises nothing that does not exist yet: no step buttons, no ⌘K tip', async () => {
    sessionIs(signedInAs(member));

    await open('/');
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    expect(screen.queryByRole('button', { name: /Começar pelo perfil|Nova candidatura/ })).toBeNull();
    expect(screen.queryByText(/⌘K/)).toBeNull();
    // The only button in the page is the way out of the shell.
    // "Sair" is an icon-only button named by its aria-label (PageMemberHome), so the name is compared.
    expect(screen.getAllByRole('button')).toEqual([screen.getByRole('button', { name: 'Sair' })]);
  });

  it('PRU-06 AC12 greets without a name when the session has none', async () => {
    sessionIs(signedInAs({ ...member, name: '' }));

    await open('/');
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    expect(screen.getByText('Olá')).toBeInTheDocument();
    expect(screen.queryByText(/Olá,/)).toBeNull();
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

  it('PRU-06 AC15 shows the admin shell: wordmark with admin, the three destinations, initials, name and Sair', async () => {
    sessionIs(signedInAs(admin));

    await open('/admin');

    const sidebar = await screen.findByRole('navigation', { name: 'Navegação da administração' });
    expect(within(sidebar).getByText('rumo')).toBeInTheDocument();
    expect(within(sidebar).getByText('carreira')).toBeInTheDocument();
    expect(within(sidebar).getByText('admin')).toBeInTheDocument();
    const links = within(sidebar).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Painel', '/admin'],
      ['Convites', '/admin/invitations'],
      ['Status do sistema', '/status'],
    ]);
    expect(within(sidebar).getByRole('link', { name: 'Painel' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar).getByText('RA')).toHaveAttribute('aria-hidden', 'true');
    expect(within(sidebar).getByText('Root Admin')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(within(sidebar).queryByText(/Catálogo de skills|Buscar/)).toBeNull();
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
    vi.mocked(getSystemStatus).mockResolvedValue(operationalStatus);
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
    vi.mocked(getSystemStatus).mockResolvedValue({
      ...operationalStatus,
      api: 'unavailable',
      database: 'unavailable',
    });
    vi.mocked(pendingInvitations).mockResolvedValue({ ok: false, status: 503 });

    await open('/admin');

    expect(await screen.findByRole('group', { name: 'API' })).toHaveTextContent('Indisponível');
    expect(screen.getByRole('group', { name: 'Banco de dados' })).toHaveTextContent('Indisponível');
    expect(screen.getByRole('group', { name: 'Convites pendentes' })).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
  });

  it('PRU-06 AC14 opens the admin dashboard with the topbar "Painel", the h1 and the two widgets', async () => {
    sessionIs(signedInAs(admin));
    vi.mocked(pendingInvitations).mockResolvedValue({ ok: true, data: page });

    await open('/admin');
    const title = await screen.findByRole('heading', { level: 1, name: 'Administração' });

    const main = screen.getByRole('main');
    const topbar = main.firstElementChild!;
    expect(topbar.textContent).toBe('Painel');
    expect(within(topbar as HTMLElement).getByText('Painel')).toHaveClass('font-medium');
    expect(topbar).not.toContainElement(title);
    expect(topbar.nextElementSibling).toContainElement(title);
    expect(main.children).toHaveLength(2);
    expect(title).toHaveClass('text-heading-lg');
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Status do sistema', 'Convites pendentes']);
    expect(screen.getByText('08 nov 2026 14:32:07')).toHaveClass('font-mono');
    expect(within(screen.getByRole('group', { name: 'Convites pendentes' })).getByText('3')).toHaveClass(
      'text-heading-xl',
    );
  });

  it('PRU-06 AC20 Convidar pessoa in the widget opens /admin/invitations', async () => {
    sessionIs(signedInAs(admin));
    vi.mocked(pendingInvitations).mockResolvedValue({ ok: true, data: page });
    // The invitations screen reads its list through the query client the app provides around the router.
    const queryClient = new QueryClient();
    const history = createMemoryHistory({ initialEntries: ['/admin'] });
    const router = createRouter({ routeTree, history, context: { queryClient } });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await router.load();

    fireEvent.click(await screen.findByRole('link', { name: 'Convidar pessoa' }));

    await waitFor(() => expect(here(router)).toBe('/admin/invitations'));
    expect(await screen.findByLabelText('E-mail a convidar')).toBeInTheDocument();
  });

  it('does not read admin data for a member who is shown the no-access screen', async () => {
    sessionIs(signedInAs(member));

    await open('/admin');

    expect(await screen.findByText('Esta área é da administração. Sua conta é de uso do produto.')).toBeInTheDocument();
    expect(vi.mocked(pendingInvitations)).not.toHaveBeenCalled();
    expect(vi.mocked(getSystemStatus)).not.toHaveBeenCalled();
  });
});

describe('status page', () => {
  it('PRU-06 AC21 opens /status outside the app shell, for anyone', async () => {
    sessionIs(anonymous);

    const router = await open('/status');

    expect(here(router)).toBe('/status');
    expect(await screen.findByRole('heading', { level: 1, name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Todos os sistemas operacionais',
    );
    expect(screen.getByText(/^Verificado às/)).toHaveTextContent(
      'Verificado às 14:32:07 de 08 nov 2026.',
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});

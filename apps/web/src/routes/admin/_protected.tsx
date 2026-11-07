import { AppShell } from '@am/ui';
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import {
  adminAreaAccess,
  endSession,
  getSession,
  loginPathOf,
  NoAccessScreen,
  SessionMenu,
  UnavailableScreen,
} from '../../features/identity';

/**
 * The admin area. Visitors are redirected on the server (UI-07); a member sees the no-access screen
 * on the same URL, and the shell with its navigation is never rendered for them (UI-10).
 */
export const Route = createFileRoute('/admin/_protected')({
  beforeLoad: async ({ location }) => {
    const access = adminAreaAccess(await getSession(), location.href);
    if (access.kind === 'sign-in')
      throw redirect({ to: '/admin/login', search: { redirect: access.returnTo } });
    return { access };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { access } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (access.kind === 'forbidden') return <NoAccessScreen />;
  if (access.kind !== 'allowed') return <UnavailableScreen />;

  return (
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação da administração">
        <AppShell.NavItem asChild current={pathname === '/admin' || pathname === '/admin/'}>
          <Link to="/admin">Painel</Link>
        </AppShell.NavItem>
        <AppShell.NavItem asChild current={pathname.startsWith('/admin/invitations')}>
          <Link to="/admin/invitations">Convites</Link>
        </AppShell.NavItem>
        <SessionMenu
          user={access.user}
          signOut={() => endSession()}
          onSignedOut={() => router.history.push(loginPathOf('admin'))}
        />
      </AppShell.Sidebar>
      <AppShell.Main asChild>
        <Outlet />
      </AppShell.Main>
    </AppShell.Root>
  );
}

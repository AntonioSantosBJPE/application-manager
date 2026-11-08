import { AppShell } from '@am/ui';
import { House } from 'lucide-react';
import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router';
import {
  endSession,
  getSession,
  loginPathOf,
  memberAreaAccess,
  SessionMenu,
  UnavailableScreen,
} from '../features/identity';

/**
 * The member area. The guard runs in `beforeLoad`, so a visitor is redirected while the server renders
 * and never sees the page first (UI-06). An api that does not answer renders the unavailable screen
 * here, still on the asked URL (UI-05).
 */
export const Route = createFileRoute('/_member')({
  beforeLoad: async ({ location }) => {
    const access = memberAreaAccess(await getSession(), location.href);
    if (access.kind === 'sign-in')
      throw redirect({ to: '/login', search: { redirect: access.returnTo } });
    if (access.kind === 'move-to-admin') throw redirect({ to: '/admin' });
    return { access };
  },
  component: MemberLayout,
});

function MemberLayout() {
  const { access } = Route.useRouteContext();
  const router = useRouter();
  if (access.kind !== 'allowed') return <UnavailableScreen />;

  return (
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação principal">
        <AppShell.Brand />
        <AppShell.NavItem asChild current icon={House}>
          <Link to="/">Início</Link>
        </AppShell.NavItem>
        <SessionMenu
          user={access.user}
          signOut={() => endSession()}
          onSignedOut={() => router.history.push(loginPathOf('member'))}
        />
      </AppShell.Sidebar>
      <AppShell.Main asChild>
        <Outlet />
      </AppShell.Main>
    </AppShell.Root>
  );
}

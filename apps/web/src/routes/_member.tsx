import { AppShell } from '@am/ui';
import { Briefcase, House } from 'lucide-react';
import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from '@tanstack/react-router';
import { countApplications } from '../features/applications';
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
  // The total of the sidebar. A failed read leaves the number out; the item still opens the list.
  loader: async ({ context }) => {
    if (context.access.kind !== 'allowed') return { total: undefined };
    const outcome = await countApplications();
    return { total: outcome.ok ? outcome.data.total : undefined };
  },
  component: MemberLayout,
});

/** The list and the detail of an application are the same area of the sidebar (APP-43). */
const isApplicationsPath = (pathname: string) => pathname === '/applications' || pathname.startsWith('/applications/');

function MemberLayout() {
  const { access } = Route.useRouteContext();
  const { total } = Route.useLoaderData();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (access.kind !== 'allowed') return <UnavailableScreen />;

  return (
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação principal">
        <AppShell.Brand />
        <AppShell.NavItem asChild current={pathname === '/'} icon={House}>
          <Link to="/" activeOptions={{ exact: true }}>
            Início
          </Link>
        </AppShell.NavItem>
        <AppShell.NavItem asChild current={isApplicationsPath(pathname)} icon={Briefcase} count={total}>
          <Link to="/applications">Candidaturas</Link>
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

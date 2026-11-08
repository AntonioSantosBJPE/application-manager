import { AppShell, DashboardPage } from '@am/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { InvitationSummary, pendingInvitations } from '../../../features/identity';
import { getSystemStatus, StatusWidgets } from '../../../features/system-status';

/**
 * Home of the admin area (ADM-14, ADM-15): the topbar "Painel" edge to edge, then the system status and
 * the pending invitations as widgets of a dashboard. The loader reads both at once, and skips the api calls when the layout is not showing the area
 * (a member's no-access screen, an api that did not answer).
 */
export const Route = createFileRoute('/admin/_protected/')({
  loader: async ({ context }) => {
    if (context.access.kind !== 'allowed') return null;
    const [status, invitations] = await Promise.all([
      getSystemStatus(),
      pendingInvitations({ data: undefined }),
    ]);
    return { status, invitations };
  },
  component: AdminHome,
});

function AdminHome() {
  const data = Route.useLoaderData();
  if (data === null) return null;

  return (
    <DashboardPage.Root>
      <AppShell.Topbar>
        <b className="text-body font-medium">Painel</b>
      </AppShell.Topbar>
      <DashboardPage.Content>
        <DashboardPage.Header>
          <h1 className="text-heading-lg">Administração</h1>
        </DashboardPage.Header>
        <DashboardPage.Grid>
          <StatusWidgets status={data.status} />
          <InvitationSummary
            result={data.invitations}
            link={<Link to="/admin/invitations">Ver convites</Link>}
            inviteLink={<Link to="/admin/invitations">Convidar pessoa</Link>}
          />
        </DashboardPage.Grid>
      </DashboardPage.Content>
    </DashboardPage.Root>
  );
}

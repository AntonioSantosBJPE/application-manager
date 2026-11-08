import { AppShell, DashboardPage } from '@am/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { InvitationSummary, pendingInvitations } from '../../../features/identity';
import { listAdminSkills, PrivateSkillsSummary } from '../../../features/skills';
import { getSystemStatus, StatusWidgets } from '../../../features/system-status';

/**
 * Home of the admin area (ADM-14, ADM-15, SKL-55): the topbar "Painel" edge to edge, then the system status,
 * the pending invitations and the private skills as widgets of a dashboard. The loader reads the three at once
 * (each one an outcome, so one that fails shows its own alert), and skips the api calls when the layout is not showing the area
 * (a member's no-access screen, an api that did not answer).
 */
export const Route = createFileRoute('/admin/_protected/')({
  loader: async ({ context }) => {
    if (context.access.kind !== 'allowed') return null;
    const [status, invitations, privateSkills] = await Promise.all([
      getSystemStatus(),
      pendingInvitations({ data: undefined }),
      listAdminSkills({ data: { scope: 'private' } }),
    ]);
    return { status, invitations, privateSkills };
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
          <PrivateSkillsSummary
            result={data.privateSkills}
            link={
              <Link to="/admin/skills" search={{ scope: 'private' }}>
                Abrir catálogo
              </Link>
            }
          />
        </DashboardPage.Grid>
      </DashboardPage.Content>
    </DashboardPage.Root>
  );
}

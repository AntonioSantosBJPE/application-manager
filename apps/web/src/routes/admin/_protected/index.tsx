import { DashboardPage } from '@am/ui';
import { createFileRoute } from '@tanstack/react-router';

/** Home of the admin area. T39 fills it with the status panel and the invitation summary. */
export const Route = createFileRoute('/admin/_protected/')({
  component: AdminHome,
});

function AdminHome() {
  return (
    <DashboardPage.Root>
      <DashboardPage.Header>
        <h1 className="text-lg font-semibold">Administração</h1>
      </DashboardPage.Header>
    </DashboardPage.Root>
  );
}

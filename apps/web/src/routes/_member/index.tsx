import { DashboardPage } from '@am/ui';
import { createFileRoute } from '@tanstack/react-router';

/** Home of the member area: a minimal dashboard the next slices fill with their widgets. */
export const Route = createFileRoute('/_member/')({
  component: MemberHome,
});

function MemberHome() {
  return (
    <DashboardPage.Root>
      <DashboardPage.Header>
        <h1 className="text-lg font-semibold">Início</h1>
      </DashboardPage.Header>
    </DashboardPage.Root>
  );
}

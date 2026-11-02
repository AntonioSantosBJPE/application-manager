import { createFileRoute } from '@tanstack/react-router';
import { getSystemStatus, StatusPanel } from '../features/system-status';

export const Route = createFileRoute('/')({
  loader: () => getSystemStatus(),
  component: StatusPage,
});

function StatusPage() {
  return <StatusPanel status={Route.useLoaderData()} />;
}

import { createFileRoute } from '@tanstack/react-router';
import { getSystemStatus, StatusPanel } from '../features/system-status';

/** Public status page: no session, and the only page the web marks as cacheable (UI-20). */
export const Route = createFileRoute('/status')({
  loader: () => getSystemStatus(),
  component: StatusPage,
});

function StatusPage() {
  return <StatusPanel status={Route.useLoaderData()} />;
}

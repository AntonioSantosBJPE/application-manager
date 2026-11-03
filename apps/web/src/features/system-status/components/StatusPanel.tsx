import { DashboardPage, StatusBadge } from '@am/ui';
import type { ServiceState, SystemStatus } from '../model/system-status';

const stateText: Record<ServiceState, string> = {
  operational: 'Operacional',
  unavailable: 'Indisponível',
};

function StatusRow({ label, state }: { label: string; state: ServiceState }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center justify-between rounded-md border border-border bg-surface-raised px-4 py-3"
    >
      <span className="text-sm font-medium">{label}</span>
      <StatusBadge intent={state}>{stateText[state]}</StatusBadge>
    </div>
  );
}

/** Status page body: one row for the API and one for the database (SKEL-05). */
export function StatusPanel({ status }: { status: SystemStatus }) {
  return (
    <DashboardPage.Root>
      <DashboardPage.Header>
        <h1 className="text-lg font-semibold">Status do sistema</h1>
      </DashboardPage.Header>
      <DashboardPage.Grid>
        <StatusRow label="API" state={status.api} />
        <StatusRow label="Banco de dados" state={status.database} />
      </DashboardPage.Grid>
    </DashboardPage.Root>
  );
}

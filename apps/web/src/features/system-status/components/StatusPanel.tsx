import { DashboardPage, Logo, PipelineStatus, StatusBadge } from '@am/ui';
import { useId } from 'react';
import {
  componentsInOrder,
  formatCheckedAt,
  verdictOf,
  type ServiceState,
  type SystemComponent,
  type SystemStatus,
} from '../model/system-status';

const stateText: Record<ServiceState, string> = {
  operational: 'Operacional',
  unavailable: 'Indisponível',
};

const componentText: Record<SystemComponent, string> = {
  api: 'API',
  database: 'Banco de dados',
};

const verdictText = {
  operational: 'Todos os sistemas operacionais',
  degraded: 'Serviço degradado',
} as const;

/**
 * The status widget of the admin dashboard (PRU-06 AC14): the verdict as a badge in the header, then
 * the API, the database and the instant the web read them, in `font-mono`. It is a widget of the
 * dashboard grid, so the page keeps a single `main`.
 */
export function StatusWidgets({ status }: { status: SystemStatus }) {
  const titleId = useId();
  const verdict = verdictOf(status);
  const checked = formatCheckedAt(status.checkedAt);

  return (
    <DashboardPage.Widget span={6} aria-labelledby={titleId}>
      <DashboardPage.Widget.Header>
        <DashboardPage.Widget.Title id={titleId}>Status do sistema</DashboardPage.Widget.Title>
        <StatusBadge intent={verdict === 'operational' ? 'operational' : 'unavailable'}>
          {verdict === 'operational' ? 'Operacional' : 'Degradado'}
        </StatusBadge>
      </DashboardPage.Widget.Header>
      <dl className="flex flex-col gap-2">
        {(['api', 'database'] as const).map((component) => (
          <div
            key={component}
            role="group"
            aria-label={componentText[component]}
            className="flex items-center gap-4"
          >
            <dt className="w-30 shrink-0 text-label text-text-muted">{componentText[component]}</dt>
            <dd>
              <StatusBadge intent={status[component]}>{stateText[status[component]]}</StatusBadge>
            </dd>
          </div>
        ))}
        {checked === undefined ? null : (
          <div className="flex items-center gap-4">
            <dt className="w-30 shrink-0 text-label text-text-muted">Verificado</dt>
            <dd className="font-mono text-text-muted">
              {checked.date} {checked.time}
            </dd>
          </div>
        )}
      </dl>
    </DashboardPage.Widget>
  );
}

/**
 * The public status page (PRU-06 AC21, AC22), outside the app shell: a 560px column with the wordmark,
 * the verdict, the instant the web read the health (AD-009) and one row per component, the unavailable
 * ones first and in `danger`.
 */
export function StatusPanel({ status }: { status: SystemStatus }) {
  const verdictId = useId();
  const verdict = verdictOf(status);
  const checked = formatCheckedAt(status.checkedAt);

  return (
    <DashboardPage.Root className="min-h-screen items-center px-6 py-24">
      <div className="flex w-full max-w-140 flex-col gap-6">
        <header className="flex items-center gap-3">
          <Logo variant="wordmark" />
          <h1 className="ml-auto text-caption text-text-muted">Status</h1>
        </header>
        <section
          aria-labelledby={verdictId}
          className="flex flex-col gap-2 rounded-md border border-border p-5"
        >
          <div className="flex items-center gap-3">
            <PipelineStatus
              status={verdict === 'operational' ? 'accepted' : 'rejected'}
              label={verdict === 'operational' ? 'Operacional' : 'Degradado'}
              iconOnly
            />
            <h2 id={verdictId} className="text-heading-lg">
              {verdictText[verdict]}
            </h2>
          </div>
          {checked === undefined ? null : (
            <p className="text-text-muted">
              Verificado às <span className="font-mono">{checked.time}</span> de {checked.date}.
            </p>
          )}
        </section>
        <ul aria-label="Componentes" className="rounded-md border border-border">
          {componentsInOrder(status).map(({ component, state }) => (
            <li key={component} className="border-b border-border last:border-b-0">
              <div
                role="group"
                aria-label={componentText[component]}
                className="flex min-h-row items-center justify-between gap-3 px-4"
              >
                <span
                  className={
                    state === 'unavailable' ? 'font-medium text-danger' : 'font-medium text-text'
                  }
                >
                  {componentText[component]}
                </span>
                <StatusBadge intent={state}>{stateText[state]}</StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </DashboardPage.Root>
  );
}

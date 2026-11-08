import type { ApplicationDetail, ApplicationStatus, ApplicationSummary, ApplicationsPage, JobLevel } from '@am/contracts';
import { Alert, Button, EmptyState, Kbd, ListPage, PipelineStatus } from '@am/ui';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import { MESSAGES } from '../../identity';
import { DEFAULT_APPLICATIONS_FILTERS, type ApplicationsFilters as Filters } from '../model/filters';
import { groups } from '../model/groups';
import { STATUS_GROUP_LABELS, STATUS_LABELS } from '../model/labels';
import { APPLICATIONS_MESSAGES, newInStatusLabel } from '../model/messages';
import { refusalMessage } from '../model/refusal';
import { ApplicationsFilters, SortButton } from './ApplicationsFilters';
import { RowActions } from './RowActions';

export const APPLICATIONS_QUERY_KEY = ['applications', 'list'] as const;

/** What the list needs from the BFF; the route binds the server functions, a test binds the api. */
export interface ApplicationsListApi {
  list: (filters: Filters, cursor: string | undefined) => Promise<Outcome<ApplicationsPage>>;
  changeStatus: (id: string, status: ApplicationStatus) => Promise<Outcome<ApplicationDetail>>;
  changeLevel: (id: string, level: JobLevel) => Promise<Outcome<ApplicationDetail>>;
}

export interface ApplicationsListProps {
  api: ApplicationsListApi;
  /** The filters the address holds. */
  filters?: Filters;
  /** The instant "hoje" and "há N d" count from, taken once by the loader. */
  now: Date;
  onFiltersChange: (filters: Filters) => void;
  /** Opens the dialog of a new application, already in a status when the "+" of a group was used (APP-45, APP-58). */
  onNew: (status?: ApplicationStatus) => void;
  /** Opens the detail of an application (APP-49). */
  onOpen: (id: string) => void;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

/** A read that failed; `expired` is the `401` the redirect to the login already answers. */
class ReadFailure extends Error {
  constructor(readonly expired: boolean) {
    super('the applications could not be read');
  }
}

const hasSearch = (filters: Filters) =>
  filters.status.length > 0 || filters.level.length > 0 || filters.workModel.length > 0 || filters.q !== '';

/**
 * The applications list (PageApplications): the title with the total, the filter row, and the rows in
 * one section per status. What is listed, its order and every number come from the api; the screen
 * cuts the ordered list into sections (`groups`), formats it and asks for the next page.
 */
export function ApplicationsList({
  api,
  filters = DEFAULT_APPLICATIONS_FILTERS,
  now,
  onFiltersChange,
  onNew,
  onOpen,
  onExpired,
}: ApplicationsListProps) {
  const id = useId();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | undefined>();
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocusAfter = useRef<number | undefined>(undefined);

  const applications = useInfiniteQuery({
    queryKey: [...APPLICATIONS_QUERY_KEY, filters.tab, filters.status, filters.level, filters.workModel, filters.q, filters.sort],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const outcome = await api.list(filters, pageParam);
      if (outcome.ok) return outcome.data;
      throw new ReadFailure(onExpired(outcome));
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  });

  const pages = applications.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const counts = pages.at(-1)?.counts;
  const total = counts === undefined ? undefined : counts.active + counts.closed;
  const expired = applications.error instanceof ReadFailure && applications.error.expired;
  const sections = counts === undefined ? [] : groups(items, counts.byStatus);

  // "Carregar mais" leaves the focus on the first row it added (ListPage guide).
  useEffect(() => {
    const after = pendingFocusAfter.current;
    if (after === undefined || items.length <= after) return;
    pendingFocusAfter.current = undefined;
    listRef.current?.querySelectorAll<HTMLElement>('[data-application-id]')[after]?.focus();
  }, [items.length]);

  /**
   * Writes a change from the row menu and reads the list again from the api, so the row shows in its new
   * group or leaves the tab and every number follows (APP-50). A failure leaves the row as it was (APP-55).
   */
  async function change(write: () => Promise<Outcome<ApplicationDetail>>) {
    setFailure(undefined);
    let outcome: Outcome<ApplicationDetail>;
    try {
      outcome = await write();
    } catch {
      setFailure(MESSAGES.unavailable);
      return;
    }
    if (outcome.ok) {
      await queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
      return;
    }
    if (onExpired(outcome)) return;
    setFailure(refusalMessage(outcome));
  }

  const changeStatus = (application: ApplicationSummary, status: ApplicationStatus) =>
    void change(() => api.changeStatus(application.id, status));
  const changeLevel = (application: ApplicationSummary, level: JobLevel) =>
    void change(() => api.changeLevel(application.id, level));

  function clearFilters() {
    onFiltersChange({ ...DEFAULT_APPLICATIONS_FILTERS, tab: filters.tab });
  }

  return (
    <ListPage.Root>
      <ListPage.Header>
        <h1>{APPLICATIONS_MESSAGES.title}</h1>
        {total === undefined ? null : (
          <span className="font-mono text-caption font-normal text-text-muted">{total}</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <SortButton filters={filters} onFiltersChange={onFiltersChange} />
          <Button intent="primary" size="sm" icon={Plus} onClick={() => onNew()}>
            {APPLICATIONS_MESSAGES.newApplication}
            <Kbd tone="on-accent">{APPLICATIONS_MESSAGES.newShortcut}</Kbd>
          </Button>
        </span>
      </ListPage.Header>
      <ListPage.Filters aria-label={APPLICATIONS_MESSAGES.filters}>
        <ApplicationsFilters filters={filters} counts={counts} onFiltersChange={onFiltersChange} />
      </ListPage.Filters>
      <ListPage.Content>
        {failure === undefined ? null : (
          <Alert intent="danger" className="mx-6 mt-4">
            {failure}
          </Alert>
        )}
        {applications.isError && !expired ? (
          <Alert
            intent="danger"
            className="mx-6 mt-4"
            action={
              <Button intent="secondary" size="sm" onClick={() => void applications.refetch()}>
                {APPLICATIONS_MESSAGES.retry}
              </Button>
            }
          >
            {APPLICATIONS_MESSAGES.loadError}
          </Alert>
        ) : null}
        {applications.isPending ? (
          <p className="px-6 py-4 text-caption text-text-muted">{APPLICATIONS_MESSAGES.loading}</p>
        ) : null}
        {applications.isSuccess && items.length === 0 ? (
          total === 0 && !hasSearch(filters) ? (
            <EmptyState.Root className="mx-6 mt-4">
              <p>{APPLICATIONS_MESSAGES.empty}</p>
              <EmptyState.Action>
                <Button intent="primary" size="sm" icon={Plus} onClick={() => onNew()}>
                  {APPLICATIONS_MESSAGES.newApplication}
                </Button>
              </EmptyState.Action>
            </EmptyState.Root>
          ) : (
            <EmptyState.Root className="mx-6 mt-4">
              <p>{APPLICATIONS_MESSAGES.noMatch}</p>
              {hasSearch(filters) ? (
                <EmptyState.Action>
                  <Button intent="secondary" size="sm" onClick={clearFilters}>
                    {APPLICATIONS_MESSAGES.clearFilters}
                  </Button>
                </EmptyState.Action>
              ) : null}
            </EmptyState.Root>
          )
        ) : null}
        <div ref={listRef}>
          {sections.map((section) => (
            <section key={section.status}>
              <ListPage.Group
                id={`${id}-${section.status}`}
                count={section.count}
                action={
                  <Button
                    intent="ghost"
                    size="sm"
                    icon={Plus}
                    aria-label={newInStatusLabel(section.status)}
                    onClick={() => onNew(section.status)}
                  />
                }
              >
                <PipelineStatus status={section.status} label={STATUS_LABELS[section.status]} iconOnly aria-hidden="true" />
                {STATUS_GROUP_LABELS[section.status]}
              </ListPage.Group>
              <ul aria-labelledby={`${id}-${section.status}`}>
                {section.items.map((application) => (
                  <RowActions
                    key={application.id}
                    application={application}
                    now={now}
                    onOpen={onOpen}
                    onStatus={changeStatus}
                    onLevel={changeLevel}
                    tabIndex={-1}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {applications.hasNextPage ? (
          <div className="px-6 py-4">
            <Button
              intent="secondary"
              disabled={applications.isFetchingNextPage}
              onClick={() => {
                pendingFocusAfter.current = items.length;
                void applications.fetchNextPage();
              }}
            >
              {APPLICATIONS_MESSAGES.loadMore}
            </Button>
          </div>
        ) : null}
      </ListPage.Content>
    </ListPage.Root>
  );
}

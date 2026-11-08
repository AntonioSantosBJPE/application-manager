import type { AdminSkillsPage } from '@am/contracts';
import { Alert, Button, EmptyState, FilterChip, ListPage, SearchInput } from '@am/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MESSAGES } from '../../identity';
import type { Outcome } from '../../../lib/bff';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../model/categories';
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from '../model/filters';
import { SKILLS_MESSAGES } from '../model/messages';
import { SkillRow } from './SkillRow';

export const SKILLS_QUERY_KEY = ['skills', 'catalog'] as const;

/** What the catalog needs from the BFF; the route binds the server functions, a test binds the api. */
export interface SkillsCatalogApi {
  list: (filters: CatalogFilters, cursor: string | undefined) => Promise<Outcome<AdminSkillsPage>>;
}

/** The search waits this long after the last key before it changes the filters (SKL-41). */
export const SEARCH_DELAY_MS = 300;

export interface SkillsCatalogProps {
  api: SkillsCatalogApi;
  /** The filters the address holds. */
  filters?: CatalogFilters;
  /** Called with the new filters when a chip is used or the search settles; the route puts them in the address (SKL-41). */
  onFiltersChange: (filters: CatalogFilters) => void;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening (SKL-51). */
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

/** A read that failed; `expired` is the `401` the redirect to the login already answers. */
class ReadFailure extends Error {
  constructor(readonly expired: boolean) {
    super('the skills catalog could not be read');
  }
}

/**
 * The admin catalog (PageSkills): the title with the total of the whole catalog, the skills in
 * alphabetical order as the api sends them (AD-013), and the note about the promotion rule. What is
 * listed, its order and the counts are the api's decision; the screen only shows each page and asks
 * for the next one.
 */
export function SkillsCatalog({
  api,
  filters = DEFAULT_CATALOG_FILTERS,
  onFiltersChange,
  onExpired,
}: SkillsCatalogProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const pendingFocusAfter = useRef<number | undefined>(undefined);

  // The field shows what the person typed; `filters.q` follows 300 ms after the last key. `sentQ` is the
  // last text this screen put in the filters, so an address that changes by itself (Limpar filtros, the
  // back button) can tell itself apart from the echo of the person's own typing.
  const [searchText, setSearchText] = useState(filters.q);
  const sentQ = useRef(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ filters, onFiltersChange });
  useEffect(() => {
    latest.current = { filters, onFiltersChange };
  });
  useEffect(() => {
    if (filters.q === sentQ.current) return;
    sentQ.current = filters.q;
    setSearchText(filters.q);
  }, [filters.q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function search(text: string) {
    setSearchText(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      sentQ.current = text;
      const current = latest.current;
      if (text !== current.filters.q) current.onFiltersChange({ ...current.filters, q: text });
    }, SEARCH_DELAY_MS);
  }

  function clearFilters() {
    clearTimeout(timer.current);
    sentQ.current = DEFAULT_CATALOG_FILTERS.q;
    setSearchText(DEFAULT_CATALOG_FILTERS.q);
    onFiltersChange(DEFAULT_CATALOG_FILTERS);
  }

  const catalog = useInfiniteQuery({
    queryKey: [...SKILLS_QUERY_KEY, filters.scope, filters.category ?? null, filters.q],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const outcome = await api.list(filters, pageParam);
      if (outcome.ok) return outcome.data;
      throw new ReadFailure(onExpired(outcome));
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  });

  const pages = catalog.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const counts = pages.at(-1)?.counts;
  const expired = catalog.error instanceof ReadFailure && catalog.error.expired;

  // "Carregar mais" leaves the focus on the first row it added (ListPage guide).
  useEffect(() => {
    const after = pendingFocusAfter.current;
    if (after === undefined || items.length <= after) return;
    pendingFocusAfter.current = undefined;
    listRef.current?.querySelectorAll<HTMLElement>('[data-skill-id]')[after]?.focus();
  }, [items.length]);

  return (
    <ListPage.Root>
      <ListPage.Header>
        <h1>{SKILLS_MESSAGES.title}</h1>
        {counts === undefined ? null : (
          <span className="font-mono text-caption font-normal text-text-muted">{counts.total}</span>
        )}
        <Button intent="secondary" size="sm" icon={Plus} className="ml-auto">
          {SKILLS_MESSAGES.addAlias}
        </Button>
      </ListPage.Header>
      <ListPage.Filters aria-label="Filtros">
        <FilterChip
          pressed={filters.scope === 'all'}
          onClick={() => onFiltersChange({ ...filters, scope: 'all' })}
        >
          {SKILLS_MESSAGES.scopeAll}
        </FilterChip>
        <FilterChip
          pressed={filters.scope === 'private'}
          count={counts?.private}
          onClick={() => onFiltersChange({ ...filters, scope: 'private' })}
        >
          {SKILLS_MESSAGES.scopePrivate}
        </FilterChip>
        <span aria-hidden="true" className="h-4 w-px bg-border" />
        {CATEGORY_ORDER.map((category) => (
          <FilterChip
            key={category}
            pressed={filters.category === category}
            onClick={() =>
              onFiltersChange({
                ...filters,
                category: filters.category === category ? undefined : category,
              })
            }
          >
            {CATEGORY_LABELS[category]}
          </FilterChip>
        ))}
        <SearchInput
          wrapperClassName="ml-auto w-55"
          aria-label={SKILLS_MESSAGES.searchLabel}
          placeholder={SKILLS_MESSAGES.searchLabel}
          value={searchText}
          onChange={(event) => search(event.target.value)}
        />
      </ListPage.Filters>
      <ListPage.Content>
        {catalog.isError && !expired ? (
          <Alert intent="danger" className="mx-6 mt-4">
            {MESSAGES.unavailable}
          </Alert>
        ) : null}
        {catalog.isPending ? (
          <p className="px-6 py-4 text-caption text-text-muted">Carregando skills…</p>
        ) : null}
        {catalog.isSuccess && items.length === 0 ? (
          <EmptyState.Root className="mx-6 mt-4">
            <p>{SKILLS_MESSAGES.empty}</p>
            <EmptyState.Action>
              <Button intent="secondary" size="sm" onClick={clearFilters}>
                {SKILLS_MESSAGES.clearFilters}
              </Button>
            </EmptyState.Action>
          </EmptyState.Root>
        ) : null}
        {items.length > 0 ? (
          <ul ref={listRef} aria-label="Skills" className="flex flex-col">
            {items.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onPromote={() => Promise.resolve()}
                onEdit={() => undefined}
                onAliases={() => undefined}
              />
            ))}
          </ul>
        ) : null}
        {catalog.hasNextPage ? (
          <div className="px-6 py-4">
            <Button
              intent="secondary"
              disabled={catalog.isFetchingNextPage}
              onClick={() => {
                pendingFocusAfter.current = items.length;
                void catalog.fetchNextPage();
              }}
            >
              {SKILLS_MESSAGES.loadMore}
            </Button>
          </div>
        ) : null}
        <div className="px-6 py-4">
          <Alert intent="info">{SKILLS_MESSAGES.promoteInfo}</Alert>
        </div>
      </ListPage.Content>
    </ListPage.Root>
  );
}

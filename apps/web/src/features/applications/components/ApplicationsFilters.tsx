import { ACTIVE_STATUSES, CLOSED_STATUSES, type ApplicationsPage } from '@am/contracts';
import { Button, DropdownMenu, FilterChip, Icon, SearchInput } from '@am/ui';
import { ArrowUpDown, ListFilter, MapPin, Signal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_APPLICATIONS_FILTERS, type ApplicationsFilters as Filters } from '../model/filters';
import {
  LEVEL_LABELS,
  LEVEL_ORDER,
  SORT_LABELS,
  STATUS_LABELS,
  TAB_LABELS,
  WORK_MODEL_LABELS,
  WORK_MODEL_ORDER,
} from '../model/labels';
import { APPLICATIONS_MESSAGES } from '../model/messages';

/** The search waits this long after the last key before it changes the filters (APP-46). */
export const SEARCH_DELAY_MS = 300;

export interface ApplicationsFiltersProps {
  filters: Filters;
  /** The numbers of the two tabs, from the api; absent while the first page loads. */
  counts: ApplicationsPage['counts'] | undefined;
  /** Called with the new filters when a control is used or the search settles; the route puts them in the address. */
  onFiltersChange: (filters: Filters) => void;
}

interface MultiSelectProps<T extends string> {
  icon: typeof Signal;
  label: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  dashed?: boolean;
}

/**
 * A chip that opens a menu where any number of options can be on. The menu has radio items only, so each
 * option is its own one-item group: it announces `aria-checked`, draws the check, and stays open when
 * chosen so the next option can be picked.
 */
function MultiSelect<T extends string>({ icon, label, options, selected, onToggle, dashed = false }: MultiSelectProps<T>) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <FilterChip pressed={selected.length > 0} className={dashed ? 'border-dashed' : undefined}>
          <Icon icon={icon} size="sm" />
          {label}
        </FilterChip>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" aria-label={label}>
        {options.map((option) => (
          <DropdownMenu.RadioGroup key={option.value} value={selected.includes(option.value) ? option.value : ''}>
            <DropdownMenu.RadioItem
              value={option.value}
              onSelect={(event) => {
                event.preventDefault();
                onToggle(option.value);
              }}
            >
              {option.label}
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

const toggled = <T extends string>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/** The button of the topbar that alternates the order between "Última atividade" and "Cadastro" (APP-48). */
export function SortButton({ filters, onFiltersChange }: Pick<ApplicationsFiltersProps, 'filters' | 'onFiltersChange'>) {
  return (
    <Button
      intent="ghost"
      size="sm"
      icon={ArrowUpDown}
      onClick={() => onFiltersChange({ ...filters, sort: filters.sort === 'activity' ? 'created' : 'activity' })}
    >
      {SORT_LABELS[filters.sort]}
    </Button>
  );
}

/**
 * The filter row of the list (PageApplications): the two tabs with their numbers, then "Nível", "Modelo"
 * and "Filtro" (by status, only the four of the tab on screen), then the search. Which rows match is the
 * api's decision; this row only reports what the person chose (APP-46, APP-47).
 */
export function ApplicationsFilters({ filters, counts, onFiltersChange }: ApplicationsFiltersProps) {
  // The field shows what the person typed; `filters.q` follows 300 ms after the last key. `sentQ` is the
  // last text this row put in the filters, so an address that changes by itself (Limpar filtros, the back
  // button) can tell itself apart from the echo of the person's own typing.
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

  const statuses = filters.tab === 'active' ? ACTIVE_STATUSES : CLOSED_STATUSES;

  return (
    <>
      <FilterChip
        pressed={filters.tab === 'active'}
        count={counts?.active}
        onClick={() => onFiltersChange({ ...filters, tab: 'active', status: DEFAULT_APPLICATIONS_FILTERS.status })}
      >
        {TAB_LABELS.active}
      </FilterChip>
      <FilterChip
        pressed={filters.tab === 'closed'}
        count={counts?.closed}
        onClick={() => onFiltersChange({ ...filters, tab: 'closed', status: DEFAULT_APPLICATIONS_FILTERS.status })}
      >
        {TAB_LABELS.closed}
      </FilterChip>
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <MultiSelect
        icon={Signal}
        label={APPLICATIONS_MESSAGES.levelFilter}
        options={LEVEL_ORDER.map((value) => ({ value, label: LEVEL_LABELS[value] }))}
        selected={filters.level}
        onToggle={(value) => onFiltersChange({ ...filters, level: toggled(filters.level, value) })}
      />
      <MultiSelect
        icon={MapPin}
        label={APPLICATIONS_MESSAGES.workModelFilter}
        options={WORK_MODEL_ORDER.map((value) => ({ value, label: WORK_MODEL_LABELS[value] }))}
        selected={filters.workModel}
        onToggle={(value) => onFiltersChange({ ...filters, workModel: toggled(filters.workModel, value) })}
      />
      <MultiSelect
        icon={ListFilter}
        dashed
        label={APPLICATIONS_MESSAGES.statusFilter}
        options={statuses.map((value) => ({ value, label: STATUS_LABELS[value] }))}
        selected={filters.status}
        onToggle={(value) => onFiltersChange({ ...filters, status: toggled(filters.status, value) })}
      />
      <SearchInput
        wrapperClassName="ml-auto w-60"
        aria-label={APPLICATIONS_MESSAGES.searchLabel}
        placeholder={APPLICATIONS_MESSAGES.searchLabel}
        value={searchText}
        onChange={(event) => search(event.target.value)}
      />
    </>
  );
}

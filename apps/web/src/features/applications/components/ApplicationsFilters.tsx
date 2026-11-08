import type { ApplicationsPage } from '@am/contracts';
import { FilterChip, Icon, SearchInput } from '@am/ui';
import { ListFilter, MapPin, Signal } from 'lucide-react';
import type { ApplicationsFilters as Filters } from '../model/filters';
import { TAB_LABELS } from '../model/labels';
import { APPLICATIONS_MESSAGES } from '../model/messages';

export interface ApplicationsFiltersProps {
  filters: Filters;
  /** The numbers of the two tabs, from the api; absent while the first page loads. */
  counts: ApplicationsPage['counts'] | undefined;
  onFiltersChange: (filters: Filters) => void;
}

/**
 * The filter row of the list (PageApplications): the two tabs with their numbers, then "Nível", "Modelo"
 * and "Filtro", then the search. Which rows match is the api's decision; this row only holds the controls.
 */
export function ApplicationsFilters({ filters, counts, onFiltersChange }: ApplicationsFiltersProps) {
  return (
    <>
      <FilterChip
        pressed={filters.tab === 'active'}
        count={counts?.active}
        onClick={() => onFiltersChange({ ...filters, tab: 'active', status: [] })}
      >
        {TAB_LABELS.active}
      </FilterChip>
      <FilterChip
        pressed={filters.tab === 'closed'}
        count={counts?.closed}
        onClick={() => onFiltersChange({ ...filters, tab: 'closed', status: [] })}
      >
        {TAB_LABELS.closed}
      </FilterChip>
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <FilterChip pressed={filters.level.length > 0}>
        <Icon icon={Signal} size="sm" />
        {APPLICATIONS_MESSAGES.levelFilter}
      </FilterChip>
      <FilterChip pressed={filters.workModel.length > 0}>
        <Icon icon={MapPin} size="sm" />
        {APPLICATIONS_MESSAGES.workModelFilter}
      </FilterChip>
      <FilterChip pressed={filters.status.length > 0} className="border-dashed">
        <Icon icon={ListFilter} size="sm" />
        {APPLICATIONS_MESSAGES.statusFilter}
      </FilterChip>
      <SearchInput
        wrapperClassName="ml-auto w-60"
        aria-label={APPLICATIONS_MESSAGES.searchLabel}
        placeholder={APPLICATIONS_MESSAGES.searchLabel}
        defaultValue={filters.q}
      />
    </>
  );
}

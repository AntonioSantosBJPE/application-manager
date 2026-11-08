import type { ApplicationStatus } from '@am/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import { loadApplications } from '../api/server-functions';
import { ApplicationsList } from '../components/ApplicationsList';
import { DEFAULT_APPLICATIONS_FILTERS, type ApplicationsFilters } from '../model/filters';
import { listInputOf } from '../model/list-query';
import { context } from './api';
import { NOW } from './fixtures';

/** The list the way the route holds it: the filters live outside it and come back through `onFiltersChange`. */
function Harness({
  initial,
  onChange,
  onNew,
  onOpen,
  onExpired,
}: {
  initial: ApplicationsFilters;
  onChange: (filters: ApplicationsFilters) => void;
  onNew: (status?: ApplicationStatus) => void;
  onOpen: (id: string) => void;
  onExpired: (outcome: unknown) => boolean;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <ApplicationsList
      filters={filters}
      now={NOW}
      onFiltersChange={(next) => {
        onChange(next);
        setFilters(next);
      }}
      onNew={onNew}
      onOpen={onOpen}
      onExpired={onExpired}
      api={{
        list: (current, cursor) => loadApplications(listInputOf(current, cursor), context),
      }}
    />
  );
}

export function renderList(options: { filters?: ApplicationsFilters; onExpired?: (outcome: unknown) => boolean } = {}) {
  const client = new QueryClient();
  const onExpired = vi.fn(options.onExpired ?? (() => false));
  const onFiltersChange = vi.fn();
  const onNew = vi.fn();
  const onOpen = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <Harness
        initial={options.filters ?? DEFAULT_APPLICATIONS_FILTERS}
        onChange={onFiltersChange}
        onNew={onNew}
        onOpen={onOpen}
        onExpired={onExpired}
      />
    </QueryClientProvider>,
  );
  return { client, onExpired, onFiltersChange, onNew, onOpen };
}

/** The rows of every group, once the list has loaded. */
export async function rows() {
  await screen.findAllByRole('heading', { level: 2 });
  return screen.getAllByRole('listitem');
}

/** The group headings, in order, as `{ name, count }` read from the screen. */
export const groupsOnScreen = () =>
  screen.queryAllByRole('heading', { level: 2 }).map((heading) => ({
    name: heading.childNodes[1]?.textContent ?? '',
    count: heading.querySelector('.font-mono')?.textContent ?? '',
  }));

/** The row of a company. */
export const rowOf = (company: string) => screen.getByText(company).closest('li')!;

/** The companies listed under a group, in order. */
export function companiesOf(groupName: string): string[] {
  const heading = screen
    .getAllByRole('heading', { level: 2 })
    .find((candidate) => candidate.childNodes[1]?.textContent === groupName)!;
  return within(screen.getByRole('list', { name: heading.textContent ?? '' }))
    .getAllByRole('listitem')
    .map((row) => within(row).getAllByRole('link')[0]!.textContent ?? '');
}

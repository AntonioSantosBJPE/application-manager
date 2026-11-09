import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import { loadApplications, patchJobPosting, postApplication, postStatus } from '../api/server-functions';
import { ApplicationsPage, type ApplicationsPageApi } from '../components/ApplicationsPage';
import { DEFAULT_APPLICATIONS_FILTERS, type ApplicationsFilters } from '../model/filters';
import { listInputOf } from '../model/list-query';
import { context } from './api';
import { NOW } from './fixtures';
import { fakeSkillsApi } from './skills-api';

/** The page the way the route holds it: the filters live outside it and come back through `onFiltersChange`. */
function Harness({
  initial,
  api,
  onChange,
  onOpen,
  onCreated,
}: {
  initial: ApplicationsFilters;
  api: ApplicationsPageApi;
  onChange: (filters: ApplicationsFilters) => void;
  onOpen: (id: string) => void;
  onCreated: () => void;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <ApplicationsPage
      api={api}
      filters={filters}
      now={NOW}
      onFiltersChange={(next) => {
        onChange(next);
        setFilters(next);
      }}
      onOpen={onOpen}
      onCreated={onCreated}
      onExpired={() => false}
    />
  );
}

export function renderPage(options: { filters?: ApplicationsFilters } = {}) {
  const skills = fakeSkillsApi();
  const api: ApplicationsPageApi = {
    list: (current, cursor) => loadApplications(listInputOf(current, cursor), context),
    changeStatus: (id, status) => postStatus(id, { status }, context),
    changeLevel: (id, level) => patchJobPosting(id, { level }, context),
    create: (body) => postApplication(body, context),
    skills: { search: skills.search, create: skills.create },
  };
  const onFiltersChange = vi.fn();
  const onOpen = vi.fn();
  const onCreated = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness
        initial={options.filters ?? DEFAULT_APPLICATIONS_FILTERS}
        api={api}
        onChange={onFiltersChange}
        onOpen={onOpen}
        onCreated={onCreated}
      />
    </QueryClientProvider>,
  );
  return { onFiltersChange, onOpen, onCreated };
}

import type { ApplicationStatus, ApplicationsSort, ApplicationsTab, JobLevel, WorkModel } from '@am/contracts';
import {
  SEARCH_MAX_LENGTH,
  applicationStatusSchema,
  applicationsSortSchema,
  applicationsTabSchema,
  jobLevelSchema,
  workModelSchema,
} from '@am/contracts';
import type { z } from 'zod';

/** What the list shows: the tab, the three multi-select filters, the search text and the order (APP-46). */
export interface ApplicationsFilters {
  tab: ApplicationsTab;
  status: ApplicationStatus[];
  level: JobLevel[];
  workModel: WorkModel[];
  q: string;
  sort: ApplicationsSort;
  /** `new=1`: the page opens with the create dialog (APP-83). */
  newApplication: boolean;
}

export const DEFAULT_APPLICATIONS_FILTERS: ApplicationsFilters = {
  tab: 'active',
  status: [],
  level: [],
  workModel: [],
  q: '',
  sort: 'activity',
  newApplication: false,
};

/** The URL carries only what differs from the default; the lists are comma separated. */
export interface ApplicationsSearch {
  tab?: ApplicationsTab;
  status?: string;
  level?: string;
  workModel?: string;
  q?: string;
  sort?: ApplicationsSort;
  new?: 1;
}

/** A comma separated list: the values that are not valid are left out, and a value given twice counts once. */
function listOf<T extends string>(value: unknown, schema: z.ZodType<T>): T[] {
  if (typeof value !== 'string') return [];
  const items: T[] = [];
  for (const part of value.split(',')) {
    const item = schema.safeParse(part);
    if (item.success && !items.includes(item.data)) items.push(item.data);
  }
  return items;
}

/**
 * Reads the filters out of the URL. The router hands over whatever the address held, parsed as json,
 * so `q=7` arrives as a number and `new=1` as the number 1; every value that is not valid falls back
 * to the default instead of failing the page (APP-46).
 */
export function parseApplicationsSearch(raw: object): ApplicationsFilters {
  const given = raw as Record<string, unknown>;
  const tab = applicationsTabSchema.safeParse(given.tab);
  const sort = applicationsSortSchema.safeParse(given.sort);
  const text = typeof given.q === 'number' && Number.isFinite(given.q) ? String(given.q) : given.q;
  return {
    tab: tab.success ? tab.data : DEFAULT_APPLICATIONS_FILTERS.tab,
    status: listOf(given.status, applicationStatusSchema),
    level: listOf(given.level, jobLevelSchema),
    workModel: listOf(given.workModel, workModelSchema),
    q: typeof text === 'string' && text.length <= SEARCH_MAX_LENGTH ? text : DEFAULT_APPLICATIONS_FILTERS.q,
    sort: sort.success ? sort.data : DEFAULT_APPLICATIONS_FILTERS.sort,
    newApplication: given.new === 1 || given.new === '1',
  };
}

/** The URL search of some filters: the default of each one is left out. */
export function searchOf(filters: ApplicationsFilters): ApplicationsSearch {
  const search: ApplicationsSearch = {};
  if (filters.tab !== DEFAULT_APPLICATIONS_FILTERS.tab) search.tab = filters.tab;
  if (filters.status.length > 0) search.status = filters.status.join(',');
  if (filters.level.length > 0) search.level = filters.level.join(',');
  if (filters.workModel.length > 0) search.workModel = filters.workModel.join(',');
  if (filters.q !== DEFAULT_APPLICATIONS_FILTERS.q) search.q = filters.q;
  if (filters.sort !== DEFAULT_APPLICATIONS_FILTERS.sort) search.sort = filters.sort;
  if (filters.newApplication) search.new = 1;
  return search;
}

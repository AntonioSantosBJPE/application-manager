import type { ListApplicationsInput } from '../api/server-functions';
import type { ApplicationsFilters } from './filters';

/**
 * What the list asks the api for: the filters of the address as the query the contract reads (lists
 * comma separated, a default left out) and the cursor of the page. The api filters, searches and orders;
 * the web only asks (APP-46).
 */
export function listInputOf(filters: ApplicationsFilters, cursor?: string): ListApplicationsInput {
  const input: ListApplicationsInput = { tab: filters.tab, sort: filters.sort };
  if (filters.status.length > 0) input.status = filters.status.join(',');
  if (filters.level.length > 0) input.level = filters.level.join(',');
  if (filters.workModel.length > 0) input.workModel = filters.workModel.join(',');
  if (filters.q !== '') input.q = filters.q;
  if (cursor !== undefined) input.cursor = cursor;
  return input;
}

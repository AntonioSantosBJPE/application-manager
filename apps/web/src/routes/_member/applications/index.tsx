import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  ApplicationsPage,
  changeStatus,
  createApplication,
  listApplications,
  listInputOf,
  parseApplicationsSearch,
  searchOf,
  updateJobPosting,
  type ApplicationsPageApi,
} from '../../../features/applications';
import { useExpiredSessionRedirect } from '../../../features/identity';
import { createSkill, searchSkills } from '../../../features/skills';

/** The server functions the page uses; module level, so the skills fields get the same api on every render. */
const api: ApplicationsPageApi = {
  list: (filters, cursor) => listApplications({ data: listInputOf(filters, cursor) }),
  changeStatus: (id, status) => changeStatus({ data: { id, body: { status } } }),
  changeLevel: (id, level) => updateJobPosting({ data: { id, body: { level } } }),
  create: (body) => createApplication({ data: body }),
  skills: {
    search: (q) => searchSkills({ data: { q } }),
    create: (body) => createSkill({ data: body }),
  },
};

/**
 * The applications list of the member: grouped by status, with the filters in the address (APP-46).
 * The loader takes `now` once, so "hoje" and "há N d" read the same on the server render and in the
 * browser.
 */
export const Route = createFileRoute('/_member/applications/')({
  validateSearch: (raw) => searchOf(parseApplicationsSearch(raw)),
  loader: () => ({ now: new Date().toISOString() }),
  component: ApplicationsRoute,
});

function ApplicationsRoute() {
  const onExpired = useExpiredSessionRedirect();
  const router = useRouter();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { now } = Route.useLoaderData();

  return (
    <ApplicationsPage
      api={api}
      filters={parseApplicationsSearch(search)}
      now={new Date(now)}
      onFiltersChange={(filters) => void navigate({ search: searchOf(filters) })}
      onOpen={(id) => void navigate({ to: '/applications/$id', params: { id } })}
      onCreated={() => void router.invalidate()}
      onExpired={onExpired}
    />
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  APPLICATIONS_QUERY_KEY,
  ApplicationDetail,
  ApplicationNotFound,
  addEvent,
  changeStatus,
  deleteApplication,
  getApplication,
  replaceSkills,
  snoozeGhost,
  updateJobPosting,
  type ApplicationDetailApi,
} from '../../../features/applications';
import { UnavailableScreen, useExpiredSessionRedirect } from '../../../features/identity';
import { createSkill, searchSkills } from '../../../features/skills';

/** The server functions the detail uses; module level, so the skills field gets the same api on every render. */
const api: ApplicationDetailApi = {
  load: (id) => getApplication({ data: id }),
  addEvent: (id, body) => addEvent({ data: { id, body } }),
  changeStatus: (id, status) => changeStatus({ data: { id, body: { status } } }),
  updatePosting: (id, body) => updateJobPosting({ data: { id, body } }),
  replaceSkills: (id, body) => replaceSkills({ data: { id, body } }),
  snooze: (id) => snoozeGhost({ data: id }),
  remove: (id) => deleteApplication({ data: id }),
  skills: {
    search: (q) => searchSkills({ data: { q } }),
    create: (body) => createSkill({ data: body }),
  },
};

/**
 * The detail of an application (APP-66, APP-77). The loader reads the detail and takes `now` once, so
 * "hoje" and the days of the suggestion read the same on the server render and in the browser. A `404`
 * (missing or someone else's) is the not found screen; a `401` opens the login with the page preserved.
 */
export const Route = createFileRoute('/_member/applications/$id')({
  loader: async ({ params }) => ({
    now: new Date().toISOString(),
    outcome: await getApplication({ data: params.id }),
  }),
  component: ApplicationRoute,
});

function ApplicationRoute() {
  const { now, outcome } = Route.useLoaderData();
  const onExpired = useExpiredSessionRedirect();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const expired = !outcome.ok && outcome.status === 401;

  useEffect(() => {
    if (expired) onExpired(outcome);
  }, [expired, onExpired, outcome]);

  const openList = () => void navigate({ to: '/applications' });

  if (outcome.ok) {
    return (
      <ApplicationDetail
        application={outcome.data}
        now={new Date(now)}
        api={api}
        onExpired={onExpired}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY })}
        onDeleted={() => {
          // The total of the sidebar changed with the deletion.
          void router.invalidate();
          openList();
        }}
        onOpenList={openList}
      />
    );
  }
  if (outcome.status === 404) return <ApplicationNotFound onOpenList={openList} />;
  return expired ? null : <UnavailableScreen />;
}

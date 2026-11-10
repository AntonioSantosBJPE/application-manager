import { createFileRoute } from '@tanstack/react-router';
import { useExpiredSessionRedirect } from '../../features/identity';
import { getResume, parseSection, ResumePage, resumeSearchOf, type ResumePageApi } from '../../features/resume';

/** The server function the page uses; module level, so the page gets the same api on every render. */
const api: ResumePageApi = { load: () => getResume() };

/**
 * The master resume, one section at a time with `section` in the address (RES-35, RES-36). The loader
 * answers with the outcome of `GET /resume` and nothing else (Data Reads): the page shows all of it.
 */
export const Route = createFileRoute('/_member/resume')({
  validateSearch: resumeSearchOf,
  loader: () => getResume(),
  component: ResumeRoute,
});

function ResumeRoute() {
  const outcome = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onExpired = useExpiredSessionRedirect();

  return (
    <ResumePage
      outcome={outcome}
      section={parseSection(search.section)}
      api={api}
      onSectionChange={(section) => void navigate({ search: { section } })}
      onExpired={onExpired}
    />
  );
}

import {
  ACTIVE_STATUSES,
  FUNNEL_ORDER,
  normalizeSkillKey,
  type ApplicationDetail,
  type ApplicationStatus,
  type ApplicationSummary,
  type ApplicationsPage,
  type CreateApplicationRequest,
  type JobLevel,
} from '@am/contracts';
import { http, HttpResponse } from 'msw';
import type { SetupServer } from 'msw/node';
import { apiInternalUrl, problem } from './api';
import { NOW, uuid } from './fixtures';

const isActive = (status: ApplicationStatus) => (ACTIVE_STATUSES as readonly string[]).includes(status);
const listOf = (value: string | null) => (value === null || value === '' ? [] : value.split(','));

/** The summary the api would send back for a detail; the fake keeps summaries only. */
function detailOf(item: ApplicationSummary): ApplicationDetail {
  return {
    ...item,
    url: null,
    location: null,
    description: null,
    skills: item.skills.map((skill) => ({ ...skill, category: 'tool' as const })),
    events: [],
  };
}

export interface FakeApplicationsOptions {
  pageSize?: number;
  /** The names `POST /applications` answers for the skill ids it receives. */
  skillNames?: Record<string, string>;
}

/**
 * The applications api as the list sees it, with state: it filters by tab, status, level, work model and
 * search text, orders by group (the funnel) and then by the asked sort, pages with a cursor, counts the
 * way the real api does (respecting level, work model and search; ignoring tab and status) and applies
 * status, level and create calls so the screen reads back what it changed. `calls` lists every request,
 * in order, as `METHOD /path?query`. `hold(name)` keeps an answer until the returned function runs and
 * `fail(name, status)` makes the next call of an endpoint answer with that error.
 */
export function fakeApplications(server: SetupServer, initial: ApplicationSummary[], options: FakeApplicationsOptions = {}) {
  const pageSize = options.pageSize ?? 50;
  const items = initial.map((item) => ({ ...item }));
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const holds = new Map<string, Promise<void>>();
  const failures = new Map<string, number>();
  let nextId = 900;

  const waitFor = async (name: string) => {
    await holds.get(name);
  };
  const failed = (name: string) => {
    const status = failures.get(name);
    if (status === undefined) return undefined;
    failures.delete(name);
    return problem(status);
  };

  const matches = (item: ApplicationSummary, key: string) =>
    key === '' ||
    normalizeSkillKey(item.company).includes(key) ||
    normalizeSkillKey(item.title).includes(key) ||
    item.skills.some((skill) => normalizeSkillKey(skill.name).includes(key));

  server.use(
    http.get(`${apiInternalUrl}/applications/count`, ({ request }) => {
      const url = new URL(request.url);
      calls.push(`GET ${url.pathname}${url.search}`);
      return HttpResponse.json({ total: items.length });
    }),
    http.get(`${apiInternalUrl}/applications`, async ({ request }) => {
      const url = new URL(request.url);
      calls.push(`GET ${url.pathname}${url.search}`);
      await waitFor('list');
      const error = failed('list');
      if (error !== undefined) return error;
      const tab = url.searchParams.get('tab') ?? 'active';
      const sort = url.searchParams.get('sort') ?? 'activity';
      const statuses = listOf(url.searchParams.get('status'));
      const levels = listOf(url.searchParams.get('level'));
      const workModels = listOf(url.searchParams.get('workModel'));
      const key = normalizeSkillKey(url.searchParams.get('q') ?? '');
      const cursor = url.searchParams.get('cursor');

      const counted = items.filter(
        (item) =>
          (levels.length === 0 || levels.includes(item.level)) &&
          (workModels.length === 0 || (item.workModel !== null && workModels.includes(item.workModel))) &&
          matches(item, key),
      );
      const found = counted
        .filter(
          (item) =>
            (tab === 'active') === isActive(item.status) && (statuses.length === 0 || statuses.includes(item.status)),
        )
        .sort((a, b) => {
          const byGroup = FUNNEL_ORDER.indexOf(a.status) - FUNNEL_ORDER.indexOf(b.status);
          if (byGroup !== 0) return byGroup;
          const field = sort === 'created' ? 'createdAt' : 'lastActivityAt';
          return b[field].localeCompare(a[field]);
        });
      const start = cursor === null ? 0 : found.findIndex((item) => item.id === cursor) + 1;
      const page = found.slice(start, start + pageSize);
      const byStatus = Object.fromEntries(
        FUNNEL_ORDER.map((status) => [status, counted.filter((item) => item.status === status).length]),
      ) as ApplicationsPage['counts']['byStatus'];
      const body: ApplicationsPage = {
        items: page,
        nextCursor: start + pageSize < found.length ? page[page.length - 1]!.id : null,
        counts: {
          active: counted.filter((item) => isActive(item.status)).length,
          closed: counted.filter((item) => !isActive(item.status)).length,
          byStatus,
        },
      };
      return HttpResponse.json(body);
    }),
    http.post(`${apiInternalUrl}/applications/:id/status`, async ({ params, request }) => {
      const body = (await request.json()) as { status: ApplicationStatus };
      calls.push(`POST /applications/${String(params.id)}/status ${JSON.stringify(body)}`);
      await waitFor('status');
      const error = failed('status');
      if (error !== undefined) return error;
      const item = items.find((candidate) => candidate.id === params.id);
      if (item === undefined) return problem(404);
      if (item.status !== body.status) {
        item.status = body.status;
        item.lastActivityAt = NOW.toISOString();
      }
      return HttpResponse.json(detailOf(item));
    }),
    http.patch(`${apiInternalUrl}/applications/:id/job-posting`, async ({ params, request }) => {
      const body = (await request.json()) as { level?: JobLevel };
      calls.push(`PATCH /applications/${String(params.id)}/job-posting ${JSON.stringify(body)}`);
      await waitFor('level');
      const error = failed('level');
      if (error !== undefined) return error;
      const item = items.find((candidate) => candidate.id === params.id);
      if (item === undefined) return problem(404);
      if (body.level !== undefined) item.level = body.level;
      return HttpResponse.json(detailOf(item));
    }),
    http.post(`${apiInternalUrl}/applications`, async ({ request }) => {
      const body = (await request.json()) as CreateApplicationRequest;
      calls.push(`POST /applications`);
      bodies.push(body);
      await waitFor('create');
      const error = failed('create');
      if (error !== undefined) return error;
      const created: ApplicationSummary = {
        id: uuid(nextId++),
        status: body.status ?? 'saved',
        company: body.jobPosting.company,
        title: body.jobPosting.title,
        level: body.jobPosting.level,
        workModel: body.jobPosting.workModel ?? null,
        skills: (body.skills ?? []).map((skill) => ({
          id: skill.skillId,
          name: options.skillNames?.[skill.skillId] ?? skill.skillId,
          scope: 'global' as const,
          requirement: skill.requirement,
        })),
        createdAt: NOW.toISOString(),
        lastActivityAt: NOW.toISOString(),
        ghostSuggested: false,
      };
      items.push(created);
      return HttpResponse.json(detailOf(created), { status: 201 });
    }),
  );

  return {
    calls,
    /** The bodies of `POST /applications`, as the api received them. */
    bodies,
    items,
    /** Calls of one endpoint, such as `callsTo('POST', '/status')`. */
    callsTo: (method: string, part: string) => calls.filter((call) => call.startsWith(method) && call.includes(part)),
    hold(name: 'list' | 'status' | 'level' | 'create'): () => void {
      let release: () => void = () => undefined;
      holds.set(
        name,
        new Promise<void>((resolve) => {
          release = () => {
            holds.delete(name);
            resolve();
          };
        }),
      );
      return release;
    },
    /** The next call of the endpoint answers with this status as Problem Details. */
    fail(name: 'list' | 'status' | 'level' | 'create', status: number) {
      failures.set(name, status);
    },
  };
}

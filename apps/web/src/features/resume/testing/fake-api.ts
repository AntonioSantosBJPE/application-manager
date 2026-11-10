import type { MasterResume, ResumeSection } from '@am/contracts';
import { http, HttpResponse } from 'msw';
import type { SetupServer } from 'msw/node';
import { apiInternalUrl, problem } from './api';

type Failure = { status: number; detail?: string } | 'network';

/**
 * The resume api as the screens see it, with state: it answers `GET /resume` with what it holds and applies
 * the order calls the way the real api does (the whole set of ids or a `400`), so the screen reads back what
 * it changed. `calls` lists every request, in order, as `METHOD /path`; `bodies` holds the bodies in the same
 * order. `fail(name, how)` makes the next call of an endpoint answer with that error (or fail on the network)
 * and `hold(name)` keeps an answer until the returned function runs. `state` is what the api holds, so a test
 * can change it behind the screen's back.
 */
export function fakeResume(server: SetupServer, initial: MasterResume) {
  const state = { resume: structuredClone(initial) };
  const calls: string[] = [];
  const bodies: unknown[] = [];
  let created = 0;
  let createdBullets = 0;
  /** The dictionary entries of the skills a bullet cites, from what the api holds (the cited skills only, once each). */
  const skillsOf = (ids: string[]) =>
    Object.fromEntries(ids.flatMap((id) => (state.resume.skills[id] === undefined ? [] : [[id, state.resume.skills[id]]])));
  // What the api stores for an optional field the create body left out.
  const defaults: Record<ResumeSection, Record<string, unknown>> = {
    experiences: { location: null, endDate: null },
    projects: { url: null, description: null },
    educations: { endDate: null },
    certifications: { issuer: null, issuedOn: null, url: null },
    languages: {},
  };
  const holds = new Map<string, Promise<void>>();
  const failures = new Map<string, Failure>();

  const waitFor = async (name: string) => {
    await holds.get(name);
  };
  const failed = (name: string) => {
    const failure = failures.get(name);
    if (failure === undefined) return undefined;
    failures.delete(name);
    return failure === 'network' ? HttpResponse.error() : problem(failure.status, failure.detail);
  };
  const sameSet = (sent: string[], held: string[]) =>
    sent.length === held.length && new Set(sent).size === sent.length && sent.every((id) => held.includes(id));

  server.use(
    http.get(`${apiInternalUrl}/resume`, async () => {
      calls.push('GET /resume');
      await waitFor('load');
      return failed('load') ?? HttpResponse.json(state.resume);
    }),
    http.put(`${apiInternalUrl}/resume/profile`, async ({ request }) => {
      calls.push('PUT /resume/profile');
      const body = (await request.json()) as MasterResume['profile'];
      bodies.push(body);
      await waitFor('profile');
      const failure = failed('profile');
      if (failure !== undefined) return failure;
      state.resume.profile = body;
      return HttpResponse.json(body);
    }),
    http.post(`${apiInternalUrl}/resume/:section`, async ({ params, request }) => {
      const section = params.section as ResumeSection;
      calls.push(`POST /resume/${section}`);
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      await waitFor('create');
      const failure = failed('create');
      if (failure !== undefined) return failure;
      const item = { id: `0190a5b4-7c3a-7c8e-9f2a-${String(900 + ++created).padStart(12, '0')}`, ...defaults[section], ...body };
      const stored = section === 'experiences' || section === 'projects' ? { ...item, bullets: [] } : item;
      (state.resume[section] as unknown[]).unshift(stored);
      return HttpResponse.json(item, { status: 201 });
    }),
    http.patch(`${apiInternalUrl}/resume/:section/:id`, async ({ params, request }) => {
      const section = params.section as ResumeSection;
      calls.push(`PATCH /resume/${section}/${String(params.id)}`);
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      await waitFor('update');
      const failure = failed('update');
      if (failure !== undefined) return failure;
      const items = state.resume[section] as { id: string; bullets?: unknown }[];
      const item = items.find((candidate) => candidate.id === params.id);
      if (item === undefined) return problem(404);
      Object.assign(item, body);
      // The api answers an item without its bullets (AD-028).
      return HttpResponse.json(Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'bullets')));
    }),
    http.delete(`${apiInternalUrl}/resume/:section/:id`, async ({ params }) => {
      const section = params.section as ResumeSection;
      calls.push(`DELETE /resume/${section}/${String(params.id)}`);
      await waitFor('delete');
      const failure = failed('delete');
      if (failure !== undefined) return failure;
      const items = state.resume[section] as { id: string }[];
      const at = items.findIndex((candidate) => candidate.id === params.id);
      if (at === -1) return problem(404);
      items.splice(at, 1);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${apiInternalUrl}/resume/:section/:id/bullets`, async ({ params, request }) => {
      calls.push(`POST /resume/${String(params.section)}/${String(params.id)}/bullets`);
      const body = (await request.json()) as { text: string; skillIds: string[] };
      bodies.push(body);
      await waitFor('bullet');
      const failure = failed('bullet');
      if (failure !== undefined) return failure;
      const item = state.resume[params.section as 'experiences' | 'projects'].find((candidate) => candidate.id === params.id);
      if (item === undefined) return problem(404);
      const bullet = { id: `0190a5b4-7c3a-7c8e-9f2a-${String(1000 + ++createdBullets).padStart(12, '0')}`, ...body };
      item.bullets.push(bullet);
      return HttpResponse.json({ bullet, skills: skillsOf(bullet.skillIds) }, { status: 201 });
    }),
    http.patch(`${apiInternalUrl}/resume/:section/:id/bullets/:bulletId`, async ({ params, request }) => {
      calls.push(`PATCH /resume/${String(params.section)}/${String(params.id)}/bullets/${String(params.bulletId)}`);
      const body = (await request.json()) as { text?: string; skillIds?: string[] };
      bodies.push(body);
      await waitFor('bullet');
      const failure = failed('bullet');
      if (failure !== undefined) return failure;
      const item = state.resume[params.section as 'experiences' | 'projects'].find((candidate) => candidate.id === params.id);
      const bullet = item?.bullets.find((candidate) => candidate.id === params.bulletId);
      if (bullet === undefined) return problem(404);
      Object.assign(bullet, body);
      return HttpResponse.json({ bullet, skills: skillsOf(bullet.skillIds) });
    }),
    http.delete(`${apiInternalUrl}/resume/:section/:id/bullets/:bulletId`, async ({ params }) => {
      calls.push(`DELETE /resume/${String(params.section)}/${String(params.id)}/bullets/${String(params.bulletId)}`);
      await waitFor('bullet');
      const failure = failed('bullet');
      if (failure !== undefined) return failure;
      const item = state.resume[params.section as 'experiences' | 'projects'].find((candidate) => candidate.id === params.id);
      const at = item?.bullets.findIndex((candidate) => candidate.id === params.bulletId) ?? -1;
      if (item === undefined || at === -1) return problem(404);
      item.bullets.splice(at, 1);
      return new HttpResponse(null, { status: 204 });
    }),
    http.put(`${apiInternalUrl}/resume/:section/order`, async ({ params, request }) => {
      calls.push(`PUT /resume/${String(params.section)}/order`);
      const body = (await request.json()) as { ids: string[] };
      bodies.push(body);
      await waitFor('order');
      const failure = failed('order');
      if (failure !== undefined) return failure;
      const section = params.section as Exclude<ResumeSection, never>;
      const items = state.resume[section] as { id: string }[];
      if (!sameSet(body.ids, items.map((item) => item.id))) return problem(400, 'The order must list every id once');
      (state.resume[section] as { id: string }[]) = body.ids.map((id) => items.find((item) => item.id === id)!);
      return HttpResponse.json({ ids: body.ids });
    }),
    http.put(`${apiInternalUrl}/resume/:section/:id/bullets/order`, async ({ params, request }) => {
      calls.push(`PUT /resume/${String(params.section)}/${String(params.id)}/bullets/order`);
      const body = (await request.json()) as { ids: string[] };
      bodies.push(body);
      await waitFor('order');
      const failure = failed('order');
      if (failure !== undefined) return failure;
      const items = state.resume[params.section as 'experiences' | 'projects'];
      const item = items.find((candidate) => candidate.id === params.id);
      if (item === undefined) return problem(404);
      if (!sameSet(body.ids, item.bullets.map((bullet) => bullet.id))) return problem(400, 'The order must list every id once');
      item.bullets = body.ids.map((id) => item.bullets.find((bullet) => bullet.id === id)!);
      return HttpResponse.json({ ids: body.ids });
    }),
  );

  return {
    state,
    calls,
    bodies,
    fail: (name: 'load' | 'order' | 'profile' | 'create' | 'update' | 'delete' | 'bullet', how: Failure) => failures.set(name, how),
    hold(name: 'load' | 'order' | 'profile' | 'create' | 'update' | 'delete' | 'bullet') {
      let release = () => {};
      holds.set(name, new Promise<void>((resolve) => (release = resolve)));
      return () => {
        holds.delete(name);
        release();
      };
    },
  };
}

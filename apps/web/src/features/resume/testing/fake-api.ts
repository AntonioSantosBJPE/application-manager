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
    fail: (name: 'load' | 'order', how: Failure) => failures.set(name, how),
    hold(name: 'load' | 'order') {
      let release = () => {};
      holds.set(name, new Promise<void>((resolve) => (release = resolve)));
      return () => {
        holds.delete(name);
        release();
      };
    },
  };
}

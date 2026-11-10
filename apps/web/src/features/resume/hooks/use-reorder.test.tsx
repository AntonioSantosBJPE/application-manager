// @vitest-environment jsdom
import type { MasterResume } from '@am/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadResume, putBulletsOrder, putItemsOrder } from '../api/server-functions';
import { context } from '../testing/api';
import { fakeResume } from '../testing/fake-api';
import { bullet, experience, masterResume, project, skillsOf } from '../testing/fixtures';
import { RESUME_QUERY_KEY } from './resume-query-key';
import { type ReorderApi, useReorder } from './use-reorder';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The reorder api bound to the BFF functions, so a test talks to the fake api through MSW. */
const api: ReorderApi = {
  orderItems: (section, ids) => putItemsOrder(section, ids, context),
  orderBullets: (section, itemId, ids) => putBulletsOrder(section, itemId, ids, context),
  load: () => loadResume(context),
};

const a = experience(1, { bullets: [bullet(1), bullet(2), bullet(3)] });
const b = experience(2);
const c = experience(3);
const initial = (): MasterResume => masterResume({ experiences: [a, b, c], projects: [project(1), project(2)], skills: skillsOf(1) });

function setup(section: 'experiences' | 'projects', parentId?: string) {
  const fake = fakeResume(server, initial());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(RESUME_QUERY_KEY, initial());
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useReorder(section, parentId, api), { wrapper });
  const cached = () => client.getQueryData<MasterResume>(RESUME_QUERY_KEY)!;
  return { fake, client, cached, ...hook };
}

const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe('useReorder', () => {
  it('RES-74 shows the new order of the items at once, sends every id and keeps the order when the api accepts it', async () => {
    const { result, cached, fake } = setup('experiences');
    const next = [c.id, a.id, b.id];

    await act(async () => {
      await result.current.reorder(next);
    });

    expect(ids(cached().experiences)).toEqual(next);
    expect(fake.calls).toEqual(['PUT /resume/experiences/order']);
    expect(fake.bodies).toEqual([{ ids: next }]);
    expect(result.current.error).toBeNull();
  });

  it('RES-74 puts the new order in the cache before the api answers', async () => {
    const { result, cached, fake } = setup('experiences');
    const release = fake.hold('order');
    const next = [b.id, c.id, a.id];

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.reorder(next);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(ids(cached().experiences)).toEqual(next);
    await act(async () => {
      release();
      await pending;
    });
    expect(ids(cached().experiences)).toEqual(next);
  });

  it('RES-74 orders the bullets of one item and leaves the other lists alone', async () => {
    const { result, cached, fake } = setup('experiences', a.id);
    const [one, two, three] = a.bullets;
    const next = [three!.id, one!.id, two!.id];

    await act(async () => {
      await result.current.reorder(next);
    });

    expect(ids(cached().experiences[0]!.bullets)).toEqual(next);
    expect(ids(cached().experiences)).toEqual([a.id, b.id, c.id]);
    expect(fake.calls).toEqual([`PUT /resume/experiences/${a.id}/bullets/order`]);
    expect(fake.bodies).toEqual([{ ids: next }]);
  });

  it('RES-74 orders the items of the projects section without touching the experiences', async () => {
    const { result, cached } = setup('projects');
    const [one, two] = initial().projects;

    await act(async () => {
      await result.current.reorder([two!.id, one!.id]);
    });

    expect(ids(cached().projects)).toEqual([two!.id, one!.id]);
    expect(ids(cached().experiences)).toEqual([a.id, b.id, c.id]);
  });

  it('RES-74 goes back to the previous order and says it could not save when the network fails', async () => {
    const { result, cached, fake } = setup('experiences');
    fake.fail('order', 'network');

    await act(async () => {
      await result.current.reorder([c.id, b.id, a.id]);
    });

    expect(ids(cached().experiences)).toEqual([a.id, b.id, c.id]);
    expect(result.current.error).toBe('Não foi possível salvar a nova ordem.');
  });

  it('RES-74 goes back to the previous order and says it for a 500 too', async () => {
    const { result, cached, fake } = setup('experiences', a.id);
    fake.fail('order', { status: 500 });
    const before = ids(cached().experiences[0]!.bullets);

    await act(async () => {
      await result.current.reorder([...before].reverse());
    });

    expect(ids(cached().experiences[0]!.bullets)).toEqual(before);
    expect(result.current.error).toBe('Não foi possível salvar a nova ordem.');
  });

  it('RES-74 clears the message when the next reorder starts', async () => {
    const { result, fake } = setup('experiences');
    fake.fail('order', 'network');
    await act(async () => {
      await result.current.reorder([c.id, b.id, a.id]);
    });
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.reorder([b.id, a.id, c.id]);
    });

    expect(result.current.error).toBeNull();
  });

  it('RES-74 answers with the failure so the caller can see a 401', async () => {
    const { result, fake } = setup('experiences');
    fake.fail('order', { status: 401 });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.reorder([c.id, b.id, a.id]);
    });

    expect(outcome).toMatchObject({ ok: false, status: 401 });
  });

  it('RES-75 reads the resume again on a 400 and shows the order the api holds', async () => {
    const { result, cached, fake } = setup('experiences');
    // Another tab reordered: the api holds b, c, a while this screen showed a, b, c.
    fake.state.resume.experiences = [b, c, a];
    fake.fail('order', { status: 400, detail: 'The order must list every id once' });

    await act(async () => {
      await result.current.reorder([c.id, b.id, a.id]);
    });

    expect(fake.calls).toEqual(['PUT /resume/experiences/order', 'GET /resume']);
    expect(ids(cached().experiences)).toEqual([b.id, c.id, a.id]);
    expect(result.current.error).toBeNull();
  });

  it('RES-75 reads the resume again when the api refuses an order that lacks an item created elsewhere', async () => {
    const { result, cached, fake } = setup('experiences');
    const created = experience(4);
    fake.state.resume.experiences = [created, a, b, c];

    await act(async () => {
      await result.current.reorder([c.id, a.id, b.id]);
    });

    expect(fake.calls).toEqual(['PUT /resume/experiences/order', 'GET /resume']);
    expect(ids(cached().experiences)).toEqual([created.id, a.id, b.id, c.id]);
  });

  it('RES-75 goes back to the previous order and says it when the read after a 400 fails too', async () => {
    const { result, cached, fake } = setup('experiences');
    fake.fail('order', { status: 400 });
    fake.fail('load', { status: 503 });

    await act(async () => {
      await result.current.reorder([c.id, b.id, a.id]);
    });

    expect(ids(cached().experiences)).toEqual([a.id, b.id, c.id]);
    expect(result.current.error).toBe('Não foi possível salvar a nova ordem.');
  });
});

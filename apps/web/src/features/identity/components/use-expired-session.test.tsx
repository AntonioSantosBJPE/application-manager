// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Outcome } from '../api/server-functions';
import { useExpiredSessionRedirect } from './use-expired-session';

// jsdom has no scrolling; the router asks for it on every navigation.
beforeAll(() => {
  window.scrollTo = () => undefined;
});

/** A page with one action that comes back with the given outcome, in a router that has both logins. */
function open(url: string, outcome: Outcome<unknown>) {
  const root = createRootRoute();
  function Action() {
    const redirectIfExpired = useExpiredSessionRedirect();
    return (
      <button type="button" onClick={() => redirectIfExpired(outcome)}>
        Agir
      </button>
    );
  }
  const loginSearch = (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    reason: typeof search.reason === 'string' ? search.reason : undefined,
  });
  const routes = [
    createRoute({ getParentRoute: () => root, path: '/admin/invitations', component: Action }),
    createRoute({ getParentRoute: () => root, path: '/something', component: Action }),
    createRoute({
      getParentRoute: () => root,
      path: '/admin/login',
      validateSearch: loginSearch,
      component: () => <p>admin login</p>,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/login',
      validateSearch: loginSearch,
      component: () => <p>member login</p>,
    }),
  ];
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

const expired: Outcome<unknown> = { ok: false, status: 401 };

describe('useExpiredSessionRedirect', () => {
  it('opens the admin login with the route and the expired reason after a 401 in the admin area', async () => {
    const router = open('/admin/invitations?x=1', expired);

    fireEvent.click(await screen.findByRole('button', { name: 'Agir' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'));
    expect(router.state.location.search).toEqual({
      redirect: '/admin/invitations?x=1',
      reason: 'expired',
    });
  });

  it('opens the member login after a 401 in the member area', async () => {
    const router = open('/something', expired);

    fireEvent.click(await screen.findByRole('button', { name: 'Agir' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ redirect: '/something', reason: 'expired' });
  });

  it.each<[string, Outcome<unknown>]>([
    ['a 403', { ok: false, status: 403 }],
    ['a 503', { ok: false, status: 503 }],
    ['a success', { ok: true, data: undefined }],
  ])('stays on the page after %s', async (_name, outcome) => {
    const router = open('/admin/invitations', outcome);

    fireEvent.click(await screen.findByRole('button', { name: 'Agir' }));

    await Promise.resolve();
    expect(router.state.location.pathname).toBe('/admin/invitations');
  });
});

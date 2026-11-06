import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  // One client per router, never a module singleton: a client shared between requests would leak
  // one person's session data into another person's page during SSR.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // Cached data is the query cache's business; the loader would otherwise hold a second, staler copy.
    defaultPreloadStaleTime: 0,
    context: { queryClient },
  });

  // Dehydrates what the server loaded and hydrates it in the browser, so the first render after a
  // navigation does not refetch, and `redirect()` thrown by a query is handled (UI-06, UI-13).
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

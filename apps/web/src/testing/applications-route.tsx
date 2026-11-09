import type { ApplicationSummary, MeResponse } from '@am/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { routeTree } from '../routeTree.gen';

/** What the route tests of the applications screens share; the mocks themselves stay in each test file. */
export const member: MeResponse = {
  id: '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60',
  email: 'ana@example.test',
  name: 'Ana Souza',
  role: 'member',
};

export const counts = {
  active: 1,
  closed: 0,
  byStatus: { saved: 0, applied: 1, interviewing: 0, offer: 0, accepted: 0, rejected: 0, withdrawn: 0, ghosted: 0 },
};

export const summary: ApplicationSummary = {
  id: '0190a5b4-7c3a-7c8e-9f2a-000000000001',
  status: 'applied',
  company: 'Empresa Fictícia Alfa',
  title: 'Vaga de Teste Pleno',
  level: 'mid',
  workModel: 'remote',
  skills: [],
  createdAt: '2026-11-01T12:00:00.000Z',
  lastActivityAt: '2026-11-07T12:00:00.000Z',
  ghostSuggested: false,
};

export const pageOf = (items: ApplicationSummary[], byStatus = counts.byStatus) => ({
  items,
  nextCursor: null,
  counts: { ...counts, active: items.length, byStatus },
});

/** Opens the route tree at a url, with the query client the app provides around the router. */
export async function openApplications(url: string) {
  const queryClient = new QueryClient();
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await router.load();
  return router;
}

export const here = (router: Awaited<ReturnType<typeof openApplications>>) => router.state.location.href;
export const sidebar = () => screen.findByRole('navigation', { name: 'Navegação principal' });

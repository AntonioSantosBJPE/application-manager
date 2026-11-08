import { createFileRoute } from '@tanstack/react-router';

/** The detail of an application: the route exists so the list can open it; the screen comes with the detail slice. */
export const Route = createFileRoute('/_member/applications/$id')({
  component: () => null,
});

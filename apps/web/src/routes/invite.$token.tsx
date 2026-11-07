import { createFileRoute, useRouter } from '@tanstack/react-router';
import { AcceptInvitationForm, joinWithInvitation, openInvitation } from '../features/identity';

/**
 * Invitation screen. The loader checks the link when the page opens, so a dead link renders the invalid
 * message from the first byte (UI-14, UI-16). The response headers of `/invite/*` come from `server.ts`.
 */
export const Route = createFileRoute('/invite/$token')({
  loader: ({ params }) => openInvitation({ data: params.token }),
  component: InvitePage,
});

function InvitePage() {
  const invitation = Route.useLoaderData();
  const { token } = Route.useParams();
  const router = useRouter();

  return (
    <AcceptInvitationForm
      invitation={invitation}
      accept={(input) => joinWithInvitation({ data: { token, ...input } })}
      onSuccess={() => router.history.push('/')}
    />
  );
}

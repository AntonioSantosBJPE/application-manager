import { createFileRoute } from '@tanstack/react-router';
import {
  invite,
  InvitationsPanel,
  pendingInvitations,
  revoke,
  useExpiredSessionRedirect,
} from '../../../features/identity';

/** Invitations of the admin area: a list page with the invite form on top (ADM-15). */
export const Route = createFileRoute('/admin/_protected/invitations')({
  component: InvitationsPage,
});

function InvitationsPage() {
  const onExpired = useExpiredSessionRedirect();

  return (
    <InvitationsPanel
      onExpired={onExpired}
      api={{
        list: (cursor) => pendingInvitations({ data: cursor }),
        create: (input) => invite({ data: input }),
        revoke: (id) => revoke({ data: id }),
      }}
    />
  );
}

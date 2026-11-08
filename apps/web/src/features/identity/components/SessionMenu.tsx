import type { MeResponse } from '@am/contracts';
import { Alert, AppShell, Button } from '@am/ui';
import type { Outcome } from '../api/server-functions';
import { initialsOf } from '../model/person';
import { useSignOut } from './use-sign-out';

export interface SessionMenuProps {
  user: MeResponse;
  signOut: () => Promise<Outcome<undefined>>;
  /** Runs once the session is over, so the route opens the login of the area (UI-13). */
  onSignedOut: () => void;
}

/**
 * Who is signed in and the way out, at the bottom of the sidebar. The session ends on the api; this
 * only asks and then hands over, and a failure shows above the person without leaving the page.
 */
export function SessionMenu({ user, signOut, onSignedOut }: SessionMenuProps) {
  const { signingOut, failure, leave } = useSignOut({ signOut, onSignedOut });

  return (
    <div className="ml-auto flex max-w-full min-w-0 flex-col gap-2 md:mt-auto md:ml-0">
      {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
      <AppShell.User initials={initialsOf(user.name)} name={user.name} className="md:mt-0!">
        <Button intent="ghost" size="sm" disabled={signingOut} onClick={leave}>
          Sair
        </Button>
      </AppShell.User>
    </div>
  );
}

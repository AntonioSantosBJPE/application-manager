import type { MeResponse } from '@am/contracts';
import { Alert, Button } from '@am/ui';
import { useState } from 'react';
import type { Outcome } from '../api/server-functions';
import { problemMessage } from '../model/messages';

export interface SessionMenuProps {
  user: MeResponse;
  signOut: () => Promise<Outcome<undefined>>;
  /** Runs once the session is over, so the route opens the login of the area (UI-13). */
  onSignedOut: () => void;
}

/** Who is signed in and the way out. The session ends on the api; this only asks and then hands over. */
export function SessionMenu({ user, signOut, onSignedOut }: SessionMenuProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  async function leave() {
    setSigningOut(true);
    setFailure(undefined);
    try {
      const outcome = await signOut();
      if (outcome.ok) {
        onSignedOut();
        return;
      }
      setFailure(problemMessage(outcome));
    } catch {
      setFailure(problemMessage({ status: 503 }));
    }
    setSigningOut(false);
  }

  return (
    <div className="flex flex-col gap-2 md:mt-auto">
      <span className="text-xs text-text">{user.name}</span>
      {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
      <Button intent="secondary" size="sm" disabled={signingOut} onClick={() => void leave()}>
        Sair
      </Button>
    </div>
  );
}

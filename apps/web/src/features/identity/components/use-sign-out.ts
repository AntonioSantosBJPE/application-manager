import { useState } from 'react';
import type { Outcome } from '../api/server-functions';
import { problemMessage } from '../model/messages';

export interface SignOutOptions {
  signOut: () => Promise<Outcome<undefined>>;
  /** Runs once the session is over, so the route opens the login of the area (UI-13). */
  onSignedOut: () => void;
}

/**
 * The way out, shared by the shell and the no-access screen: the session ends on the api, and this
 * only asks, then hands over. A failure keeps the person signed in and names the problem.
 */
export function useSignOut({ signOut, onSignedOut }: SignOutOptions) {
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

  return { signingOut, failure, leave: () => void leave() };
}

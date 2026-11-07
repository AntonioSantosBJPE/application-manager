import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { Outcome } from '../api/server-functions';
import { areaOfPath, loginPathOf } from '../model/access';

/**
 * For an action in the browser that came back `401`: the session ended while the page was open, so the
 * login of the current area opens with the page preserved and the expired notice (UI-08). Returns whether
 * it redirected, so the caller stops handling the outcome as an ordinary failure.
 */
export function useExpiredSessionRedirect() {
  const router = useRouter();

  return useCallback(
    (outcome: Outcome<unknown>): boolean => {
      if (outcome.ok || outcome.status !== 401) return false;
      const { pathname, href } = router.state.location;
      void router.navigate({
        to: loginPathOf(areaOfPath(pathname)),
        search: { redirect: href, reason: 'expired' },
      });
      return true;
    },
    [router],
  );
}

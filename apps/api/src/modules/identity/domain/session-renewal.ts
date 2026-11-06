/** A session lasts 30 days from the last renewal: sliding, with no absolute ceiling (AUTH-11). */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Below 29 days remaining the session is extended; at 29 or more it is left alone, so not every request writes. */
export const RENEWAL_THRESHOLD_MS = 29 * 24 * 60 * 60 * 1000;

/**
 * The new `expires_at` for a session, or `null` when it does not need extending (AUTH-11).
 * An already expired session is not renewed: it is rejected instead.
 */
export function renewedExpiry(expiresAt: Date, now: Date): Date | null {
  const remaining = expiresAt.getTime() - now.getTime();
  if (remaining <= 0) return null;
  if (remaining >= RENEWAL_THRESHOLD_MS) return null;
  return new Date(now.getTime() + SESSION_DURATION_MS);
}

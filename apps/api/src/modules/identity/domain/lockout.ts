/** A failure counts while it is younger than 15 minutes; past that it leaves both windows (LOCK-07). */
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** Five failures of the same email + IP block that pair, even with the right password (LOCK-01). */
export const PAIR_FAILURE_LIMIT = 5;

/** Fifty failures of one IP block every email from it (LOCK-02). */
export const IP_FAILURE_LIMIT = 50;

export interface LockoutCounts {
  /** The failures of this email + IP that still count, oldest first. A success clears them (LOCK-06). */
  pairFailures: Date[];
  /** The failures of this IP, including the pairs a success already cleared. */
  ipFailures: Date[];
}

export type LockoutVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** The failures inside the window, oldest first: what both counts are made of. */
function counted(failures: Date[], now: Date): Date[] {
  const windowStart = now.getTime() - LOCKOUT_WINDOW_MS;
  return failures
    .filter((at) => {
      const time = at.getTime();
      return time > windowStart && time <= now.getTime();
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

/** Whole seconds until a failure leaves the window; a 0 is a 1, since `Retry-After` must move forward. */
function secondsUntilExpiry(oldest: Date, now: Date): number {
  return Math.max(1, Math.ceil((oldest.getTime() + LOCKOUT_WINDOW_MS - now.getTime()) / 1000));
}

/**
 * Whether a login may be attempted, and how long to wait when it may not (LOCK-01..LOCK-03). The
 * window closes when the oldest counted failure leaves it, so `Retry-After` counts from that one.
 */
export function evaluateLockout(counts: LockoutCounts, now: Date): LockoutVerdict {
  const pairFailures = counted(counts.pairFailures, now);
  const ipFailures = counted(counts.ipFailures, now);

  const pairBlocked = pairFailures.length >= PAIR_FAILURE_LIMIT;
  const ipBlocked = ipFailures.length >= IP_FAILURE_LIMIT;

  if (!pairBlocked && !ipBlocked) return { allowed: true };

  // Both limits have to clear, so the wait is the later of the two oldest failures.
  const waits = [
    ...(pairBlocked ? [secondsUntilExpiry(pairFailures[0]!, now)] : []),
    ...(ipBlocked ? [secondsUntilExpiry(ipFailures[0]!, now)] : []),
  ];
  return { allowed: false, retryAfterSeconds: Math.max(...waits) };
}

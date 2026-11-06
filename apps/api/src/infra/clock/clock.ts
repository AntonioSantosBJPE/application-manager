/**
 * Everything that decides an expiry, a lockout window or an ordering asks the clock instead of
 * `Date` or `now()` in SQL, so a test moves time without waiting for it (AUTH-11, LOCK-07).
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };

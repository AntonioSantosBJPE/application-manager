import { describe, expect, it } from 'vitest';
import { evaluateLockout, IP_FAILURE_LIMIT, LOCKOUT_WINDOW_MS, PAIR_FAILURE_LIMIT } from './lockout.js';

const now = new Date('2026-11-03T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

/** `count` failures inside the window, spread from `oldestMinutes` ago down to a minute ago. */
function recent(count: number, oldestMinutes: number): Date[] {
  const step = count > 1 ? (oldestMinutes - 1) / (count - 1) : 0;
  return Array.from({ length: count }, (_value, index) => minutesAgo(oldestMinutes - index * step));
}

/** Failures already outside the window: they count for neither limit. */
function expired(count: number): Date[] {
  return Array.from({ length: count }, (_value, index) => minutesAgo(16 + index));
}

describe('login lockout', () => {
  it('allows the fourth failure of a pair and blocks the fifth', () => {
    expect(PAIR_FAILURE_LIMIT).toBe(5);

    expect(evaluateLockout({ pairFailures: recent(4, 10), ipFailures: recent(4, 10) }, now)).toEqual({ allowed: true });

    const fifth = evaluateLockout({ pairFailures: recent(5, 10), ipFailures: recent(5, 10) }, now);
    expect(fifth.allowed).toBe(false);
  });

  it('allows the 49th failure of an IP and blocks the 50th, whatever the email', () => {
    expect(IP_FAILURE_LIMIT).toBe(50);

    // The pair failures stay under five, so only the IP limit can speak here.
    expect(evaluateLockout({ pairFailures: recent(1, 2), ipFailures: recent(49, 14) }, now)).toEqual({ allowed: true });

    const blocked = evaluateLockout({ pairFailures: recent(1, 2), ipFailures: recent(50, 14) }, now);
    expect(blocked.allowed).toBe(false);
  });

  it('sends Retry-After until the oldest counted failure leaves the window', () => {
    // The oldest of the five is 14 minutes old, so it leaves the window in one minute.
    const pairFailures = recent(5, 14);

    const verdict = evaluateLockout({ pairFailures, ipFailures: pairFailures }, now);

    expect(LOCKOUT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(verdict).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it('rounds a partial second up, so Retry-After never returns early', () => {
    const oldest = new Date(now.getTime() - LOCKOUT_WINDOW_MS + 1_500);

    expect(evaluateLockout({ pairFailures: recent(4, 5).concat(oldest), ipFailures: [] }, now)).toEqual({
      allowed: false,
      retryAfterSeconds: 2,
    });
  });

  it('ignores failures older than the window, so the pair is free again', () => {
    const outside = expired(5);

    expect(evaluateLockout({ pairFailures: outside, ipFailures: outside }, now)).toEqual({ allowed: true });
  });

  it('keeps a failure that leaves the window exactly now out of the count', () => {
    const exactlyFifteen = new Date(now.getTime() - LOCKOUT_WINDOW_MS);

    expect(evaluateLockout({ pairFailures: recent(4, 5).concat(exactlyFifteen), ipFailures: [] }, now)).toEqual({
      allowed: true,
    });
  });

  it('waits for the later of the two limits when both are blocked', () => {
    // The pair clears in a minute, the IP only in ten: the caller has to wait for both.
    const pairFailures = recent(5, 14);
    const ipFailures = recent(50, 10);

    expect(evaluateLockout({ pairFailures, ipFailures }, now)).toEqual({ allowed: false, retryAfterSeconds: 300 });
  });

  it('counts nothing when there are no failures', () => {
    expect(evaluateLockout({ pairFailures: [], ipFailures: [] }, now)).toEqual({ allowed: true });
  });
});

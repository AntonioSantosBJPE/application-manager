import { describe, expect, it } from 'vitest';
import { RENEWAL_THRESHOLD_MS, renewedExpiry, SESSION_DURATION_MS } from './session-renewal.js';

const now = new Date('2026-11-03T12:00:00.000Z');
const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

describe('renewedExpiry', () => {
  it('extends a session with less than 29 days left to 30 days from now', () => {
    expect(SESSION_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(RENEWAL_THRESHOLD_MS).toBe(29 * 24 * 60 * 60 * 1000);

    expect(renewedExpiry(inDays(28), now)?.toISOString()).toBe('2026-12-03T12:00:00.000Z');
    expect(renewedExpiry(new Date(now.getTime() + 1), now)?.toISOString()).toBe('2026-12-03T12:00:00.000Z');
  });

  it('leaves a session with 29 days or more alone', () => {
    expect(renewedExpiry(inDays(29), now)).toBeNull();
    expect(renewedExpiry(inDays(30), now)).toBeNull();
  });

  it('does not renew a session that already expired', () => {
    expect(renewedExpiry(new Date(now.getTime() - 1), now)).toBeNull();
    expect(renewedExpiry(now, now)).toBeNull();
  });
});

import type { ApplicationStatus } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { GHOST_AFTER_MS, GHOST_SNOOZE_MS, isGhostSuggested } from './ghost.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const activity = new Date('2026-10-01T12:00:00.000Z');
const at = (elapsedMs: number) => new Date(activity.getTime() + elapsedMs);
const input = (status: ApplicationStatus, ghostSnoozedUntil: Date | null = null) => ({
  status,
  lastActivityAt: activity,
  ghostSnoozedUntil,
});

describe('isGhostSuggested', () => {
  it('APP-32 waits 21 days, which are 504 hours', () => {
    expect(GHOST_AFTER_MS).toBe(504 * HOUR);
    expect(GHOST_SNOOZE_MS).toBe(21 * 24 * HOUR);
  });

  it('APP-33 is false 1 minute before 504 hours and APP-32 is true at exactly 504 hours', () => {
    expect(isGhostSuggested(input('applied'), at(504 * HOUR - MINUTE))).toBe(false);
    expect(isGhostSuggested(input('applied'), at(504 * HOUR))).toBe(true);
    expect(isGhostSuggested(input('interviewing'), at(504 * HOUR - MINUTE))).toBe(false);
    expect(isGhostSuggested(input('interviewing'), at(504 * HOUR))).toBe(true);
  });

  it('APP-32 stays true long after the 504 hours', () => {
    expect(isGhostSuggested(input('applied'), at(100 * 24 * HOUR))).toBe(true);
  });

  it('APP-33 is false in every status other than applied and interviewing, however old the activity', () => {
    const others: ApplicationStatus[] = ['saved', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted'];

    for (const status of others) {
      expect(isGhostSuggested(input(status), at(1000 * HOUR)), status).toBe(false);
    }
  });

  it('APP-33 is false while the snooze is in force and APP-32 true at the very instant it ends', () => {
    const until = at(600 * HOUR);

    expect(isGhostSuggested(input('applied', until), at(600 * HOUR - 1))).toBe(false);
    expect(isGhostSuggested(input('applied', until), at(600 * HOUR))).toBe(true);
    expect(isGhostSuggested(input('applied', until), at(700 * HOUR))).toBe(true);
  });

  it('APP-32 treats a snooze that already passed as no snooze, and APP-33 keeps a young application unsuggested even without one', () => {
    expect(isGhostSuggested(input('applied', at(10 * HOUR)), at(600 * HOUR))).toBe(true);
    expect(isGhostSuggested(input('applied', null), at(HOUR))).toBe(false);
  });

  it('APP-33 stays false when the snooze ends before the 504 hours are met', () => {
    expect(isGhostSuggested(input('applied', at(100 * HOUR)), at(200 * HOUR))).toBe(false);
  });
});

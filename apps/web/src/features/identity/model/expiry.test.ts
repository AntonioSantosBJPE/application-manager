import { describe, expect, it } from 'vitest';
import { daysLeft, isUrgent } from './expiry';

const now = new Date('2026-11-08T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const after = (ms: number) => new Date(now.getTime() + ms).toISOString();

describe('daysLeft', () => {
  it('PRU-06 AC18 counts whole days up to the expiry', () => {
    expect(daysLeft(after(7 * 24 * HOUR), now)).toBe(7);
    expect(daysLeft(after(2 * 24 * HOUR), now)).toBe(2);
    expect(daysLeft(after(24 * HOUR), now)).toBe(1);
  });

  it('PRU-06 AC18 rounds a part of a day up', () => {
    expect(daysLeft(after(HOUR), now)).toBe(1);
    expect(daysLeft(after(1), now)).toBe(1);
    expect(daysLeft(after(2 * 24 * HOUR + 1), now)).toBe(3);
    expect(daysLeft(after(49 * HOUR), now)).toBe(3);
  });

  it('never counts below zero for an instant already past', () => {
    expect(daysLeft(after(0), now)).toBe(0);
    expect(daysLeft(after(-3 * 24 * HOUR), now)).toBe(0);
  });

  it('PRU-06 AC18 gives nothing for an expiry that is not a date', () => {
    expect(daysLeft('not a date', now)).toBeUndefined();
    expect(daysLeft('', now)).toBeUndefined();
  });

  it('counts from the clock it is given', () => {
    const expiresAt = '2026-11-15T12:00:00.000Z';
    expect(daysLeft(expiresAt, new Date('2026-11-08T12:00:00.000Z'))).toBe(7);
    expect(daysLeft(expiresAt, new Date('2026-11-13T12:00:00.000Z'))).toBe(2);
  });
});

describe('isUrgent', () => {
  it('PRU-06 AC18 is urgent with 2 days or fewer left', () => {
    expect(isUrgent(0)).toBe(true);
    expect(isUrgent(1)).toBe(true);
    expect(isUrgent(2)).toBe(true);
  });

  it('PRU-06 AC18 is not urgent with 3 days or more left', () => {
    expect(isUrgent(3)).toBe(false);
    expect(isUrgent(7)).toBe(false);
  });
});

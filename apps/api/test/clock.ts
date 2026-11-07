import type { Clock } from '../src/infra/clock/clock.js';

/**
 * A clock the test moves by hand: an expiry or a 15 minute window is proven without waiting for it
 * (`advance`), and every read returns a copy so a caller cannot mutate the stored instant.
 */
export interface TestClock extends Clock {
  advance(milliseconds: number): void;
  set(at: Date | string): void;
}

export function testClock(start: Date | string = '2026-11-03T12:00:00.000Z'): TestClock {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advance: (milliseconds) => {
      current = new Date(current.getTime() + milliseconds);
    },
    set: (at) => {
      current = new Date(at);
    },
  };
}

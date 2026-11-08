import { dayOf } from './dates';

/** 12:00 in `America/Sao_Paulo` (UTC-3, no daylight saving) is 15:00 UTC. */
const NOON_IN_UTC = 'T15:00:00.000Z';

/**
 * The `occurredAt` of a stage from the day picked in the dialog (`YYYY-MM-DD`): today is `now`, so the
 * event does not land before the activity it follows; any other day is noon in São Paulo (APP-72).
 */
export function stageOccurredAt(day: string, now: Date): string {
  return day === dayOf(now) ? now.toISOString() : `${day}${NOON_IN_UTC}`;
}

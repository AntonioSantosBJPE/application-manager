import type { ApplicationStatus } from '@am/contracts';

const HOUR_MS = 60 * 60 * 1000;

/** 21 days, or 504 hours, without activity before "sem retorno" is suggested (APP-32). */
export const GHOST_AFTER_MS = 504 * HOUR_MS;
/** "Ainda não" hides the suggestion for another 21 days (APP-35, AD-020). */
export const GHOST_SNOOZE_MS = 504 * HOUR_MS;

export interface GhostInput {
  status: ApplicationStatus;
  lastActivityAt: Date;
  ghostSnoozedUntil: Date | null;
}

/**
 * Whether the product suggests marking the application as "sem retorno": the status is `applied` or
 * `interviewing`, 504 h or more passed since the last activity, and no snooze is in force (a snooze
 * ends at the instant it names). It only suggests; no status ever changes by time alone (APP-34).
 */
export function isGhostSuggested(input: GhostInput, now: Date): boolean {
  if (input.status !== 'applied' && input.status !== 'interviewing') return false;
  if (input.ghostSnoozedUntil !== null && input.ghostSnoozedUntil.getTime() > now.getTime()) return false;
  return now.getTime() - input.lastActivityAt.getTime() >= GHOST_AFTER_MS;
}

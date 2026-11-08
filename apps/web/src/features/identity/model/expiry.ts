const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days until an invitation expires, rounded up: 1 h left is 1 d, 49 h left is 3 d. An instant that
 * is not a date gives `undefined`, so a screen leaves the expiry out instead of printing "NaN d".
 */
export function daysLeft(expiresAt: string, now: Date): number | undefined {
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return undefined;
  return Math.max(0, Math.ceil((expires - now.getTime()) / DAY_MS));
}

/** Two days or fewer left: the screen shows the expiry in `warning` (PRU-06 AC18). */
export function isUrgent(days: number): boolean {
  return days <= 2;
}

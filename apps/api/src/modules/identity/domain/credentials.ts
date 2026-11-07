import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@am/contracts';

/**
 * An email is compared and stored lowercased without surrounding spaces (EDGE-01), so the same
 * person cannot end up with two accounts that differ only in case. The format itself is checked by
 * the contract before the value reaches the domain.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * The password rule is a length window and nothing else: 12 to 128 characters, no composition
 * requirement (CLI-05, INV-08).
 */
export function isAcceptablePassword(raw: string): boolean {
  return raw.length >= PASSWORD_MIN_LENGTH && raw.length <= PASSWORD_MAX_LENGTH;
}

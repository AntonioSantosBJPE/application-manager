import { RESUME_SECTIONS, type ResumeSection } from '@am/contracts';
import { fromMonthDate, toMonthDate } from './months.js';

/** The sections whose items own bullets; a bullet route on any other section answers `404`. */
export const BULLET_SECTIONS = ['experiences', 'projects'] as const;
export type BulletSection = (typeof BULLET_SECTIONS)[number];

/** `section` as the enum of the contract, or undefined when the path segment names no section. */
export function parseSection(value: string): ResumeSection | undefined {
  return (RESUME_SECTIONS as readonly string[]).includes(value) ? (value as ResumeSection) : undefined;
}

export function isBulletSection(section: ResumeSection): section is BulletSection {
  return (BULLET_SECTIONS as readonly string[]).includes(section);
}

/** The columns that hold a month: `YYYY-MM` on the wire, a `date` on day 1 in the table. */
const MONTH_KEYS = ['startDate', 'endDate', 'issuedOn'] as const;

/** The body of a write as the columns want it: every month turned into its `date`. */
export function toRowValues(values: Record<string, unknown>): Record<string, unknown> {
  const row = { ...values };
  for (const key of MONTH_KEYS) {
    const value = row[key];
    if (typeof value === 'string') row[key] = toMonthDate(value);
  }
  return row;
}

/** A stored item as the API shows it: the owner and the position stay inside, the dates go back to `YYYY-MM`. */
export function toItem(row: Record<string, unknown>): Record<string, unknown> {
  const item = { ...row };
  delete item.userId;
  delete item.position;
  for (const key of MONTH_KEYS) {
    const value = item[key];
    if (typeof value === 'string') item[key] = fromMonthDate(value);
  }
  return item;
}

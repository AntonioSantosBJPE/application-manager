import type { ResumeSection } from '@am/contracts';
import type { ItemOf } from '../api/server-functions';
import { formatMonth, formatRange } from './months';
import { LANGUAGE_LEVEL_LABELS } from './sections';

/**
 * What the header of an item shows: the `title` in strong, then a line with the `dates` in monospace and
 * the `detail` after a "·" (the place of an experience, the link of a project). Both are absent when the
 * item has nothing to put there.
 */
export interface ItemHeader {
  title: string;
  dates?: string;
  detail?: string;
}

/** A title made of a name and, when there is one, what comes after it: "Cargo · Empresa" (RES-49). */
function joined(first: string, second: string | null): string {
  return second === null || second === '' ? first : `${first} · ${second}`;
}

function present(value: string | null): string | undefined {
  return value === null || value === '' ? undefined : value;
}

const headers: { [S in ResumeSection]: (item: ItemOf[S]) => ItemHeader } = {
  experiences: (item) => ({
    title: joined(item.role, item.company),
    dates: formatRange(item.startDate, item.endDate),
    detail: present(item.location),
  }),
  projects: (item) => ({ title: item.name, detail: present(item.url) }),
  educations: (item) => ({
    title: joined(item.course, item.institution),
    dates: formatRange(item.startDate, item.endDate),
  }),
  certifications: (item) => ({
    title: joined(item.name, item.issuer),
    dates: item.issuedOn === null ? undefined : formatMonth(item.issuedOn),
  }),
  languages: (item) => ({ title: joined(item.language, LANGUAGE_LEVEL_LABELS[item.level]) }),
};

/** The header of an item of `section` (RES-49, RES-50). */
export function itemHeader<S extends ResumeSection>(section: S, item: ItemOf[S]): ItemHeader {
  return (headers[section] as (item: ItemOf[S]) => ItemHeader)(item);
}

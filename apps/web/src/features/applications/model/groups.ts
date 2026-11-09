import type { ApplicationStatus, ApplicationSummary, ApplicationsPage } from '@am/contracts';

export interface ApplicationGroup {
  status: ApplicationStatus;
  /** The total of the group with the filters, not only what was loaded (APP-45). */
  count: number;
  items: ApplicationSummary[];
}

/**
 * Cuts the list, already ordered by the api, into one section per status, in the order received and
 * without reordering a row. A status with no row loaded has no section; the number of each section
 * is the api's count for it, since the page may hold only part of the group (APP-45).
 */
export function groups(items: readonly ApplicationSummary[], byStatus: ApplicationsPage['counts']['byStatus']): ApplicationGroup[] {
  const sections: ApplicationGroup[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last !== undefined && last.status === item.status) {
      last.items.push(item);
    } else {
      sections.push({ status: item.status, count: byStatus[item.status], items: [item] });
    }
  }
  return sections;
}

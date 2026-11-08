import { ACTIVE_STATUSES, FUNNEL_ORDER, type ApplicationStatus, type ApplicationsTab } from '@am/contracts';

/** The group of a status in the list: 0 for `offer` up to 7 for `ghosted` (APP-14). */
export function funnelRank(status: ApplicationStatus): number {
  return FUNNEL_ORDER.indexOf(status);
}

/** The tab a status belongs to: Salva, Enviada, Em entrevistas and Proposta are active, the rest closed (APP-11). */
export function tabOf(status: ApplicationStatus): ApplicationsTab {
  return (ACTIVE_STATUSES as readonly ApplicationStatus[]).includes(status) ? 'active' : 'closed';
}

/** The statuses a tab lists, in funnel order. */
export function statusesOf(tab: ApplicationsTab): ApplicationStatus[] {
  return FUNNEL_ORDER.filter((status) => tabOf(status) === tab);
}

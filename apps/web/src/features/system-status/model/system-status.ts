import type { HealthResponse } from '@am/contracts';

/** What the web learned from `GET /health`: the contract body, or that the API did not answer. */
export type HealthFetchResult = { kind: 'reachable'; health: HealthResponse } | { kind: 'unreachable' };

export type ServiceState = 'operational' | 'unavailable';
export type ServiceStates = { api: ServiceState; database: ServiceState };
export type SystemStatus = ServiceStates & {
  /** ISO instant at which the web read `GET /health` (AD-009). */
  checkedAt: string;
};

/** The components the status lists, in the order they appear when all of them answer. */
export type SystemComponent = keyof ServiceStates;
const COMPONENTS: readonly SystemComponent[] = ['api', 'database'];

/**
 * A reachable API is operational and the database follows its `db` field; an unreachable
 * API makes both unavailable, since nothing is known about the database (SKEL-06, EDGE-02).
 */
export function toSystemStatus(result: HealthFetchResult): ServiceStates {
  if (result.kind === 'unreachable') return { api: 'unavailable', database: 'unavailable' };
  return {
    api: 'operational',
    database: result.health.db === 'up' ? 'operational' : 'unavailable',
  };
}

/** The verdict of the status page: operational only when every component is (PRU-06). */
export function verdictOf(status: ServiceStates): 'operational' | 'degraded' {
  return COMPONENTS.every((component) => status[component] === 'operational')
    ? 'operational'
    : 'degraded';
}

/**
 * The components in the order the page lists them: the unavailable ones first, so the affected one is at
 * the top when the service is degraded, and otherwise API before the database (PRU-06).
 */
export function componentsInOrder(
  status: ServiceStates,
): { component: SystemComponent; state: ServiceState }[] {
  const all = COMPONENTS.map((component) => ({ component, state: status[component] }));
  return [
    ...all.filter((item) => item.state === 'unavailable'),
    ...all.filter((item) => item.state === 'operational'),
  ];
}

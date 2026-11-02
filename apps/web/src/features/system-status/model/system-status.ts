import type { HealthResponse } from '@am/contracts';

/** What the web learned from `GET /health`: the contract body, or that the API did not answer. */
export type HealthFetchResult = { kind: 'reachable'; health: HealthResponse } | { kind: 'unreachable' };

export type ServiceState = 'operational' | 'unavailable';
export type SystemStatus = { api: ServiceState; database: ServiceState };

/**
 * A reachable API is operational and the database follows its `db` field; an unreachable
 * API makes both unavailable, since nothing is known about the database (SKEL-06, EDGE-02).
 */
export function toSystemStatus(result: HealthFetchResult): SystemStatus {
  if (result.kind === 'unreachable') return { api: 'unavailable', database: 'unavailable' };
  return {
    api: 'operational',
    database: result.health.db === 'up' ? 'operational' : 'unavailable',
  };
}

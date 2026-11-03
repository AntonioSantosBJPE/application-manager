import { healthResponseSchema } from '@am/contracts';
import type { HealthFetchResult } from '../model/system-status';

/** 200 and 503 both carry the contract body; any other status means the API is not healthy. */
const contractStatuses = new Set([200, 503]);

/**
 * Calls `GET /health` with the request id and gives up after `timeoutMs` (EDGE-02).
 * Never throws: a timeout, network error, unexpected status or invalid body is `unreachable`.
 */
export async function fetchHealth(
  baseUrl: string,
  requestId: string,
  timeoutMs = 3000,
): Promise<HealthFetchResult> {
  try {
    const response = await fetch(new URL('/health', baseUrl), {
      headers: { 'x-request-id': requestId },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!contractStatuses.has(response.status)) return { kind: 'unreachable' };
    const parsed = healthResponseSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'reachable', health: parsed.data } : { kind: 'unreachable' };
  } catch {
    return { kind: 'unreachable' };
  }
}

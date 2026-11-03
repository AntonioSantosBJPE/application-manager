import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { loadServerEnv } from '../../../lib/env';
import { createLogger, type Logger } from '../../../lib/logger';
import { resolveRequestId } from '../../../lib/request-id';
import { toSystemStatus, type SystemStatus } from '../model/system-status';
import { fetchHealth } from './fetch-health';

export interface LoadSystemStatusInput {
  incomingRequestId: string | undefined;
  apiInternalUrl: string;
  logger: Logger;
}

/**
 * Logs the request id and sends the same id to the api (LOG-04). Never throws: an api that
 * fails or does not answer becomes both rows unavailable, so the page still renders (SKEL-06).
 */
export async function loadSystemStatus({
  incomingRequestId,
  apiInternalUrl,
  logger,
}: LoadSystemStatusInput): Promise<SystemStatus> {
  const requestId = resolveRequestId(incomingRequestId);
  logger.info({ requestId }, 'health check requested');
  return toSystemStatus(await fetchHealth(apiInternalUrl, requestId));
}

let serverLogger: Logger | undefined;

/** BFF for the status page: runs on the server during SSR and on client navigations. */
export const getSystemStatus = createServerFn({ method: 'GET' }).handler(() => {
  const env = loadServerEnv();
  serverLogger ??= createLogger({ level: env.logLevel });
  return loadSystemStatus({
    incomingRequestId: getRequestHeader('x-request-id'),
    apiInternalUrl: env.apiInternalUrl,
    logger: serverLogger,
  });
});

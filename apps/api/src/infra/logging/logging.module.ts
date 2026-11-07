import type { DynamicModule } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { LoggerModule } from 'nestjs-pino';
import { stdSerializers, stdTimeFunctions, type DestinationStream, type Level } from 'pino';
import type { Options } from 'pino-http';
import { resolveRequestId } from './request-id.js';

export interface LoggingOptions {
  level: Level;
  /** Where JSON lines go; stdout when absent. Tests pass a stream to read the lines. */
  destination?: DestinationStream;
}

const redacted = '[redacted]';
const invitationTokenPath = /\/invitations\/([^/?#]+)/;

/** The invitation token of a path, or undefined when the path is not an invitation route. */
export function invitationTokenOf(url: string): string | undefined {
  return invitationTokenPath.exec(url)?.[1];
}

/**
 * The token of `/invitations/:token` is a credential: the URL keeps its shape and loses the token,
 * so a log line can be read without handing the invitation to anyone who sees it (AUTH-18).
 */
export function withoutInvitationToken(url: string): string {
  return invitationTokenOf(url) === undefined ? url : url.replace(invitationTokenPath, '/invitations/[token]');
}

/** Replaces the token wherever it is written inside the request, including the router params. */
function withoutToken(value: unknown, token: string | undefined): unknown {
  if (token === undefined) return value;
  if (typeof value === 'string') return value.replaceAll(token, '[token]');
  if (Array.isArray(value)) return value.map((entry) => withoutToken(entry, token));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, withoutToken(entry, token)]));
  }
  return value;
}

/**
 * JSON lines with a text `level`, ISO `time`, `msg` and the request's `requestId` (LOG-01..03).
 * The request id is resolved in pino-http's `genReqId`, which also returns it in the response header.
 * A cookie, a `set-cookie`, the internal IP header and an invitation token are replaced before the
 * line is written (AUTH-18).
 */
export function createLoggingModule({ level, destination }: LoggingOptions): DynamicModule {
  const options: Options = {
    level,
    timestamp: stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    genReqId: (req, res) => {
      const id = resolveRequestId(req.headers['x-request-id']);
      res.setHeader('x-request-id', id);
      return id;
    },
    customProps: (req) => ({ requestId: req.id }),
    serializers: {
      req: (req: IncomingMessage) => {
        const serialized = stdSerializers.req(req);
        const token = serialized.url === undefined ? undefined : invitationTokenOf(serialized.url);
        // The router writes the matched segments into `params.splat`, so the token is in both places.
        return withoutToken({ ...serialized, params: (req as { params?: unknown }).params }, token) as typeof serialized;
      },
    },
    redact: {
      paths: ['req.headers.cookie', 'res.headers["set-cookie"]', 'req.headers["x-am-client-ip"]'],
      censor: redacted,
    },
  };
  return LoggerModule.forRoot({ pinoHttp: destination ? [options, destination] : options });
}

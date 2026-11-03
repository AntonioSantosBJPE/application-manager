import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { stdTimeFunctions, type DestinationStream, type Level } from 'pino';
import type { Options } from 'pino-http';
import { resolveRequestId } from './request-id.js';

export interface LoggingOptions {
  level: Level;
  /** Where JSON lines go; stdout when absent. Tests pass a stream to read the lines. */
  destination?: DestinationStream;
}

/**
 * JSON lines with a text `level`, ISO `time`, `msg` and the request's `requestId` (LOG-01..03).
 * The request id is resolved in pino-http's `genReqId`, which also returns it in the response header.
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
  };
  return LoggerModule.forRoot({ pinoHttp: destination ? [options, destination] : options });
}

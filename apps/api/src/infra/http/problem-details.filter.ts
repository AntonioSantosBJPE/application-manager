import { Catch, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { toProblem } from './problem-details.js';

/**
 * Every error leaves the API as `application/problem+json` (AUTH-17). The body never repeats a
 * value from the request: a rejected password must not appear in the answer (EDGE-02).
 * The `x-request-id` header pino already set is left untouched.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(thrown: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, problem, headers } = toProblem(thrown);

    if (status >= 500) {
      const detail = thrown instanceof Error ? thrown.message : String(thrown);
      this.logger.error(`unhandled error: ${detail}`, thrown instanceof Error ? thrown.stack : undefined);
    }

    if (response.headersSent) return;
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    response
      .status(status)
      .type('application/problem+json')
      .send(JSON.stringify(problem));
  }
}

import { Catch, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { toProblem } from './problem-details.js';

/** The SQLSTATE of the driver's cause, when the thrown value carries one. */
function databaseCodeOf(thrown: unknown): string | undefined {
  const cause = (thrown as { cause?: unknown } | null)?.cause;
  const code = (cause as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** The error's name, which says what kind of failure it was without repeating any value. */
function errorNameOf(thrown: unknown): string {
  return thrown instanceof Error ? thrown.name : typeof thrown;
}

/**
 * The frames of a stack, without its first line: that line is the message, and the message of a
 * database error repeats the query parameters (AUTH-18). The call sites are what a reader needs.
 */
function framesOf(thrown: unknown): string | undefined {
  if (!(thrown instanceof Error) || thrown.stack === undefined) return undefined;
  const frames = thrown.stack.split('\n').filter((line) => line.trimStart().startsWith('at '));
  return frames.length === 0 ? undefined : frames.join('\n');
}

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
      // A database error's own message repeats the query and its parameters, and a password hash or
      // a token hash travels in them. Only the kind of failure is logged, never the message: a code
      // says what happened without carrying a value from the request (AUTH-18).
      const code = databaseCodeOf(thrown);
      const detail = code === undefined ? errorNameOf(thrown) : `${errorNameOf(thrown)} (code ${code})`;
      this.logger.error(`unhandled error: ${detail}`, framesOf(thrown));
    }

    if (response.headersSent) return;
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    response
      .status(status)
      .type('application/problem+json')
      .send(JSON.stringify(problem));
  }
}

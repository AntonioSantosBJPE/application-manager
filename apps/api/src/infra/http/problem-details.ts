import type { ProblemDetails, ProblemFieldError } from '@am/contracts';
import { HttpException, HttpStatus } from '@nestjs/common';

const titles: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

/**
 * An exception that already knows its Problem Details body: the status is carried in the response
 * so the filter does not have to classify it again.
 */
export class ProblemDetailsException extends HttpException {
  constructor(
    readonly problem: ProblemDetails,
    readonly headers: Record<string, string> = {},
  ) {
    super(problem, problem.status);
  }
}

/** RFC 9457 body for a status, named the way the design names it. */
export function problemFor(status: number, detail?: string, errors?: ProblemFieldError[]): ProblemDetails {
  return {
    type: 'about:blank',
    title: titles[status] ?? 'Error',
    status,
    ...(detail === undefined ? {} : { detail }),
    ...(errors === undefined ? {} : { errors }),
  };
}

export interface ProblemFromUnknown {
  status: number;
  problem: ProblemDetails;
  headers: Record<string, string>;
}

/** The part of a thrown value this classifier reads, so it does not depend on the exact error type. */
interface ThrownLike {
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
}

/**
 * Maps anything a handler throws onto a Problem Details answer. A status that is not an error
 * (2xx/3xx used as a control-flow exception) becomes `500`: nothing else describes it.
 */
export function toProblem(thrown: unknown): ProblemFromUnknown {
  if (thrown instanceof ProblemDetailsException) {
    return { status: thrown.problem.status, problem: thrown.problem, headers: thrown.headers };
  }
  if (thrown instanceof HttpException) {
    const declaredStatus = thrown.getStatus();
    // A control-flow exception (a redirect, say) carries no error body; only 4xx and 5xx do.
    const status = declaredStatus >= 400 && declaredStatus <= 599 ? declaredStatus : HttpStatus.INTERNAL_SERVER_ERROR;
    return { status, problem: problemFor(status), headers: {} };
  }

  // Express body-parser rejects a malformed JSON body with a 400 and a `type` of its own.
  const like = thrown as ThrownLike;
  const declared = typeof like?.status === 'number' ? like.status : like?.statusCode;
  const status =
    typeof declared === 'number' && declared >= 400 && declared <= 599 ? declared : HttpStatus.INTERNAL_SERVER_ERROR;
  // The message of an unexpected error stays in the log: it can carry a value from the request.
  const detail = status < 500 && like?.type === 'entity.parse.failed' ? 'Malformed request body' : undefined;
  return { status, problem: problemFor(status, detail), headers: {} };
}

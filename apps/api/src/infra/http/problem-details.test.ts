import { BadRequestException, GoneException, HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ProblemDetailsException, problemFor, toProblem } from './problem-details.js';

describe('problemFor', () => {
  it('builds an about:blank body carrying the status and its title', () => {
    expect(problemFor(401)).toEqual({ type: 'about:blank', title: 'Unauthorized', status: 401 });
    expect(problemFor(429).title).toBe('Too Many Requests');
    expect(problemFor(410).title).toBe('Gone');
  });

  it('adds the detail and the field errors only when they are given', () => {
    expect(problemFor(400, 'Invalid request body', [{ path: 'password', code: 'too_big' }])).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid request body',
      errors: [{ path: 'password', code: 'too_big' }],
    });
    expect(problemFor(400)).not.toHaveProperty('errors');
    expect(problemFor(400)).not.toHaveProperty('detail');
  });
});

describe('toProblem', () => {
  it('keeps the body and the headers of a ProblemDetailsException', () => {
    const problem = problemFor(429, 'Too many attempts');
    const headers = { 'retry-after': '42' };

    expect(toProblem(new ProblemDetailsException(problem, headers))).toEqual({ status: 429, problem, headers });
  });

  it('turns an unclassified HttpException into the body of its status', () => {
    expect(toProblem(new GoneException())).toEqual({ status: 410, problem: problemFor(410), headers: {} });
  });

  it('names a malformed body without repeating it', () => {
    const error = Object.assign(new Error('Unexpected token } in JSON at position 2'), {
      status: 400,
      type: 'entity.parse.failed',
    });

    expect(toProblem(error)).toEqual({ status: 400, problem: problemFor(400, 'Malformed request body'), headers: {} });
  });

  it('answers 500 for an unexpected error and keeps its message out of the body', () => {
    const result = toProblem(new Error('password=hunter2 leaked'));

    expect(result.status).toBe(500);
    expect(result.problem).toEqual(problemFor(500));
    expect(JSON.stringify(result.problem)).not.toContain('hunter2');
  });

  it('answers 500 for a value that is not even an error', () => {
    expect(toProblem('boom').status).toBe(500);
    expect(toProblem(undefined).status).toBe(500);
  });

  it('keeps the status of a handler exception that already is an error', () => {
    expect(toProblem(new BadRequestException()).status).toBe(400);
    // A control-flow exception with a success status has no error body of its own.
    expect(toProblem(new HttpException('redirect', 302)).status).toBe(500);
  });
});

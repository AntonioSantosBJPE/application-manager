import { type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { ProblemDetailsException, problemFor } from './problem-details.js';

/** What a handler receives from the pipe: the value the schema produced, typed by the schema. */
export type ZodBody<T extends z.ZodType> = z.output<T>;

/**
 * Validates a body with the shared schema and answers `400` in Problem Details (EDGE-02). Only the
 * path and the issue code are reported: a rejected length must not echo the password back.
 */
export function zodBody<T extends z.ZodType>(schema: T): PipeTransform {
  return {
    transform(value: unknown): z.output<T> {
      const result = schema.safeParse(value);
      if (result.success) return result.data;
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        code: issue.code,
      }));
      throw new ProblemDetailsException(problemFor(400, 'Invalid request body', errors));
    },
  };
}

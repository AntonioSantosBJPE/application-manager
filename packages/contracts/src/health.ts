import { z } from 'zod';

/** Body of `GET /health`: the API is up and reports whether the database answered. */
export type HealthResponse = { status: 'ok'; db: 'up' } | { status: 'degraded'; db: 'down' };

export const healthResponseSchema: z.ZodType<HealthResponse> = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), db: z.literal('up') }),
  z.object({ status: z.literal('degraded'), db: z.literal('down') }),
]);

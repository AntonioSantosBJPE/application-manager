import { z } from 'zod';

/** A required variable is absent; the message names it so the container log says what to set. */
export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required environment variable: ${variable}`);
    this.name = 'MissingEnvError';
  }
}

const required = ['DATABASE_URL'] as const;

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3333),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .transform((env) => ({ databaseUrl: env.DATABASE_URL, port: env.PORT, logLevel: env.LOG_LEVEL }));

export type ApiEnv = z.output<typeof envSchema>;

/** Reads and validates the variables used by `main` and `migrate` (SKEL-11). */
export function loadEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  for (const name of required) {
    if (!source[name]) throw new MissingEnvError(name);
  }
  return envSchema.parse(source);
}

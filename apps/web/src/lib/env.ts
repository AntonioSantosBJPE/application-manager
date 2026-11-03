import { z } from 'zod';

/** A required variable is absent; the message names it so the container log says what to set. */
export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required environment variable: ${variable}`);
    this.name = 'MissingEnvError';
  }
}

const required = ['API_INTERNAL_URL'] as const;

const envSchema = z
  .object({
    API_INTERNAL_URL: z.string().min(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .transform((env) => ({ apiInternalUrl: env.API_INTERNAL_URL, logLevel: env.LOG_LEVEL }));

export type ServerEnv = z.output<typeof envSchema>;

/** Reads and validates the variables of the web server (SKEL-11). PORT is read by srvx. */
export function loadServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  for (const name of required) {
    if (!source[name]) throw new MissingEnvError(name);
  }
  return envSchema.parse(source);
}

import { z } from 'zod';

/** A required variable is absent; the message names it so the container log says what to set. */
export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required environment variable: ${variable}`);
    this.name = 'MissingEnvError';
  }
}

const required = ['DATABASE_URL', 'WEB_PUBLIC_URL'] as const;

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    /** Base of the `inviteUrl` the API returns (INV-01): the public address of the web app. */
    WEB_PUBLIC_URL: z.url(),
    /** `false` only in local development, where the cookie cannot carry `Secure` (AUTH-08). */
    SESSION_COOKIE_SECURE: z
      .stringbool()
      .default(true),
    PORT: z.coerce.number().int().positive().default(3333),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .transform((env) => ({
    databaseUrl: env.DATABASE_URL,
    webPublicUrl: env.WEB_PUBLIC_URL.replace(/\/+$/, ''),
    sessionCookieSecure: env.SESSION_COOKIE_SECURE,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
  }));

export type ApiEnv = z.output<typeof envSchema>;

/**
 * What only the database jobs need: `migrate` and the CLI run before the web exists, so requiring
 * `WEB_PUBLIC_URL` there would make them fail for a variable they never read (EDGE-04).
 */
const databaseEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .transform((env) => ({ databaseUrl: env.DATABASE_URL, logLevel: env.LOG_LEVEL }));

export type DatabaseEnv = z.output<typeof databaseEnvSchema>;

/** Reads and validates the variables used by `main` (SKEL-11). */
export function loadEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  for (const name of required) {
    if (!source[name]) throw new MissingEnvError(name);
  }
  return envSchema.parse(source);
}

/** Reads and validates the variables of `migrate` and the CLI: the database, and nothing else. */
export function loadDatabaseEnv(source: Record<string, string | undefined> = process.env): DatabaseEnv {
  if (!source.DATABASE_URL) throw new MissingEnvError('DATABASE_URL');
  return databaseEnvSchema.parse(source);
}

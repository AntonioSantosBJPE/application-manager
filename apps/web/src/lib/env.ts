import { z } from 'zod';

/** A required variable is absent; the message names it so the container log says what to set. */
export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required environment variable: ${variable}`);
    this.name = 'MissingEnvError';
  }
}

// Order matters only for the message a container without any variable prints: the api comes first.
const required = ['API_INTERNAL_URL', 'WEB_PUBLIC_URL'] as const;

const envSchema = z
  .object({
    API_INTERNAL_URL: z.string().min(1),
    WEB_PUBLIC_URL: z.url(),
    // Not every environment has a proxy in front of the web; without one the socket address is used.
    // Compose may pass the variable empty, which means the same as absent.
    CLIENT_IP_HEADER: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .transform((env) => ({
    apiInternalUrl: env.API_INTERNAL_URL,
    webPublicUrl: env.WEB_PUBLIC_URL,
    clientIpHeader: env.CLIENT_IP_HEADER,
    logLevel: env.LOG_LEVEL,
  }));

export type ServerEnv = z.output<typeof envSchema>;

/** Reads and validates the variables of the web server (SKEL-11). PORT is read by srvx. */
export function loadServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  for (const name of required) {
    if (!source[name]) throw new MissingEnvError(name);
  }
  return envSchema.parse(source);
}

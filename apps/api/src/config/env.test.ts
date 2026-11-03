import { describe, expect, it } from 'vitest';
import { loadEnv, MissingEnvError } from './env.js';

const databaseUrl = 'postgres://app:app@localhost:5432/app';

describe('loadEnv', () => {
  it('throws naming DATABASE_URL when it is missing or empty', () => {
    for (const source of [{}, { DATABASE_URL: '' }]) {
      expect(() => loadEnv(source)).toThrow(MissingEnvError);
      expect(() => loadEnv(source)).toThrow('Missing required environment variable: DATABASE_URL');
    }
  });

  it('applies the defaults PORT 3333 and LOG_LEVEL info', () => {
    expect(loadEnv({ DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl,
      port: 3333,
      logLevel: 'info',
    });
  });

  it('returns the values that are present', () => {
    expect(loadEnv({ DATABASE_URL: databaseUrl, PORT: '4000', LOG_LEVEL: 'debug' })).toEqual({
      databaseUrl,
      port: 4000,
      logLevel: 'debug',
    });
  });
});

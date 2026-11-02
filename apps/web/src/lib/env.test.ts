import { describe, expect, it } from 'vitest';
import { loadServerEnv, MissingEnvError } from './env';

const apiInternalUrl = 'http://api:3333';

describe('loadServerEnv', () => {
  it('throws naming API_INTERNAL_URL when it is missing or empty', () => {
    for (const source of [{}, { API_INTERNAL_URL: '' }]) {
      expect(() => loadServerEnv(source)).toThrow(MissingEnvError);
      expect(() => loadServerEnv(source)).toThrow(
        'Missing required environment variable: API_INTERNAL_URL',
      );
    }
  });

  it('returns API_INTERNAL_URL and the LOG_LEVEL default info', () => {
    expect(loadServerEnv({ API_INTERNAL_URL: apiInternalUrl })).toEqual({
      apiInternalUrl,
      logLevel: 'info',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { loadServerEnv, MissingEnvError } from './env';

const apiInternalUrl = 'http://api:3333';
const webPublicUrl = 'http://localhost:3000';

describe('loadServerEnv', () => {
  it('throws naming API_INTERNAL_URL when it is missing or empty', () => {
    for (const source of [{}, { API_INTERNAL_URL: '' }]) {
      expect(() => loadServerEnv(source)).toThrow(MissingEnvError);
      expect(() => loadServerEnv(source)).toThrow(
        'Missing required environment variable: API_INTERNAL_URL',
      );
    }
  });

  it('throws naming WEB_PUBLIC_URL when only API_INTERNAL_URL is set', () => {
    expect(() => loadServerEnv({ API_INTERNAL_URL: apiInternalUrl })).toThrow(
      'Missing required environment variable: WEB_PUBLIC_URL',
    );
  });

  it('returns API_INTERNAL_URL and WEB_PUBLIC_URL with the LOG_LEVEL default info', () => {
    expect(loadServerEnv({ API_INTERNAL_URL: apiInternalUrl, WEB_PUBLIC_URL: webPublicUrl })).toEqual({
      apiInternalUrl,
      webPublicUrl,
      clientIpHeader: undefined,
      logLevel: 'info',
    });
  });

  it('reads CLIENT_IP_HEADER when the proxy in front of the web sets one', () => {
    const env = loadServerEnv({
      API_INTERNAL_URL: apiInternalUrl,
      WEB_PUBLIC_URL: webPublicUrl,
      CLIENT_IP_HEADER: 'cf-connecting-ip',
    });

    expect(env.clientIpHeader).toBe('cf-connecting-ip');
  });

  it('treats an empty CLIENT_IP_HEADER as absent, which is how compose passes an unset variable', () => {
    const env = loadServerEnv({
      API_INTERNAL_URL: apiInternalUrl,
      WEB_PUBLIC_URL: webPublicUrl,
      CLIENT_IP_HEADER: '',
    });

    expect(env.clientIpHeader).toBeUndefined();
  });
});

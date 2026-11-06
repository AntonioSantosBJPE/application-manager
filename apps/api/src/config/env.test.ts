import { describe, expect, it } from 'vitest';
import { loadDatabaseEnv, loadEnv, MissingEnvError } from './env.js';

const databaseUrl = 'postgres://app:app@localhost:5432/app';
const webPublicUrl = 'http://localhost:3000';

describe('loadEnv', () => {
  it('throws naming DATABASE_URL when it is missing or empty', () => {
    for (const source of [{ WEB_PUBLIC_URL: webPublicUrl }, { WEB_PUBLIC_URL: webPublicUrl, DATABASE_URL: '' }]) {
      expect(() => loadEnv(source)).toThrow(MissingEnvError);
      expect(() => loadEnv(source)).toThrow('Missing required environment variable: DATABASE_URL');
    }
  });

  it('throws naming WEB_PUBLIC_URL when it is missing', () => {
    for (const source of [{ DATABASE_URL: databaseUrl }, { DATABASE_URL: databaseUrl, WEB_PUBLIC_URL: '' }]) {
      expect(() => loadEnv(source)).toThrow('Missing required environment variable: WEB_PUBLIC_URL');
    }
  });

  it('rejects a WEB_PUBLIC_URL that is not an absolute url', () => {
    expect(() => loadEnv({ DATABASE_URL: databaseUrl, WEB_PUBLIC_URL: '/invite' })).toThrow();
  });

  it('applies the defaults PORT 3333, LOG_LEVEL info and a secure cookie', () => {
    expect(loadEnv({ DATABASE_URL: databaseUrl, WEB_PUBLIC_URL: webPublicUrl })).toEqual({
      databaseUrl,
      webPublicUrl,
      sessionCookieSecure: true,
      port: 3333,
      logLevel: 'info',
    });
  });

  it('returns the values that are present', () => {
    expect(
      loadEnv({
        DATABASE_URL: databaseUrl,
        WEB_PUBLIC_URL: webPublicUrl,
        SESSION_COOKIE_SECURE: 'false',
        PORT: '4000',
        LOG_LEVEL: 'debug',
      }),
    ).toEqual({
      databaseUrl,
      webPublicUrl,
      sessionCookieSecure: false,
      port: 4000,
      logLevel: 'debug',
    });
  });

  it('drops the trailing slash of WEB_PUBLIC_URL so the invite url is not doubled', () => {
    expect(loadEnv({ DATABASE_URL: databaseUrl, WEB_PUBLIC_URL: 'https://app.example.com/' }).webPublicUrl).toBe(
      'https://app.example.com',
    );
  });
});

describe('loadDatabaseEnv', () => {
  it('reads only DATABASE_URL, so migrate and the CLI start without WEB_PUBLIC_URL', () => {
    expect(loadDatabaseEnv({ DATABASE_URL: databaseUrl })).toEqual({ databaseUrl, logLevel: 'info' });
  });

  it('throws naming DATABASE_URL when it is missing or empty', () => {
    for (const source of [{}, { DATABASE_URL: '' }]) {
      expect(() => loadDatabaseEnv(source)).toThrow('Missing required environment variable: DATABASE_URL');
    }
  });
});

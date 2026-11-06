import { Writable } from 'node:stream';
import { AppModule } from '../src/app.module.js';
import { createApp } from '../src/create-app.js';
import type { ApiEnv } from '../src/config/env.js';

/** Starts the real AppModule on a random port against `databaseUrl`; logs are discarded. */
export async function startApi(databaseUrl: string, overrides: Partial<ApiEnv> = {}) {
  const discard = new Writable({ write: (_chunk, _encoding, done) => done() });
  const env: ApiEnv = {
    databaseUrl,
    webPublicUrl: 'http://localhost:3000',
    // The integration client speaks http, so the cookie has to be readable without Secure.
    sessionCookieSecure: false,
    port: 0,
    logLevel: 'info',
    ...overrides,
  };
  const app = await createApp(AppModule.forRoot(env, { logDestination: discard }));
  await app.listen(0, '127.0.0.1');
  return { baseUrl: await app.getUrl(), close: () => app.close() };
}

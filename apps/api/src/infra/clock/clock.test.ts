import type { INestApplication } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { testClock } from '../../../test/clock.js';
import { createApp } from '../../create-app.js';
import { CLOCK, type Clock } from './clock.js';

const env = {
  databaseUrl: 'postgres://unused:unused@localhost:1/unused',
  webPublicUrl: 'http://localhost:3000',
  sessionCookieSecure: false,
  port: 0,
  logLevel: 'info' as const,
};

describe('CLOCK', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('injects the system clock by default', async () => {
    const before = Date.now();
    app = await createApp(AppModule.forRoot(env));

    const now = app.get<Clock>(CLOCK).now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('injects the clock given to AppModule.forRoot, which advances without waiting', async () => {
    const clock = testClock('2026-11-03T12:00:00.000Z');
    app = await createApp(AppModule.forRoot(env, { clock }));

    const injected = app.get<Clock>(CLOCK);
    expect(injected.now().toISOString()).toBe('2026-11-03T12:00:00.000Z');

    // 30 days pass with no wait: the session expiry is proven without a timer.
    clock.advance(30 * 24 * 60 * 60 * 1000);
    expect(injected.now().toISOString()).toBe('2026-12-03T12:00:00.000Z');
  });

  it('hands out copies, so a caller cannot move the clock by mutating the answer', async () => {
    const clock = testClock('2026-11-03T12:00:00.000Z');
    app = await createApp(AppModule.forRoot(env, { clock }));

    const injected = app.get<Clock>(CLOCK);
    injected.now().setFullYear(1999);

    expect(injected.now().toISOString()).toBe('2026-11-03T12:00:00.000Z');
  });
});

import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts ok with the database up', () => {
    expect(healthResponseSchema.parse({ status: 'ok', db: 'up' })).toEqual({ status: 'ok', db: 'up' });
  });

  it('accepts degraded with the database down', () => {
    expect(healthResponseSchema.parse({ status: 'degraded', db: 'down' })).toEqual({
      status: 'degraded',
      db: 'down',
    });
  });

  it('rejects crossed combinations of status and db', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok', db: 'down' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ status: 'degraded', db: 'up' }).success).toBe(false);
  });

  it('rejects a body with a missing field', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ db: 'up' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({}).success).toBe(false);
  });

  it('rejects values outside the enum', () => {
    expect(healthResponseSchema.safeParse({ status: 'up', db: 'up' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ status: 'ok', db: 'ok' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ status: 'OK', db: 'UP' }).success).toBe(false);
  });
});

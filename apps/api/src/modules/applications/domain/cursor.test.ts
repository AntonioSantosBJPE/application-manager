import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';

const id = '0195f3a0-0000-7000-8000-000000000001';
const at = new Date('2026-11-03T12:00:00.123Z');
const raw = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

describe('applications cursor', () => {
  it('APP-15 round-trips rank, date and id', () => {
    expect(decodeCursor(encodeCursor({ rank: 3, at, id }))).toEqual({ rank: 3, at, id });
  });

  it('APP-15 is opaque base64url, not readable JSON', () => {
    const text = encodeCursor({ rank: 0, at, id });

    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(text).not.toContain('{');
  });

  it('APP-15 accepts rank 0 and rank 7', () => {
    expect(decodeCursor(raw({ rank: 0, at: at.toISOString(), id }))?.rank).toBe(0);
    expect(decodeCursor(raw({ rank: 7, at: at.toISOString(), id }))?.rank).toBe(7);
  });

  it('APP-17 rejects text that is not base64url', () => {
    expect(decodeCursor('not base64!')).toBeUndefined();
    expect(decodeCursor('')).toBeUndefined();
    expect(decodeCursor('abc+/=')).toBeUndefined();
  });

  it('APP-17 rejects base64url that is not JSON or not an object', () => {
    expect(decodeCursor(Buffer.from('not json', 'utf8').toString('base64url'))).toBeUndefined();
    expect(decodeCursor(raw(null))).toBeUndefined();
    expect(decodeCursor(raw('text'))).toBeUndefined();
    expect(decodeCursor(raw(7))).toBeUndefined();
  });

  it('APP-17 rejects a rank outside 0..7 or that is not an integer', () => {
    expect(decodeCursor(raw({ rank: -1, at: at.toISOString(), id }))).toBeUndefined();
    expect(decodeCursor(raw({ rank: 8, at: at.toISOString(), id }))).toBeUndefined();
    expect(decodeCursor(raw({ rank: 1.5, at: at.toISOString(), id }))).toBeUndefined();
    expect(decodeCursor(raw({ rank: '1', at: at.toISOString(), id }))).toBeUndefined();
    expect(decodeCursor(raw({ at: at.toISOString(), id }))).toBeUndefined();
  });

  it('APP-17 rejects a date that is invalid or not an ISO instant', () => {
    expect(decodeCursor(raw({ rank: 1, at: 'ontem', id }))).toBeUndefined();
    expect(decodeCursor(raw({ rank: 1, at: '2026-13-45T00:00:00.000Z', id }))).toBeUndefined();
    expect(decodeCursor(raw({ rank: 1, at: 12345, id }))).toBeUndefined();
    expect(decodeCursor(raw({ rank: 1, id }))).toBeUndefined();
  });

  it('APP-17 rejects an id that is not a uuid', () => {
    expect(decodeCursor(raw({ rank: 1, at: at.toISOString(), id: 'not-a-uuid' }))).toBeUndefined();
    expect(decodeCursor(raw({ rank: 1, at: at.toISOString(), id: 42 }))).toBeUndefined();
    expect(decodeCursor(raw({ rank: 1, at: at.toISOString() }))).toBeUndefined();
  });
});

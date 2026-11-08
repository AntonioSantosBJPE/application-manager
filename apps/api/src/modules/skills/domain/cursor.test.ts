import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';

const id = '0198a5b0-0000-7000-8000-000000000001';
const textOf = (value: unknown): string => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

describe('skill cursor', () => {
  it('SKL-37 decodes what encodeCursor wrote, including a key with + and #', () => {
    expect(decodeCursor(encodeCursor({ key: 'c++', id }))).toEqual({ key: 'c++', id });
    expect(decodeCursor(encodeCursor({ key: 'c#', id }))).toEqual({ key: 'c#', id });
    expect(decodeCursor(encodeCursor({ key: '', id }))).toEqual({ key: '', id });
  });

  it('SKL-37 refuses text that is not base64url, not JSON, or JSON without a text key and a uuid id', () => {
    expect(decodeCursor('not a cursor!')).toBeUndefined();
    expect(decodeCursor(Buffer.from('not json', 'utf8').toString('base64url'))).toBeUndefined();
    expect(decodeCursor(textOf('text'))).toBeUndefined();
    expect(decodeCursor(textOf(null))).toBeUndefined();
    expect(decodeCursor(textOf({ key: 'node' }))).toBeUndefined();
    expect(decodeCursor(textOf({ key: 'node', id: 'not-a-uuid' }))).toBeUndefined();
    expect(decodeCursor(textOf({ key: 5, id }))).toBeUndefined();
    expect(decodeCursor(textOf({ id }))).toBeUndefined();
  });
});

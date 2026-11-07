import { describe, expect, it } from 'vitest';
import { isUuid } from './ids.js';

describe('isUuid', () => {
  it('accepts a canonical uuid', () => {
    expect(isUuid('0199f0f4-0000-7000-8000-000000000000')).toBe(true);
  });

  it('refuses anything a uuid column would reject', () => {
    for (const value of ['', 'abc', 'not-an-id', '0199f0f4-0000-7000-8000', '0199f0f4000070008000 00000000000', "1' or '1'='1"]) {
      expect({ value, accepted: isUuid(value) }).toEqual({ value, accepted: false });
    }
  });
});

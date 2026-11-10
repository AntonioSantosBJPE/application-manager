import { describe, expect, it } from 'vitest';
import { isExactOrder } from './order.js';
import { isUuid } from './ids.js';

const a = '0195f3a0-0000-7000-8000-000000000001';
const b = '0195f3a0-0000-7000-8000-000000000002';
const c = '0195f3a0-0000-7000-8000-000000000003';
const stranger = '0195f3a0-0000-7000-8000-000000000009';

describe('exact order', () => {
  it('RES-27 refuses a list with an id missing', () => {
    expect(isExactOrder([a, b], [a, b, c])).toBe(false);
  });

  it('RES-27 refuses a list with an extra id', () => {
    expect(isExactOrder([a, b, c, stranger], [a, b, c])).toBe(false);
  });

  it('RES-27 refuses a repeated id even when the length matches', () => {
    expect(isExactOrder([a, a, b], [a, b, c])).toBe(false);
  });

  it('RES-27 refuses a stranger in place of an existing id', () => {
    expect(isExactOrder([a, b, stranger], [a, b, c])).toBe(false);
  });

  it('RES-27 refuses an id that is not a uuid', () => {
    expect(isExactOrder([a, b, 'não-é-uuid'], [a, b, c])).toBe(false);
  });

  it.each([
    [[a, b, c]],
    [[c, b, a]],
    [[b, c, a]],
    [[a, c, b]],
  ])('RES-25 accepts the permutation %j', (sent) => {
    expect(isExactOrder(sent, [a, b, c])).toBe(true);
  });

  it('RES-27 accepts an empty list for an empty section', () => {
    expect(isExactOrder([], [])).toBe(true);
  });

  it('RES-27 refuses an empty list for a section with items', () => {
    expect(isExactOrder([], [a])).toBe(false);
  });
});

describe('resume ids', () => {
  it('RES-14 tells a uuid from a text that is not one', () => {
    expect(isUuid(a)).toBe(true);
    expect(isUuid('não-é-uuid')).toBe(false);
  });
});

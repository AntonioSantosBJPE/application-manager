import { describe, expect, it } from 'vitest';
import { stageOccurredAt } from './stage-date';

describe('stageOccurredAt', () => {
  const now = new Date('2026-11-08T21:17:42.000Z');

  it('APP-72 turns today into `now`, so the stage follows the activity before it', () => {
    expect(stageOccurredAt('2026-11-08', now)).toBe('2026-11-08T21:17:42.000Z');
  });

  it('APP-72 reads "today" in São Paulo, where 01:00 UTC is still the previous evening', () => {
    expect(stageOccurredAt('2026-11-08', new Date('2026-11-09T01:00:00.000Z'))).toBe('2026-11-09T01:00:00.000Z');
    expect(stageOccurredAt('2026-11-09', new Date('2026-11-09T01:00:00.000Z'))).toBe('2026-11-09T15:00:00.000Z');
  });

  it('APP-72 turns any other day into 12:00 in São Paulo', () => {
    expect(stageOccurredAt('2026-11-05', now)).toBe('2026-11-05T15:00:00.000Z');
    expect(stageOccurredAt('2026-01-31', now)).toBe('2026-01-31T15:00:00.000Z');
  });
});

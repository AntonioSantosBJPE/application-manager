import { describe, expect, it } from 'vitest';
import { DEFAULT_APPLICATIONS_FILTERS } from './filters';
import { listInputOf } from './list-query';

describe('listInputOf', () => {
  it('APP-46 asks only for the tab and the sort when nothing else is filtered', () => {
    expect(listInputOf(DEFAULT_APPLICATIONS_FILTERS)).toEqual({ tab: 'active', sort: 'activity' });
  });

  it('APP-46 sends every filter as the contract reads it: lists comma separated, the text and the cursor', () => {
    expect(
      listInputOf(
        {
          ...DEFAULT_APPLICATIONS_FILTERS,
          tab: 'closed',
          status: ['rejected', 'ghosted'],
          level: ['mid', 'senior'],
          workModel: ['remote'],
          q: 'nest',
          sort: 'created',
        },
        'cursor-1',
      ),
    ).toEqual({
      tab: 'closed',
      sort: 'created',
      status: 'rejected,ghosted',
      level: 'mid,senior',
      workModel: 'remote',
      q: 'nest',
      cursor: 'cursor-1',
    });
  });
});

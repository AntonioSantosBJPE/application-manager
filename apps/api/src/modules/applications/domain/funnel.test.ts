import { describe, expect, it } from 'vitest';
import { funnelRank, statusesOf, tabOf } from './funnel.js';

describe('funnel', () => {
  it('APP-14 ranks the statuses offer, interviewing, applied, saved, accepted, rejected, withdrawn, ghosted', () => {
    const order = ['offer', 'interviewing', 'applied', 'saved', 'accepted', 'rejected', 'withdrawn', 'ghosted'] as const;

    expect(order.map(funnelRank)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('APP-11 puts saved, applied, interviewing and offer in the active tab and the other four in the closed one', () => {
    expect((['saved', 'applied', 'interviewing', 'offer'] as const).map(tabOf)).toEqual(['active', 'active', 'active', 'active']);
    expect((['accepted', 'rejected', 'withdrawn', 'ghosted'] as const).map(tabOf)).toEqual(['closed', 'closed', 'closed', 'closed']);
  });

  it('APP-11 lists the statuses of each tab in funnel order', () => {
    expect(statusesOf('active')).toEqual(['offer', 'interviewing', 'applied', 'saved']);
    expect(statusesOf('closed')).toEqual(['accepted', 'rejected', 'withdrawn', 'ghosted']);
  });
});

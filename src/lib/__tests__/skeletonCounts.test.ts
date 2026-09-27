// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  myCandidatesLayoutKey,
  readCachedLayout,
  readMyCandidatesColdLayout,
  writeCachedLayout,
  writeMyCandidatesColdLayout,
} from '@/lib/skeletonCounts';

describe('candidate board skeleton layout cache', () => {
  beforeEach(() => localStorage.clear());

  it('keeps resolved layouts isolated per user and list', () => {
    const first = myCandidatesLayoutKey('user-a', 'list-a');
    const second = myCandidatesLayoutKey('user-a', 'list-b');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (!first || !second) return;

    writeCachedLayout(first, [2, 0, 0, 0, 0, 0]);
    writeCachedLayout(second, [0, 1, 0, 0]);

    expect(readCachedLayout(first)).toEqual([2, 0, 0, 0, 0, 0]);
    expect(readCachedLayout(second)).toEqual([0, 1, 0, 0]);
  });

  it('provides the last resolved board before auth has restored the user', () => {
    writeMyCandidatesColdLayout([2, 0, 0, 0, 0, 0]);
    expect(readMyCandidatesColdLayout()).toEqual([2, 0, 0, 0, 0, 0]);
  });
});
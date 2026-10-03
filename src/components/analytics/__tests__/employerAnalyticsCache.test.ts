import { describe, expect, it } from 'vitest';
import { getEmployerAnalyticsCacheKey } from '../employerAnalyticsCache';

describe('organization-scoped analytics snapshots', () => {
  it('separates the same user and period across organizations', () => {
    const first = getEmployerAnalyticsCacheKey('team', 'recruiter', 30, 'company-a');
    const second = getEmployerAnalyticsCacheKey('team', 'recruiter', 30, 'company-b');
    expect(first).not.toBe(second);
  });

  it('separates personal reports, periods and report families', () => {
    const overview = getEmployerAnalyticsCacheKey('overview', 'recruiter', 30, null);
    expect(overview).not.toBe(getEmployerAnalyticsCacheKey('overview', 'recruiter', 7, null));
    expect(overview).not.toBe(getEmployerAnalyticsCacheKey('advanced', 'recruiter', 30, null));
    expect(overview).not.toBe(getEmployerAnalyticsCacheKey('overview', 'recruiter', 30, 'company-a'));
  });
});
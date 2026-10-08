import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
describe('confirmed application return', () => {
  const job = readFileSync('src/pages/JobView.tsx', 'utf8');
  const wizard = readFileSync('src/components/ApplicationQuestionsWizard.tsx', 'utf8');
  it('starts a separate detail view for each job in both account layouts', () => {
    const index = readFileSync('src/pages/Index.tsx', 'utf8');
    expect(index.match(/<JobView key=\{location.pathname\} asOverlay \/>/g)).toHaveLength(2);
    expect(index).not.toContain('<JobView asOverlay />');
  });
  it('preserves the index search alias instead of mounting a new search page', () => {
    expect(job).toContain("applicationBackground === '/index' ? '/index' : '/search-jobs'");
    expect(job).toContain('navigate(applicationReturnPath, { replace: true })');
    expect(job).not.toContain("setTimeout(() => { navigate('/search-jobs'); }, 1500)");
  });
  it('updates confirmed applied IDs and cancels pending return navigation', () => {
    expect(job).toContain('await queryClient.cancelQueries({ queryKey: appliedKey })');
    expect(job).toContain('new Set([...(previous ?? []), jobId])');
    expect(job).toContain('window.clearTimeout(successTimer)');
    expect(job).toContain('window.clearTimeout(returnTimer)');
  });
  it('reserves success geometry and respects reduced motion', () => {
    expect(job).not.toContain('mobile ? 900 : 1500');
    expect(job).toContain('mobile ? 0 : 1500');
    expect(wizard).toContain('justApplied && preserveSubmissionLayout');
    expect(wizard).toContain('!hasAlreadyApplied || retainSubmittedControls');
    expect(wizard).toContain("justApplied ? ' invisible inline-flex items-center justify-center' : ' hidden'");
    expect(wizard).toContain('(!hasAlreadyApplied || justApplied) && profileSelector');
    expect(job).toContain('(prefers-reduced-motion: reduce)');
    expect(job).toContain("transform ${applicationReturnMs}ms cubic-bezier(0.32, 0.72, 0.24, 1)");
    expect(job).toContain('Math.min(420, Math.max(320, distance * 0.45))');
    expect(job).toContain("'translate3d(0, 100%, 0)'");
    expect(wizard).toContain("hasAlreadyApplied && !justApplied ? ' hidden' : ''");
    expect(wizard).toContain("justApplied ? ' pointer-events-none' : ''");
  });
});
describe('application status freshness', () => {
  it('never treats a restored or old applied list as "not applied"', async () => {
    const { readFileSync } = await import('node:fs');
    const job = readFileSync('src/pages/JobView.tsx', 'utf8');
    const sync = readFileSync('src/hooks/useJobSeekerBackgroundSync.ts', 'utf8');
    expect(job).toContain('appliedJobIdsFetchedNow && isFetchedSinceResume(appliedJobIdsUpdatedAt)');
    expect(job).not.toContain('|| appliedJobIdsFetched ||');
    expect(job).toContain('freshJobCacheEntry(cacheKey)');
    expect(sync).not.toContain("setQueryData(['applied-job-ids'");
  });
});

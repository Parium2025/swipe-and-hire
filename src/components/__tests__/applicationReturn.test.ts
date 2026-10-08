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
    expect(wizard).toContain("justApplied ? ' invisible inline-flex items-center justify-center' : ' hidden'");
    expect(wizard).toContain('(!hasAlreadyApplied || justApplied) && profileSelector');
    expect(job).toContain('(prefers-reduced-motion: reduce)');
    expect(job).toContain("transform 360ms cubic-bezier(0.32, 0.72, 0.24, 1)");
    expect(job).toContain("'translate3d(0, 100%, 0)'");
    expect(wizard).toContain("hasAlreadyApplied && !justApplied ? ' hidden' : ''");
    expect(wizard).toContain("justApplied ? ' pointer-events-none' : ''");
  });
});
describe('ingen mellanbildruta med "Redan sökt"', () => {
  it('markerar Nyss sökt innan listans sökt-cache uppdateras', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/pages/JobView.tsx', 'utf8');
    const first = src.indexOf('setJustApplied(true)');
    const cache = src.indexOf("const appliedKey = ['applied-job-ids'");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(cache);
  });
});

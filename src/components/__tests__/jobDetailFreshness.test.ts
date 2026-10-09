import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/pages/JobView.tsx', 'utf8');

describe('job detail freshness safeguards', () => {
  it('revalidates open details on visible return, reconnect and bfcache restoration', () => {
    expect(source).not.toContain("document.addEventListener('visibilitychange', visible)");
    expect(source).toContain('if (!hasLoadedOnce.current) setLoading(true);');
    expect(source).toContain('stepMemoryKey=');
    expect(source).toContain('window.addEventListener(APP_RESUME_EVENT, refresh)');
    expect(source).toContain("window.addEventListener('online', refresh)");
    expect(source).toContain('if (event.persisted) refresh()');
    expect(source).toContain('contentRef.current.scrollTop = resumeScroll.current');
  });
  it('scopes complete detail data and validated drafts to the account', () => {
    expect(source).toContain("`${user?.id ?? 'public'}:${jobId}`");
    expect(source).toContain("`job-answers-draft-${user?.id ?? 'public'}-${jobId}`");
    expect(source).toContain('safeReadJsonCache<Record<string, any>>(draftKey');
    expect(source).not.toContain('getPrefetchedJob(');
    expect(source).not.toContain('return navigationImageState.initialHeroImageUrl');
  });
  it('ignores obsolete reads and never revokes a confirmed application', () => {
    expect(source).toContain('activeScope.current === cacheKey && requestGeneration.current === generation');
    expect(source).toContain('setHasAlreadyApplied(previous => previous || applied)');
    expect(source).toContain('if (user && applicationResult.error) throw applicationResult.error');
    expect(source).toContain('if (user && questionsResult.error) throw questionsResult.error');
    expect(source).toContain('cached?.statusChecked ? cached.at : 0');
  });
  it('refreshes and clears media rather than retaining obsolete logo URLs', () => {
    expect(source).toContain('setCompanyLogoUrl(cachedLogoBlob || resolvedLogo)');
    expect(source).toContain('else { setCompanyLogoUrl(null); }');
    expect(source).toContain('setImageUrl(null); setCanonicalImageUrl(null)');
    expect(source).not.toContain("company_logo_url.trim().split('?')[0]");
  });
});
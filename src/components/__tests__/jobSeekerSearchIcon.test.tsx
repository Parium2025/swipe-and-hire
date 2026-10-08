import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('search header follows the underlying page', () => {
  const layout = readFileSync('src/components/JobSeekerLayout.tsx', 'utf8');
  it('hides search for both search routes, including overlays', () => {
    expect(layout).toContain('const pagePath = activePagePath ?? location.pathname');
    expect(layout).toContain("pagePath === '/search-jobs' || pagePath === '/index'");
    expect(layout).toContain('{!isSearchPage && (');
    expect(layout).not.toContain("{location.pathname !== '/search-jobs' && (");
  });
  it('receives the same page key as the preserved search view', () => {
    const index = readFileSync('src/pages/Index.tsx', 'utf8');
    expect(index).toContain('activePagePath={activeKeepKey}');
    expect(index).toContain('activeKey={activeKeepKey}');
    expect(index).toContain('const activeKeepKey = isJobViewOverlay ? lastJobSeekerPathRef.current : location.pathname');
  });
});
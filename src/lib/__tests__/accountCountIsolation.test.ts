import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('kontosiffror vid kallstart och byte', () => {
  it('läser inte en annan användares notiser innan identiteten är känd', () => {
    const hook = source('src/hooks/useNotifications.ts');
    expect(hook).not.toContain('getCachedBeforeAuth');
    expect(hook).toContain('env.userId === userId');
  });

  it('låter inte gamla olästa chattar visas medan nästa konto laddar', () => {
    for (const path of ['EmployerTopNav', 'EmployerSidebar', 'JobSeekerTopNav', 'AppSidebar']) {
      const component = source(`src/components/${path}.tsx`);
      expect(component).toMatch(/user && conversationsCtx && !conversationsCtx\.isLoading\s*\? conversationsCtx\.totalUnreadCount\s*:\s*0/);
    }
  });

  it('rensar både siffercacher och aktiva startvärden vid utloggning', () => {
    const cleanup = source('src/hooks/useEagerRatingsPreload.ts');
    const auth = source('src/hooks/useAuth.tsx');
    for (const key of ['parium_total_jobs', 'parium_my_applications_persist', 'parium_employer_my_jobs', 'parium_employer_candidates', 'parium_my_candidates']) {
      expect(cleanup).toContain(`'${key}'`);
    }
    const clearState = auth.slice(auth.indexOf('const clearLocalState = () => {'), auth.indexOf('    try {\n      setAuthAction(\'logout\');'));
    expect(clearState).toContain('setPreloadedEmployerMyJobs(0);');
    expect(clearState).toContain('setPreloadedMyApplications(0);');
  });

  it('skriver personliga annonsräknare bara under aktuell användares nyckel', () => {
    const dashboard = source('src/components/EmployerDashboard.tsx');
    expect(dashboard).toContain('`emp_total_jobs:${user.id}`');
    expect(dashboard).not.toContain("cacheKey: 'emp_total_jobs'");
  });

  it('nollställer jobbsökarens sparade sökningar och jobb innan nästa konto är verifierat', () => {
    const searches = source('src/hooks/useSavedSearches.ts');
    const jobs = source('src/hooks/useSavedJobs.ts');

    expect(searches).toContain('setSavedSearches(cached ?? []);');
    expect(searches).toContain('setTotalNewMatches((cached ?? []).reduce');
    expect(searches).toContain('activeUserIdRef.current !== requestedUserId');
    expect(jobs).toContain('setSavedJobIds(cached ?? new Set());');
    expect(jobs).toContain('activeUserIdRef.current !== requestedUserId');
    expect(jobs).not.toContain('hasInitialized.current');
  });

  it('håller anteckningsverktygets aktiva markeringsring helt rund', () => {
    const editor = source('src/components/RichNotesEditor.tsx');
    expect(editor).toContain('aspect-square rounded-full caret-transparent');
    expect(editor).not.toContain('justify-center rounded-xl caret-transparent');
  });
});
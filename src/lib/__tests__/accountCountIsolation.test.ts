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
    expect(editor).toContain('aspect-square rounded-full border border-transparent caret-transparent');
    expect(editor).not.toContain('justify-center rounded-xl caret-transparent');
    expect(editor).not.toContain(': "border border-transparent"');
    expect(editor).toContain('isActive && "bg-white/20"');
    expect(editor).not.toContain('isActive && "bg-white/30 ring-1 ring-white/40 shadow-sm"');
  });

  it('visar inte föregående kontos olästa antal i webbläsarfliken', () => {
    const title = source('src/hooks/useDocumentTitle.ts');
    const auth = source('src/hooks/useAuth.tsx');

    expect(title).toContain('employerCountsReadyUserId === user.id');
    expect(title).toContain('seekerCountsReadyUserId === user.id');
    expect(title).toContain('countsReady && preloadedUnreadMessages > 0');
    expect(title).toContain('countsReady && preloadedJobSeekerUnreadMessages > 0');
    const accountSwitch = auth.slice(auth.indexOf('if (cachedBelongsToOther) {'), auth.indexOf('// 🧹 Reset transient flags'));
    expect(accountSwitch).toContain('setPreloadedUnreadMessages(0);');
    expect(accountSwitch).toContain('setPreloadedJobSeekerUnreadMessages(0);');
    expect(accountSwitch).toContain('localStorage.removeItem(UNREAD_MESSAGES_CACHE_KEY);');
    expect(accountSwitch).toContain('localStorage.removeItem(JOB_SEEKER_UNREAD_MESSAGES_CACHE_KEY);');
  });

  it('håller chattens bild- och meddelanderendering lätt under scroll', () => {
    const avatars = source('src/components/messages/ConversationAvatar.tsx');
    const bubbles = source('src/components/messages/MessageBubble.tsx');
    const chat = source('src/components/messages/ChatView.tsx');
    const conversations = source('src/hooks/useConversations.ts');
    const media = source('src/hooks/useMediaUrl.ts');

    expect(avatars).toContain('memo(function ConversationAvatar');
    expect(avatars).toContain('MAX_LOADED_AVATAR_URLS');
    expect(bubbles).toContain('memo(function MessageBubble');
    expect(chat).toContain('const displayMessages = useMemo');
    expect(chat).toContain('scrollFrameRef.current = requestAnimationFrame');
    expect(conversations).toContain('repairedResult.slice(0, 12).forEach');
    expect(conversations).toContain('if (conv.is_muted === isMuted && conv.unread_count === unread) return conv;');
    expect(media).not.toContain('await decodeFully');
    const swipeRow = source('src/components/messages/SwipeableConversationItem.tsx');
    expect(swipeRow).not.toContain("style={{ transform: 'translate3d(0,0,0)' }}");
    expect(swipeRow).toContain("contentRef.current.style.willChange = 'transform';");
    expect(swipeRow).toContain("content.style.transform = '';");
  });
});
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clearAutoReadSuppression, type Conversation } from '@/hooks/useConversations';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewConversationDialog } from '@/components/NewConversationDialog';
import { ConversationItem } from '@/components/messages/ConversationItem';
import { SwipeableConversationItem } from '@/components/messages/SwipeableConversationItem';
import { ChatView } from '@/components/messages/ChatView';
import { EmptyConversationList, EmptyChatState } from '@/components/messages/EmptyStates';
import { MessagesTabs, type ConversationTab } from '@/components/MessagesTabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDeleteConversation } from '@/hooks/useDeleteConversation';
import { useMarkConversationUnread } from '@/hooks/useMarkConversationUnread';
import { useBlockConversation, useBlockedUsers } from '@/hooks/useBlockConversation';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { prefetchConversationMessages } from '@/hooks/useConversations';
import { getConversationDisplayName, resolveDisplayMember } from '@/lib/conversationDisplayUtils';
import {
  MessageSquare,
  Plus,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmployerMessagesSkeleton } from '@/components/employer/EmployerPageSkeleton';
import { writeCachedCount, SKELETON_COUNT_KEYS } from '@/lib/skeletonCounts';


const TAB_STORAGE_KEY = 'parium:messages:tab';

// Längden på chattens in-/utglidning på mobil (iOS-lik kurva nedan).
const MOBILE_SLIDE_MS = 320;

function readStoredTab(): ConversationTab | null {
  try {
    const value = localStorage.getItem(TAB_STORAGE_KEY);
    return value === 'candidates' || value === 'colleagues' ? value : null;
  } catch {
    return null;
  }
}

export default function Messages() {
  const { user, userRole } = useAuth();

  // Läs från delad context — en enda global subscription körs i ConversationsProvider
  const conversationsCtx = useConversationsContext();
  const conversations = conversationsCtx?.conversations ?? [];
  const isLoading = conversationsCtx?.isLoading ?? false;
  const hasError = conversationsCtx?.isError ?? false;
  const hasMoreConversations = conversationsCtx?.hasMoreConversations ?? false;
  const loadingMoreConversations = conversationsCtx?.loadingMoreConversations ?? false;
  const loadMoreConversations = conversationsCtx?.loadMoreConversations ?? (async () => {});

  const refetch = conversationsCtx?.refetch ?? (() => {});


  // Instant render when conversations are already cached, fade-in only on cold load
  const [showContentFade, setShowContentFade] = useState(() => !isLoading);
  const dataWasCached = useRef(!isLoading);
  useEffect(() => {
    if (!isLoading && !showContentFade) {
      if (dataWasCached.current) {
        setShowContentFade(true);
      } else {
        const timer = setTimeout(() => setShowContentFade(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, showContentFade]);

  // Cacha antalet så skeleton kan rendera exakt lika många rader nästa cold-load.
  useEffect(() => {
    if (!isLoading) writeCachedCount(SKELETON_COUNT_KEYS.messages, conversations.length);
  }, [isLoading, conversations.length]);

  const { deleteConversation, isDeleting } = useDeleteConversation();
  const { markAsUnread } = useMarkConversationUnread();
  const { data: blockedUsers = [] } = useBlockedUsers();
  const { unblockUser, isUnblocking } = useBlockConversation();
  const blockedIds = blockedUsers.map((b) => b.blocked_id);
  const { data: blockedNames = {} } = useQuery({
    queryKey: ['blocked-user-names', blockedIds.join(',')],
    enabled: blockedIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      // Visningsnamn hämtas via låst databasfunktion – råa profilrader är inte
      // längre läsbara för andra användare (känsliga fält får aldrig läcka).
      const { data, error } = await supabase
        .rpc('get_chat_member_profiles', { _user_ids: blockedIds });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p) => {
        const name =
          p.role === 'employer' && p.company_name
            ? p.company_name
            : `${p.first_name || ''} ${p.last_name || ''}`.trim();
        map[p.user_id] = name || 'Användare';
      });
      return map;
    },
  });
  const { hasTeam } = useTeamMembers();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [activeTab, setActiveTab] = useState<ConversationTab>(() => readStoredTab() ?? 'candidates');

  const handleTabChange = (tab: ConversationTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      /* privat läge — ignorera */
    }
  };
  const handledDeepLinkRef = useRef<string | null>(null);
  const tabSwipeStartX = useRef<number | null>(null);
  const isMobile = useIsMobile();

  // Oändlig scroll i konversationslistan — hämtar nästa fönster i god tid
  // innan användaren når botten (rootMargin), så listan känns obruten.
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !hasMoreConversations) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMoreConversations();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreConversations, loadMoreConversations, loadingMoreConversations]);


  // Handle deep-link: /messages?conversation=<id>
  useEffect(() => {
    const conversationParam = searchParams.get('conversation');
    if (!conversationParam) {
      handledDeepLinkRef.current = null;
      return;
    }
    if (conversationParam && conversations.length > 0 && handledDeepLinkRef.current !== conversationParam) {
      const exists = conversations.some(c => c.id === conversationParam);
      if (exists) {
        setSelectedConversationId(conversationParam);
        setShowMobileChat(true);
        handledDeepLinkRef.current = conversationParam;
        setSearchParams({}, { replace: true });
        return;
      }
      // Chatten kan ligga utanför det laddade fönstret — hämta fler innan vi
      // ger upp, annars händer ingenting när man klickar på en notis.
      if (hasMoreConversations) {
        void loadMoreConversations();
        return;
      }
      if (!isLoading) {
        handledDeepLinkRef.current = conversationParam;
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, conversations, setSearchParams, hasMoreConversations, loadMoreConversations, isLoading]);

  // Empty-state alignment refs (desktop split view)
  const leftEmptyIconRef = useRef<HTMLDivElement | null>(null);
  const rightEmptyIconRef = useRef<HTMLDivElement | null>(null);
  const rightEmptyPanelRef = useRef<HTMLDivElement | null>(null);
  const leftEmptyContentRef = useRef<HTMLDivElement | null>(null);
  const rightEmptyContentRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Kategorisering: databasens `kind` är facit. Äldre samtal saknar värdet
  // och faller tillbaka på rollerna hos övriga deltagare.
  const categorizeConversation = (conv: Conversation): 'candidates' | 'colleagues' => {
    if (conv.kind === 'internal') return 'colleagues';
    const otherMembers = (conv.members || []).filter(m => m.user_id !== user?.id);
    const roles = otherMembers.map(m => m.profile?.role).filter(Boolean);
    if (roles.includes('job_seeker')) return 'candidates';
    if (roles.includes('employer') && !conv.candidate_id && !conv.application_id) return 'colleagues';
    return 'candidates';
  };

  const candidateConversations = conversations.filter(c => categorizeConversation(c) === 'candidates');
  const colleagueConversations = conversations.filter(c => categorizeConversation(c) === 'colleagues');

  // Öppnas ett samtal från annan flik (deep-link/ny chatt) — hoppa dit automatiskt
  // så att listan aldrig ser tom ut medan chatten är öppen.
  useEffect(() => {
    if (!hasTeam || !selectedConversation) return;
    const category = categorizeConversation(selectedConversation);
    setActiveTab((prev) => (prev === category ? prev : category));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, hasTeam]);

  const candidateUnread = candidateConversations.reduce((sum, c) => sum + c.unread_count, 0);
  const colleagueUnread = colleagueConversations.reduce((sum, c) => sum + c.unread_count, 0);

  const handleConversationCreated = (conversationId: string) => {
    refetch();
    setSelectedConversationId(conversationId);
    setShowMobileChat(true);
  };

  // Filter conversations based on tab and search
  // OBS: Tabs visas bara när hasTeam=true (arbetsgivare med team).
  // För jobbsökare/solo-arbetsgivare visas alltid ALLA konversationer,
  // annars kan kategorisering filtrera bort giltiga chattar.
  const getConversationsForTab = () => {
    if (!hasTeam) return conversations;
    switch (activeTab) {
      case 'candidates': return candidateConversations;
      case 'colleagues': return colleagueConversations;
      default: return conversations;
    }
  };

  const filteredConversations = getConversationsForTab().filter(conv => {
    if (!searchQuery.trim()) return true;
    // Alla sökord måste finnas någonstans — ordningen spelar ingen roll
    // ("andits fredrik" hittar "Fredrik Andits").
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

    const snapshot = conv.applicationSnapshot;
    const memberNames = conv.members
      .filter(m => m.user_id !== user?.id)
      .map(m => {
        const p = m.profile;
        if (!p) return '';
        if (p.role === 'employer' && p.company_name) return p.company_name;
        return `${p.first_name || ''} ${p.last_name || ''}`;
      })
      .join(' ');

    const haystack = [
      conv.name || '',
      snapshot ? `${snapshot.first_name || ''} ${snapshot.last_name || ''}` : '',
      snapshot?.job_title || '',
      memberNames,
      conv.job?.title || '',
      conv.last_message?.content || '',
    ].join(' ').toLowerCase();

    return terms.every(term => haystack.includes(term));
  });


  const showEmptyConversationList = filteredConversations.length === 0;
  const showEmptyChatState = !selectedConversation;

  const queryClient = useQueryClient();

  const handleSelectConversation = (convId: string) => {
    clearAutoReadSuppression(convId);
    setSelectedConversationId(convId);
    setShowMobileChat(true);
  };

  // Förvärm de översta trådarna när listan står stilla — då är chatten redan
  // målad när man klickar, i stället för att ladda in vid varje byte.
  const prewarmKey = filteredConversations.slice(0, 6).map((c) => c.id).join('|');
  useEffect(() => {
    if (!prewarmKey) return;
    const ids = prewarmKey.split('|').filter(Boolean);
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

    const ric = (globalThis as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    });
    const run = () => ids.forEach((id) => prefetchConversationMessages(queryClient, id));
    if (typeof ric.requestIdleCallback === 'function') {
      const id = ric.requestIdleCallback(run, { timeout: 1200 });
      return () => ric.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 400);
    return () => window.clearTimeout(t);
  }, [prewarmKey, queryClient]);

  // Chatten glider ut åt höger på mobil. Konversationen får därför inte
  // nollställas direkt — då hade panelen varit tom under utglidningen.
  const backTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (backTimerRef.current) window.clearTimeout(backTimerRef.current);
  }, []);

  const handleBackToList = () => {
    setShowMobileChat(false);
    if (!isMobile) return;
    if (backTimerRef.current) window.clearTimeout(backTimerRef.current);
    backTimerRef.current = window.setTimeout(() => {
      setSelectedConversationId(null);
      backTimerRef.current = null;
    }, MOBILE_SLIDE_MS);
  };

  // Visa skelett när context fortfarande hämtar och vi saknar cachad data
  const hasData = conversations.length > 0;
  const showSkeleton = isLoading && !hasData;

  if (!showContentFade) {
    return (
      <div className="flex-1 min-h-0 flex flex-col opacity-0 messages-container overflow-x-hidden">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  if (showSkeleton) {
    return <EmployerMessagesSkeleton audience={userRole === 'employer' ? 'employer' : 'job_seeker'} />;
  }


  return (
    <div className="flex-1 min-h-0 flex flex-col messages-container overflow-x-hidden">
      {/* Header — kollapsar mjukt i takt med att chatten glider in på mobil */}
      <div
        className={cn(
          "flex-shrink-0 overflow-hidden",
          !isMobile && "max-h-none opacity-100 mb-4",
          "transition-[max-height,opacity,margin] ease-[cubic-bezier(0.32,0.72,0,1)]",
          isMobile && (showMobileChat ? "max-h-0 opacity-0 mb-0" : "max-h-24 opacity-100 mb-4")
        )}
        style={{ transitionDuration: `${MOBILE_SLIDE_MS}ms` }}
        aria-hidden={showMobileChat && isMobile}
      >
        <div className="flex items-center justify-center relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Chattar</h1>
          </div>

        </div>

        {hasTeam && (
          <Button
            variant="glass"
            onClick={() => setShowNewConversation(true)}
            className="absolute right-0 bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Ny konversation</span>
            <span className="sm:hidden">Ny</span>
          </Button>
        )}
        </div>
      </div>

      {/* Main content - Split view on desktop, stacked on mobile */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Mobil: lista och chatt ligger sida vid sida i ett spår som glider.
            Desktop: oförändrad delad vy. */}
        <div
          data-messages-track
          className={cn(
            "flex h-full min-h-0",
            !isMobile && "gap-4",
            isMobile && "w-full transform-gpu transition-transform ease-[cubic-bezier(0.32,0.72,0,1)]"
          )}
          style={
            isMobile
              ? {
                  transitionDuration: `${MOBILE_SLIDE_MS}ms`,
                  transform: showMobileChat ? 'translateX(-100%)' : 'translateX(0)',
                }
              : undefined
          }
        >
        {/* Conversation List */}
        <div className={cn(
          "flex-shrink-0 flex flex-col",
          isMobile ? "w-full" : "w-80 lg:w-96"
        )}>
          <div className="flex-shrink-0">
            {hasTeam ? (
              <div
                onTouchStart={(e) => { tabSwipeStartX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  const start = tabSwipeStartX.current;
                  tabSwipeStartX.current = null;
                  if (start === null) return;
                  const delta = e.changedTouches[0].clientX - start;
                  if (Math.abs(delta) < 50) return;
                  handleTabChange(delta < 0 ? 'colleagues' : 'candidates');
                }}
              >
                <MessagesTabs
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  candidateUnread={candidateUnread}
                  colleagueUnread={colleagueUnread}
                />
              </div>
            ) : null}

            <div className="relative mb-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök efter chattar..."
                className="bg-white/5 border-white/10 text-pure-white placeholder:text-pure-white"
              />
            </div>

            {blockedUsers.length > 0 && (
              <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs font-semibold text-white">
                  Blockerade ({blockedUsers.length}) — deras meddelanden når dig inte
                </p>
                <div className="flex flex-col gap-1.5">
                  {blockedUsers.map((block) => (
                    <div key={block.id} className="flex min-w-0 items-center justify-between gap-2 overflow-hidden">
                      <span className="block min-w-0 flex-1 truncate text-xs text-white">
                        {blockedNames[block.blocked_id] || 'Användare'}
                      </span>
                      <button
                        type="button"
                        onClick={() => unblockUser(block.blocked_id)}
                        disabled={isUnblocking}
                        className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-white transition-colors disabled:opacity-50 md:hover:bg-white/20"
                      >
                        Häv
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>


          {/* Conversation list */}
          <div className="relative flex-1 overflow-hidden rounded-xl bg-white/5 border border-white/10">
            {showEmptyConversationList ? (
              <div className="h-full flex items-center justify-center">
                <EmptyConversationList
                  hasSearch={!!searchQuery.trim()}
                  hasError={hasError}
                  onRetry={() => { void refetch(); }}
                  iconRef={leftEmptyIconRef}
                  contentRef={leftEmptyContentRef}
                />
                {/* Sökning ska nå hela historiken — fortsätt hämta fönster
                    även när det aktuella fönstret inte gav träff. */}
                {hasMoreConversations && !!searchQuery.trim() && (
                  <div ref={loadMoreSentinelRef} className="absolute bottom-0 h-px w-full" aria-hidden="true" />
                )}
              </div>
            ) : (
              <ScrollArea className="h-full w-full min-w-0 max-w-full overflow-x-hidden no-chrome-pad [&_[data-radix-scroll-area-viewport]]:overflow-x-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!w-full [&_[data-radix-scroll-area-viewport]>div]:!min-w-0 [&_[data-radix-scroll-area-viewport]>div]:!max-w-full">
                <div className="w-full min-w-0 overflow-hidden p-2 pb-[max(var(--chrome-strip-pad),0.5rem)]">
                  {filteredConversations.map((conv, index) => {
                    const isLast = index === filteredConversations.length - 1;
                    const { displayMember, isSelf } = resolveDisplayMember(conv.members, user?.id);

                    const displayName = getConversationDisplayName({
                      isGroup: conv.is_group,
                      groupName: conv.name,
                      snapshot: conv.applicationSnapshot,
                      displayMember,
                      isSelf,
                      lastMessage: conv.last_message,
                      counterpartPersonSenderId: conv.counterpart_person_sender_id,
                    });

                    return (
                      <div
                        key={conv.id}
                        className="w-full min-w-0 max-w-full overflow-hidden"
                        onPointerEnter={() => prefetchConversationMessages(queryClient, conv.id)}
                        onPointerDown={() => prefetchConversationMessages(queryClient, conv.id)}
                      >
                        <SwipeableConversationItem
                          canMarkUnread={conv.unread_count === 0 && !!conv.last_message}
                          onMarkUnread={() => {
                            markAsUnread(conv.id);
                            if (selectedConversationId === conv.id) {
                              setSelectedConversationId(null);
                              setShowMobileChat(false);
                            }
                          }}
                          onDelete={() => {
                            deleteConversation(conv.id);
                            if (selectedConversationId === conv.id) {
                              setSelectedConversationId(null);
                              setShowMobileChat(false);
                            }
                          }}
                          isDeleting={isDeleting}
                          conversationName={displayName}
                        >
                          <ConversationItem
                            conversation={conv}
                            isSelected={selectedConversationId === conv.id && (!isMobile || showMobileChat)}
                            currentUserId={user?.id || ''}
                            onClick={() => handleSelectConversation(conv.id)}
                            category={categorizeConversation(conv)}
                          />
                        </SwipeableConversationItem>
                        {!isLast && <div aria-hidden="true" className="mx-3 h-px bg-white/20" />}
                      </div>
                    );
                  })}

                  {/* Oändlig lista: laddar nästa 300 innan användaren nått botten */}
                  {hasMoreConversations && !searchQuery.trim() && (
                    <div ref={loadMoreSentinelRef} className="flex justify-center py-4">
                      {loadingMoreConversations && (
                        <span className="text-xs text-white/70">Laddar fler chattar…</span>
                      )}
                    </div>
                  )}

                </div>

              </ScrollArea>
            )}
          </div>
        </div>

        {/* Chat View */}
        <div className={cn(
          "flex flex-col min-w-0",
          isMobile ? "w-full flex-shrink-0" : "flex-1"
        )}>
          {selectedConversation ? (
            <ChatView
              key={selectedConversation.id}
              conversation={selectedConversation}
              currentUserId={user?.id || ''}
              onBack={handleBackToList}
              currentUserRole={(userRole?.role as 'job_seeker' | 'employer') || null}
              category={categorizeConversation(selectedConversation)}
            />
          ) : (
            <EmptyChatState
              iconRef={rightEmptyIconRef}
              containerRef={rightEmptyPanelRef}
              contentRef={rightEmptyContentRef}
            />
          )}
        </div>
        </div>
      </div>

      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}

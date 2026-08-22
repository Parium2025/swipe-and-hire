import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type Conversation } from '@/hooks/useConversations';
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
import { useBlockConversation, useBlockedUsers } from '@/hooks/useBlockConversation';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
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
  const totalUnreadCount = conversationsCtx?.totalUnreadCount ?? 0;
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
  const { data: blockedUsers = [] } = useBlockedUsers();
  const { unblockUser, isUnblocking } = useBlockConversation();
  const blockedIds = blockedUsers.map((b) => b.blocked_id);
  const { data: blockedNames = {} } = useQuery({
    queryKey: ['blocked-user-names', blockedIds.join(',')],
    enabled: blockedIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, company_name, role')
        .in('user_id', blockedIds);
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
  const deepLinkHandled = useRef(false);
  const tabSwipeStartX = useRef<number | null>(null);
  const isMobile = useIsMobile();

  // Handle deep-link: /messages?conversation=<id>
  useEffect(() => {
    const conversationParam = searchParams.get('conversation');
    if (conversationParam && conversations.length > 0 && !deepLinkHandled.current) {
      const exists = conversations.some(c => c.id === conversationParam);
      if (exists) {
        setSelectedConversationId(conversationParam);
        setShowMobileChat(true);
        deepLinkHandled.current = true;
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, conversations, setSearchParams]);

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

  const handleSelectConversation = (convId: string) => {
    setSelectedConversationId(convId);
    setShowMobileChat(true);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
    if (isMobile) setSelectedConversationId(null);
  };

  // Visa skelett när context fortfarande hämtar och vi saknar cachad data
  const hasData = conversations.length > 0;
  const showSkeleton = isLoading && !hasData;

  if (!showContentFade) {
    return (
      <div className="flex-1 min-h-0 flex flex-col opacity-0 responsive-container-wide">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  if (showSkeleton) {
    return <EmployerMessagesSkeleton />;
  }


  return (
    <div className="flex-1 min-h-0 flex flex-col animate-fade-in messages-container overflow-x-hidden">
      {/* Header */}
      <div className={cn("flex items-center justify-center mb-4 flex-shrink-0 relative", showMobileChat && "hidden md:flex")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Chattar</h1>
            {totalUnreadCount > 0 && (
              <p className="text-white text-sm">{totalUnreadCount} olästa meddelanden</p>
            )}
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

      {/* Main content - Split view on desktop, stacked on mobile */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Conversation List */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col",
          showMobileChat ? "hidden md:flex" : "animate-fade-in md:animate-none"
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
                    <div key={block.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 break-words text-xs text-white">
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
                  iconRef={leftEmptyIconRef}
                  contentRef={leftEmptyContentRef}
                />
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {filteredConversations.map((conv) => {
                    const { displayMember, isSelf } = resolveDisplayMember(conv.members, user?.id);
                    const displayName = getConversationDisplayName({
                      isGroup: conv.is_group,
                      groupName: conv.name,
                      snapshot: conv.applicationSnapshot,
                      displayMember,
                      isSelf,
                    });

                    return (
                      <SwipeableConversationItem
                        key={conv.id}
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
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Chat View */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !showMobileChat && "hidden md:flex"
        )}>
          {selectedConversation ? (
            <ChatView
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

      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}

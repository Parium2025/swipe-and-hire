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
import { MessagesTabs } from '@/components/MessagesTabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDeleteConversation } from '@/hooks/useDeleteConversation';
import { getConversationDisplayName } from '@/lib/conversationDisplayUtils';
import {
  MessageSquare,
  Plus,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ConversationTab = 'all' | 'candidates' | 'colleagues';

export default function Messages() {
  const { user, userRole } = useAuth();

  // Delayed fade-in (employer-side parity)
  const [showContentFade, setShowContentFade] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowContentFade(true), 100);
    return () => clearTimeout(timer);
  }, []);
  // Läs från delad context — en enda global subscription körs i ConversationsProvider
  const conversationsCtx = useConversationsContext();
  const conversations = conversationsCtx?.conversations ?? [];
  const isLoading = conversationsCtx?.isLoading ?? false;
  const totalUnreadCount = conversationsCtx?.totalUnreadCount ?? 0;
  const refetch = conversationsCtx?.refetch ?? (() => {});
  const { deleteConversation, isDeleting } = useDeleteConversation();
  const { hasTeam } = useTeamMembers();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [activeTab, setActiveTab] = useState<ConversationTab>(hasTeam ? 'all' : 'candidates');
  const deepLinkHandled = useRef(false);
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

  // Categorize conversations
  const categorizeConversation = (conv: Conversation): 'candidates' | 'colleagues' => {
    const otherMembers = (conv.members || []).filter(m => m.user_id !== user?.id);
    const roles = otherMembers.map(m => m.profile?.role).filter(Boolean);
    if (roles.includes('job_seeker')) return 'candidates';
    if (roles.includes('employer')) return 'colleagues';
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
  const getConversationsForTab = () => {
    switch (activeTab) {
      case 'candidates': return candidateConversations;
      case 'colleagues': return colleagueConversations;
      default: return conversations;
    }
  };

  const filteredConversations = getConversationsForTab().filter(conv => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();

    if (conv.name?.toLowerCase().includes(query)) return true;

    const snapshot = conv.applicationSnapshot;
    if (snapshot) {
      const snapshotName = `${snapshot.first_name || ''} ${snapshot.last_name || ''}`.trim().toLowerCase();
      if (snapshotName.includes(query)) return true;
      if (snapshot.job_title?.toLowerCase().includes(query)) return true;
    }

    const memberNames = conv.members
      .filter(m => m.user_id !== user?.id)
      .map(m => {
        const p = m.profile;
        if (!p) return '';
        if (p.role === 'employer' && p.company_name) return p.company_name;
        return `${p.first_name || ''} ${p.last_name || ''}`;
      })
      .join(' ')
      .toLowerCase();

    if (memberNames.includes(query)) return true;
    if (conv.job?.title?.toLowerCase().includes(query)) return true;
    if (conv.last_message?.content.toLowerCase().includes(query)) return true;

    return false;
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
    return (
      <div className="flex-1 min-h-0 flex flex-col animate-fade-in messages-container overflow-x-hidden">
        {/* Header skeleton */}
        <div className="flex items-center justify-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-32 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Body skeleton */}
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          <div className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col">
            <div className="h-10 mb-3 rounded-md bg-white/5 animate-pulse" />
            <div className="relative flex-1 overflow-hidden rounded-xl bg-white/5 border border-white/10 p-2 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right pane (desktop only) */}
          <div className="hidden md:flex flex-1 rounded-xl bg-white/5 border border-white/10 items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
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
              <MessagesTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                totalUnreadCount={totalUnreadCount}
                candidateUnread={candidateUnread}
                colleagueUnread={colleagueUnread}
              />
            ) : null}

            <div className="relative mb-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök efter chattar..."
                className="bg-white/5 border-white/10 text-pure-white placeholder:text-pure-white"
              />
            </div>
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
                    const otherMembers = (conv.members || []).filter(m => m.user_id !== user?.id);
                    const displayMember = otherMembers[0];
                    const displayName = getConversationDisplayName({
                      isGroup: conv.is_group,
                      groupName: conv.name,
                      snapshot: conv.applicationSnapshot,
                      displayMember,
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

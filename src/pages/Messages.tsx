import { useState, useRef, useEffect, useLayoutEffect, useCallback, type Ref } from 'react';
import { useConversations, useConversationMessages, Conversation, ConversationMessage, useCreateConversation } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { NewConversationDialog } from '@/components/NewConversationDialog';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Plus,
  Users,
  User,
  Search,
  Briefcase,
  ChevronLeft,
  Hash,
  Circle,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MessagesTabs } from '@/components/MessagesTabs';

type ConversationTab = 'all' | 'candidates' | 'colleagues';

export default function Messages() {
  const { user } = useAuth();
  const { conversations, isLoading, totalUnreadCount, refetch } = useConversations();
  const { hasTeam } = useTeamMembers();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [activeTab, setActiveTab] = useState<ConversationTab>(hasTeam ? 'all' : 'candidates');

  // Pixel-perfect alignment: keep icon + text on the exact same row between the two empty states.
  const leftEmptyIconRef = useRef<HTMLDivElement | null>(null);
  const rightEmptyIconRef = useRef<HTMLDivElement | null>(null);
  const leftEmptyPanelRef = useRef<HTMLDivElement | null>(null);
  const rightEmptyPanelRef = useRef<HTMLDivElement | null>(null);
  const leftEmptyContentRef = useRef<HTMLDivElement | null>(null);
  const rightEmptyContentRef = useRef<HTMLDivElement | null>(null);

  const [leftEmptyAlignOffset, setLeftEmptyAlignOffset] = useState(0);


  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Categorize conversations
  const categorizeConversation = (conv: Conversation): 'candidates' | 'colleagues' => {
    const otherMembers = conv.members.filter(m => m.user_id !== user?.id);
    // If any other member is a job_seeker, it's a candidate conversation.
    // IMPORTANT: if profiles are not readable (RLS) we may not have role info;
    // in that case default to 'candidates' so we never hide real conversations.
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
      case 'candidates':
        return candidateConversations;
      case 'colleagues':
        return colleagueConversations;
      default:
        return conversations;
    }
  };

  const filteredConversations = getConversationsForTab().filter(conv => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    // Search in conversation name
    if (conv.name?.toLowerCase().includes(query)) return true;
    
    // Search in member names
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
    
    // Search in last message
    if (conv.last_message?.content.toLowerCase().includes(query)) return true;
    
    return false;
  });

  const showEmptyConversationList = filteredConversations.length === 0;
  const showEmptyChatState = !selectedConversation;

  useLayoutEffect(() => {
    // Only align when BOTH empty states are visible (desktop split view).
    if (!showEmptyConversationList || !showEmptyChatState) {
      setLeftEmptyAlignOffset(0);
      return;
    }

    // On mobile the right pane isn't visible, so don't try to align.
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
      setLeftEmptyAlignOffset(0);
      return;
    }

    const leftIcon = leftEmptyIconRef.current;
    const rightIcon = rightEmptyIconRef.current;
    const leftContent = leftEmptyContentRef.current;
    const rightContent = rightEmptyContentRef.current;
    const leftPanel = leftEmptyPanelRef.current;
    const rightPanel = rightEmptyPanelRef.current;

    if (!leftIcon || !rightIcon) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const roundToDevicePixel = (v: number) => Math.round(v * dpr) / dpr;

    // Micro-adjustment if needed (negative = move left empty state up)
    const FINE_TUNE_PX = 0;

    const compute = () => {
      setLeftEmptyAlignOffset((prev) => {
        const leftTop = leftIcon.getBoundingClientRect().top;
        const rightTop = rightIcon.getBoundingClientRect().top;

        // Move from current offset toward the target in one step.
        const next = roundToDevicePixel(prev + (rightTop - leftTop) + FINE_TUNE_PX);
        return Math.abs(prev - next) < 0.01 ? prev : next;
      });
    };

    // Let layout settle (fonts, scrollbars) then compute multiple times.
    const raf1 = requestAnimationFrame(() => {
      compute();
      requestAnimationFrame(() => {
        compute();
        requestAnimationFrame(compute);
      });
    });

    // Observe the *content blocks* so text wrapping / font loading triggers recalculation.
    const ro = new ResizeObserver(compute);
    if (leftContent) ro.observe(leftContent);
    if (rightContent) ro.observe(rightContent);

    // Fallback observers
    ro.observe(leftIcon);
    ro.observe(rightIcon);
    if (leftPanel) ro.observe(leftPanel);
    if (rightPanel) ro.observe(rightPanel);

    // Catch mutations that can move content without changing the icon's own size.
    const mo = new MutationObserver(() => compute());
    if (leftContent) mo.observe(leftContent, { subtree: true, childList: true, characterData: true });
    if (rightContent) mo.observe(rightContent, { subtree: true, childList: true, characterData: true });

    window.addEventListener('resize', compute);

    // Re-compute after a short delay to catch late layout shifts.
    const timeout = setTimeout(compute, 150);

    const fontsReady = document.fonts?.ready;
    if (fontsReady) {
      fontsReady.then(() => requestAnimationFrame(compute)).catch(() => {});
    }

    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(timeout);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [showEmptyConversationList, showEmptyChatState]);

  const handleSelectConversation = (convId: string) => {
    setSelectedConversationId(convId);
    setShowMobileChat(true);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  // Only show loading if there's no cached data at all
  const hasData = conversations.length > 0;
  
  if (isLoading && !hasData) {
    return (
     <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col opacity-0 max-w-4xl mx-auto px-3 md:px-8">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  return (
     <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col animate-fade-in max-w-4xl mx-auto px-3 md:px-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Meddelanden</h1>
            {totalUnreadCount > 0 && (
              <p className="text-white text-sm">{totalUnreadCount} olästa meddelanden</p>
            )}
          </div>
        </div>

        {/* New conversation button - only show if there are colleagues (for group chats) */}
        {hasTeam && (
          <Button
            variant="glass"
            onClick={() => setShowNewConversation(true)}
            className="bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Ny konversation</span>
            <span className="sm:hidden">Ny</span>
          </Button>
        )}
      </div>

      {/* Main content - Split view on desktop, stacked on mobile */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Conversation List - Always visible on desktop, conditional on mobile */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col",
          showMobileChat && "hidden md:flex"
        )}>
          {/* Header area (tabs + search). Used to align empty state between columns. */}
          <div className="flex-shrink-0">
            {/* Tab filter - only show tabs if there are colleagues */}
            {hasTeam ? (
              <MessagesTabs 
                activeTab={activeTab}
                onTabChange={setActiveTab}
                totalUnreadCount={totalUnreadCount}
                candidateUnread={candidateUnread}
                colleagueUnread={colleagueUnread}
              />
            ) : null}

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök konversationer..."
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/70"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div ref={leftEmptyPanelRef} className="relative flex-1 overflow-hidden rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">

            {filteredConversations.length === 0 ? (
              <div
                className="h-full flex items-center justify-center"
                style={leftEmptyAlignOffset ? { transform: `translateY(${leftEmptyAlignOffset}px)` } : undefined}
              >
                <EmptyConversationList
                  hasSearch={!!searchQuery.trim()}
                  iconRef={leftEmptyIconRef}
                  contentRef={leftEmptyContentRef}
                />
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {filteredConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isSelected={selectedConversationId === conv.id}
                      currentUserId={user?.id || ''}
                      onClick={() => handleSelectConversation(conv.id)}
                      category={categorizeConversation(conv)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Chat View - Visible on desktop or when selected on mobile */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !showMobileChat && "hidden md:flex"
        )}>
          {selectedConversation ? (
            <ChatView 
              conversation={selectedConversation} 
              currentUserId={user?.id || ''}
              onBack={handleBackToList}
              currentUserRole={(user?.role as 'job_seeker' | 'employer') || null}
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

      {/* New conversation dialog */}
      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}

// Conversation list item
function ConversationItem({ 
  conversation, 
  isSelected, 
  currentUserId,
  onClick,
  category,
}: { 
  conversation: Conversation;
  isSelected: boolean;
  currentUserId: string;
  onClick: () => void;
  category: 'candidates' | 'colleagues';
}) {
  const otherMembers = conversation.members.filter(m => m.user_id !== currentUserId);
  const displayMember = otherMembers[0];
  
  // Use frozen application snapshot if available, otherwise fall back to live profile
  const snapshot = conversation.applicationSnapshot;
  
  const getDisplayName = () => {
    if (conversation.is_group && conversation.name) {
      return conversation.name;
    }
    // Use frozen name from application if available
    if (snapshot && (snapshot.first_name || snapshot.last_name)) {
      return `${snapshot.first_name || ''} ${snapshot.last_name || ''}`.trim();
    }
    if (!displayMember?.profile) return 'Okänd användare';
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd användare';
  };

  // Build a profile object for avatar, preferring snapshot data for candidates
  const getAvatarProfile = () => {
    if (snapshot && snapshot.profile_image_snapshot_url) {
      // Return a synthetic profile with frozen snapshot data
      return {
        role: 'job_seeker' as const,
        first_name: snapshot.first_name,
        last_name: snapshot.last_name,
        company_name: null,
        profile_image_url: snapshot.profile_image_snapshot_url,
        company_logo_url: null,
      };
    }
    return displayMember?.profile;
  };

  const avatarProfile = getAvatarProfile();

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Igår';
    return format(date, 'd MMM', { locale: sv });
  };

  const lastMessagePreview = conversation.last_message?.content || 'Inga meddelanden ännu';
  const isOwnMessage = conversation.last_message?.sender_id === currentUserId;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all",
        isSelected 
          ? "bg-white/15 border border-white/20" 
          : "hover:bg-white/10 border border-transparent"
      )}
    >
      {/* Avatar with category indicator */}
      <div className="relative flex-shrink-0">
        <ConversationAvatar
          profile={avatarProfile}
          isGroup={conversation.is_group}
          groupName={conversation.name}
          size="lg"
          className={cn(
            "border-2",
            conversation.is_group 
              ? "" 
              : category === 'candidates' 
                ? "border-emerald-500/50" 
                : "border-blue-500/50"
          )}
          fallbackClassName={category === 'candidates' ? "bg-emerald-500/20" : "bg-blue-500/20"}
        />
        {/* Category badge */}
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-900",
          category === 'candidates' ? "bg-emerald-500" : "bg-blue-500"
        )}>
          {category === 'candidates' ? (
            <User className="h-2 w-2 text-white" />
          ) : (
            <Briefcase className="h-2 w-2 text-white" />
          )}
        </div>
        {conversation.unread_count > 0 && (
          <div className="absolute -top-1 -left-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn(
            "font-medium truncate",
            conversation.unread_count > 0 ? "text-white" : "text-white/90"
          )}>
            {getDisplayName()}
          </span>
          <span className="text-white/40 text-xs flex-shrink-0">
            {formatTime(conversation.last_message_at)}
          </span>
        </div>
        
        {conversation.job && (
          <div className="flex items-center gap-1 text-white/50 text-xs mb-0.5">
            <Briefcase className="h-3 w-3" />
            <span className="truncate">{conversation.job.title}</span>
          </div>
        )}
        
        <p className={cn(
          "text-sm truncate",
          conversation.unread_count > 0 ? "text-white/80 font-medium" : "text-white/50"
        )}>
          {isOwnMessage && <span className="text-white/40">Du: </span>}
          {lastMessagePreview}
        </p>
      </div>
    </button>
  );
}

// Chat view component
function ChatView({ 
  conversation, 
  currentUserId,
  onBack,
  currentUserRole,
}: { 
  conversation: Conversation;
  currentUserId: string;
  onBack: () => void;
  currentUserRole: 'job_seeker' | 'employer' | null;
}) {
  const { messages, isLoading, sendMessage, markAsRead } = useConversationMessages(conversation.id);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversation.id);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const otherMembers = conversation.members.filter(m => m.user_id !== currentUserId);
  const displayMember = otherMembers[0];
  
  // Use frozen application snapshot if available
  const snapshot = conversation.applicationSnapshot;

  // Get current user's display name for typing indicator
  const getCurrentUserName = () => {
    const currentMember = conversation.members.find(m => m.user_id === currentUserId);
    if (!currentMember?.profile) return 'Någon';
    const p = currentMember.profile;
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Någon';
  };
  
  // Build avatar profile preferring snapshot for candidates
  const getAvatarProfile = () => {
    if (snapshot && snapshot.profile_image_snapshot_url) {
      return {
        role: 'job_seeker' as const,
        first_name: snapshot.first_name,
        last_name: snapshot.last_name,
        company_name: null,
        profile_image_url: snapshot.profile_image_snapshot_url,
        company_logo_url: null,
      };
    }
    return displayMember?.profile;
  };
  
  const avatarProfile = getAvatarProfile();

  // Mark as read when opening
  useEffect(() => {
    if (conversation.unread_count > 0) {
      markAsRead();
    }
  }, [conversation.id, conversation.unread_count, markAsRead]);

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      startTyping(getCurrentUserName());
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
    // Stop typing indicator when sending
    stopTyping(getCurrentUserName());
    
    setSending(true);
    try {
      await sendMessage(newMessage);
      setNewMessage('');
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Kunde inte skicka meddelande');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getDisplayName = () => {
    if (conversation.is_group && conversation.name) {
      return conversation.name;
    }
    // Use frozen name from application if available
    if (snapshot && (snapshot.first_name || snapshot.last_name)) {
      return `${snapshot.first_name || ''} ${snapshot.last_name || ''}`.trim();
    }
    if (!displayMember?.profile) return 'Okänd användare';
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd användare';
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, ConversationMessage[]>);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Idag';
    if (isYesterday(date)) return 'Igår';
    return format(date, 'd MMMM yyyy', { locale: sv });
  };

  return (
    <div className="flex-1 flex flex-col rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 flex-shrink-0">
        {/* Back button on mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden text-white/70 hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <ConversationAvatar
          profile={avatarProfile}
          isGroup={conversation.is_group}
          groupName={conversation.name}
          size="md"
        />

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate">{getDisplayName()}</h2>
          {conversation.is_group && (
            <p className="text-white/50 text-xs">
              {conversation.members.length} medlemmar
            </p>
          )}
          {/* Show current job context from application snapshot */}
          {snapshot?.job_title ? (
            <p className="text-blue-300/70 text-xs flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              <span className="truncate">{snapshot.job_title}</span>
            </p>
          ) : conversation.job && (
            <p className="text-white/50 text-xs flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {conversation.job.title}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                <Skeleton className="h-8 w-8 rounded-full bg-white/10 flex-shrink-0" />
                <div className={`flex-1 space-y-2 ${i % 2 === 0 ? '' : 'flex flex-col items-end'}`}>
                  <Skeleton className={`h-4 ${i % 2 === 0 ? 'w-3/4' : 'w-2/3'} bg-white/10`} />
                  <Skeleton className={`h-12 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'} rounded-xl bg-white/10`} />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-white/40" />
            </div>
            <p className="text-white/50 text-sm">Inga meddelanden ännu</p>
            <p className="text-white/30 text-xs">Skriv ett meddelande för att starta konversationen</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/40 text-xs font-medium px-2">
                    {formatDateHeader(date)}
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {msgs.map((msg, idx) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.sender_id === currentUserId}
                      showAvatar={idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id}
                      isGroup={conversation.is_group}
                      currentUserRole={currentUserRole}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Typing indicator */}
      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-t border-white/5"
          >
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>
                {typingUsers.length === 1 
                  ? `${typingUsers[0].name} skriver...`
                  : `${typingUsers.map(u => u.name).join(', ')} skriver...`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Skriv ett meddelande..."
            className="min-h-[44px] max-h-32 resize-none bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl"
            rows={1}
          />
          <Button
            variant="glass"
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="h-11 w-11 flex-shrink-0 bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Single message bubble
function MessageBubble({ 
  message, 
  isOwn, 
  showAvatar,
  isGroup,
  currentUserRole,
}: { 
  message: ConversationMessage;
  isOwn: boolean;
  showAvatar: boolean;
  isGroup: boolean;
  currentUserRole: 'job_seeker' | 'employer' | null;
}) {
  const getDisplayName = () => {
    const p = message.sender_profile;
    if (!p) return 'Okänd';
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd';
  };

  // Avatar URL resolution is now handled by ConversationAvatar component

  // System message - job context switch marker
  if (message.is_system_message) {
    const isJobContextMarker = message.content.startsWith('📋');
    
    // Hide job context markers from job seekers - only employers should see these
    if (isJobContextMarker && currentUserRole !== 'employer') {
      return null;
    }
    
    return (
      <div className="flex justify-center my-4">
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full",
          isJobContextMarker 
            ? "bg-blue-500/10 border border-blue-500/20" 
            : "bg-white/5"
        )}>
          {isJobContextMarker && <Briefcase className="h-3.5 w-3.5 text-blue-400" />}
          <span className={cn(
            "text-xs font-medium",
            isJobContextMarker ? "text-blue-300" : "text-white/40 italic"
          )}>
            {message.content}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-2",
      isOwn ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar space */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && (
          <ConversationAvatar
            profile={message.sender_profile}
            size="sm"
          />
        )}
      </div>

      {/* Message content */}
      <div className={cn(
        "max-w-[70%] flex flex-col",
        isOwn ? "items-end" : "items-start"
      )}>
        {/* Sender name for group chats */}
        {isGroup && showAvatar && !isOwn && (
          <span className="text-white/50 text-xs mb-1 ml-1">
            {getDisplayName()}
          </span>
        )}

        <div className={cn(
          "px-4 py-2 rounded-2xl",
          isOwn 
            ? "bg-blue-500/30 border border-blue-500/40 rounded-br-md" 
            : "bg-white/10 border border-white/10 rounded-bl-md"
        )}>
          <p className="text-white text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        <span className="text-white/30 text-[10px] mt-1 px-1">
          {format(new Date(message.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
}

// Empty states
function EmptyConversationList({
  hasSearch,
  iconRef,
  contentRef,
}: {
  hasSearch: boolean;
  iconRef?: Ref<HTMLDivElement>;
  contentRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={contentRef} className="flex flex-col items-center px-4 text-center">
      <div
        ref={iconRef}
        className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3"
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </div>
      <h3 className="text-base font-medium text-white mb-0.5">
        {hasSearch ? 'Inga resultat' : 'Inga konversationer'}
      </h3>
      <p className="text-white text-sm">
        {hasSearch
          ? 'Prova ett annat sökord'
          : 'Starta en konversation med en kandidat eller kollega'}
      </p>
    </div>
  );
}

function EmptyChatState({
  iconRef,
  containerRef,
  contentRef,
}: {
  iconRef?: Ref<HTMLDivElement>;
  containerRef?: Ref<HTMLDivElement>;
  contentRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
    >
      <div ref={contentRef} className="flex flex-col items-center px-4 text-center">
        <div
          ref={iconRef}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3"
        >
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-base font-medium text-white mb-0.5">Välj en konversation</h3>
        <p className="text-white text-sm">Välj en konversation från listan</p>
      </div>
    </div>
  );
}

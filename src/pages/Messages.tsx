import { useState, useRef, useEffect, useCallback } from 'react';
import { useConversations, useConversationMessages, Conversation, ConversationMessage, useCreateConversation } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewConversationDialog } from '@/components/NewConversationDialog';
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

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Categorize conversations
  const categorizeConversation = (conv: Conversation): 'candidates' | 'colleagues' => {
    const otherMembers = conv.members.filter(m => m.user_id !== user?.id);
    // If any other member is a job_seeker, it's a candidate conversation
    const hasCandidate = otherMembers.some(m => m.profile?.role === 'job_seeker');
    return hasCandidate ? 'candidates' : 'colleagues';
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Meddelanden</h1>
            {totalUnreadCount > 0 && (
              <p className="text-white/60 text-sm">{totalUnreadCount} olästa meddelanden</p>
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
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök konversationer..."
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-hidden rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <ScrollArea className="h-full">
              {filteredConversations.length === 0 ? (
                <EmptyConversationList hasSearch={!!searchQuery.trim()} />
              ) : (
                <div className="p-2 space-y-1">
                  {filteredConversations.map(conv => (
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
              )}
            </ScrollArea>
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
            />
          ) : (
            <EmptyChatState />
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
  
  const getDisplayName = () => {
    if (conversation.is_group && conversation.name) {
      return conversation.name;
    }
    if (!displayMember?.profile) return 'Okänd användare';
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd användare';
  };

  const getAvatarUrl = () => {
    if (!displayMember?.profile) return null;
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_logo_url) return p.company_logo_url;
    return p.profile_image_url;
  };

  const getInitials = () => {
    if (conversation.is_group && conversation.name) {
      return conversation.name.substring(0, 2).toUpperCase();
    }
    if (!displayMember?.profile) return '?';
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_name) {
      return p.company_name.substring(0, 2).toUpperCase();
    }
    const first = p.first_name?.[0] || '';
    const last = p.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

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
        {conversation.is_group ? (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/20 flex items-center justify-center">
            <Users className="h-6 w-6 text-white/80" />
          </div>
        ) : (
          <Avatar className={cn(
            "h-12 w-12 border-2",
            category === 'candidates' ? "border-emerald-500/50" : "border-blue-500/50"
          )}>
            <AvatarImage src={getAvatarUrl() || undefined} />
            <AvatarFallback className={cn(
              "text-white text-sm",
              category === 'candidates' ? "bg-emerald-500/20" : "bg-blue-500/20"
            )}>
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        )}
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
}: { 
  conversation: Conversation;
  currentUserId: string;
  onBack: () => void;
}) {
  const { messages, isLoading, sendMessage, markAsRead } = useConversationMessages(conversation.id);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const otherMembers = conversation.members.filter(m => m.user_id !== currentUserId);
  const displayMember = otherMembers[0];

  // Mark as read when opening
  useEffect(() => {
    if (conversation.unread_count > 0) {
      markAsRead();
    }
  }, [conversation.id, conversation.unread_count, markAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
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
    if (!displayMember?.profile) return 'Okänd användare';
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd användare';
  };

  const getAvatarUrl = () => {
    if (!displayMember?.profile) return null;
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_logo_url) return p.company_logo_url;
    return p.profile_image_url;
  };

  const getInitials = () => {
    if (conversation.is_group && conversation.name) {
      return conversation.name.substring(0, 2).toUpperCase();
    }
    if (!displayMember?.profile) return '?';
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_name) {
      return p.company_name.substring(0, 2).toUpperCase();
    }
    const first = p.first_name?.[0] || '';
    const last = p.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
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

        {conversation.is_group ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/20 flex items-center justify-center">
            <Users className="h-5 w-5 text-white/80" />
          </div>
        ) : (
          <Avatar className="h-10 w-10 border border-white/10">
            <AvatarImage src={getAvatarUrl() || undefined} />
            <AvatarFallback className="bg-white/10 text-white text-sm">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate">{getDisplayName()}</h2>
          {conversation.is_group && (
            <p className="text-white/50 text-xs">
              {conversation.members.length} medlemmar
            </p>
          )}
          {conversation.job && (
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
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
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
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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
}: { 
  message: ConversationMessage;
  isOwn: boolean;
  showAvatar: boolean;
  isGroup: boolean;
}) {
  const getDisplayName = () => {
    const p = message.sender_profile;
    if (!p) return 'Okänd';
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd';
  };

  const getAvatarUrl = () => {
    const p = message.sender_profile;
    if (!p) return null;
    if (p.role === 'employer' && p.company_logo_url) return p.company_logo_url;
    return p.profile_image_url;
  };

  const getInitials = () => {
    const p = message.sender_profile;
    if (!p) return '?';
    if (p.role === 'employer' && p.company_name) {
      return p.company_name.substring(0, 2).toUpperCase();
    }
    const first = p.first_name?.[0] || '';
    const last = p.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  if (message.is_system_message) {
    return (
      <div className="flex justify-center">
        <span className="text-white/40 text-xs italic px-3 py-1 bg-white/5 rounded-full">
          {message.content}
        </span>
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
          <Avatar className="h-8 w-8 border border-white/10">
            <AvatarImage src={getAvatarUrl() || undefined} />
            <AvatarFallback className="bg-white/10 text-white text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
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
function EmptyConversationList({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <MessageSquare className="h-7 w-7 text-white/40" />
      </div>
      <h3 className="text-lg font-medium text-white mb-1">
        {hasSearch ? 'Inga resultat' : 'Inga konversationer'}
      </h3>
      <p className="text-white/50 text-sm max-w-xs">
        {hasSearch 
          ? 'Prova ett annat sökord' 
          : 'Starta en konversation med en kandidat eller kollega för att komma igång'}
      </p>
    </div>
  );
}

function EmptyChatState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-white/30" />
      </div>
      <h3 className="text-lg font-medium text-white mb-1">Välj en konversation</h3>
      <p className="text-white/50 text-sm text-center max-w-xs">
        Välj en konversation från listan till vänster för att börja chatta
      </p>
    </div>
  );
}

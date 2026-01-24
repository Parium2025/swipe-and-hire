import { useState, useRef, useEffect } from 'react';
import { useConversations, useConversationMessages, Conversation, ConversationMessage } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  ChevronLeft,
  Briefcase,
  Building2,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function JobSeekerMessages() {
  const { user } = useAuth();
  const { conversations, isLoading, totalUnreadCount } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const handleSelectConversation = (convId: string) => {
    setSelectedConversationId(convId);
  };

  const handleBack = () => {
    setSelectedConversationId(null);
  };

  // Only show loading if there's no cached data at all
  const hasData = conversations.length > 0;
  
  if (isLoading && !hasData) {
    return (
      <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col opacity-0">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  // Show chat view if conversation is selected
  if (selectedConversation) {
    return (
      <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col animate-fade-in max-w-4xl mx-auto px-3 md:px-6">
        <ChatView 
          conversation={selectedConversation} 
          currentUserId={user?.id || ''}
          onBack={handleBack}
        />
      </div>
    );
  }

  // Show conversation list
  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col animate-fade-in max-w-4xl mx-auto px-3 md:px-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
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

      {/* Conversation list */}
      <div className="flex-1 overflow-hidden rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
        {conversations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-white/60" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">Inga meddelanden</h3>
            <p className="text-white/60 text-sm max-w-xs">
              När du söker jobb eller arbetsgivare kontaktar dig visas konversationerna här
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  currentUserId={user?.id || ''}
                  onClick={() => handleSelectConversation(conv.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// Conversation list item - Slack-style
function ConversationItem({ 
  conversation, 
  currentUserId,
  onClick,
}: { 
  conversation: Conversation;
  currentUserId: string;
  onClick: () => void;
}) {
  const otherMembers = conversation.members.filter(m => m.user_id !== currentUserId);
  const displayMember = otherMembers[0];
  
  const getDisplayName = () => {
    if (conversation.is_group && conversation.name) {
      return conversation.name;
    }
    if (!displayMember?.profile) return 'Okänd';
    const p = displayMember.profile;
    // For job seekers, the other party is typically an employer
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd';
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
  const hasUnread = conversation.unread_count > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all",
        "hover:bg-white/10 border border-transparent hover:border-white/10",
        hasUnread && "bg-white/5"
      )}
    >
      {/* Avatar with unread indicator */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-14 w-14 border-2 border-white/10">
          <AvatarImage src={getAvatarUrl() || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-white text-base">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        {hasUnread && (
          <div className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1.5 border-2 border-slate-900">
            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={cn(
            "font-semibold truncate text-base",
            hasUnread ? "text-white" : "text-white/90"
          )}>
            {getDisplayName()}
          </span>
          <span className="text-white/40 text-xs flex-shrink-0">
            {formatTime(conversation.last_message_at)}
          </span>
        </div>
        
        {/* Job context if available */}
        {conversation.job && (
          <div className="flex items-center gap-1.5 text-white/50 text-xs mb-1">
            <Briefcase className="h-3 w-3" />
            <span className="truncate">{conversation.job.title}</span>
          </div>
        )}
        
        {/* Last message preview */}
        <p className={cn(
          "text-sm truncate",
          hasUnread ? "text-white/80 font-medium" : "text-white/50"
        )}>
          {isOwnMessage && <span className="text-white/40">Du: </span>}
          {lastMessagePreview}
        </p>
      </div>

      {/* Chevron indicator */}
      <ChevronLeft className="h-5 w-5 text-white/30 rotate-180 flex-shrink-0" />
    </button>
  );
}

// Fullscreen chat view
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
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversation.id);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const otherMembers = conversation.members.filter(m => m.user_id !== currentUserId);
  const displayMember = otherMembers[0];

  // Get current user's display name for typing indicator
  const getCurrentUserName = () => {
    const currentMember = conversation.members.find(m => m.user_id === currentUserId);
    if (!currentMember?.profile) return 'Någon';
    const p = currentMember.profile;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Någon';
  };

  // Mark as read when opening
  useEffect(() => {
    if (conversation.unread_count > 0) {
      markAsRead();
    }
  }, [conversation.id, conversation.unread_count, markAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      startTyping(getCurrentUserName());
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
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
    if (!displayMember?.profile) return 'Okänd';
    const p = displayMember.profile;
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Okänd';
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
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <Avatar className="h-10 w-10 border border-white/10">
          <AvatarImage src={getAvatarUrl() || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-white text-sm">
            {getInitials()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate">{getDisplayName()}</h2>
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

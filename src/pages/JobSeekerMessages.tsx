import { useState, useRef, useEffect, useMemo } from 'react';
import { useMessages, Message } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  ChevronLeft,
  Briefcase,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MessageThread {
  id: string; // sender_id as thread ID
  senderProfile: {
    user_id?: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    profile_image_url: string | null;
    company_logo_url: string | null;
    role: 'job_seeker' | 'employer';
  };
  lastMessage: Message;
  unreadCount: number;
  messages: Message[];
}

export default function JobSeekerMessages() {
  const { user } = useAuth();
  const { inbox, sent, isLoading, unreadCount, markAsRead, refetch } = useMessages();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Group messages by sender (employer) into threads
  const threads = useMemo(() => {
    const threadMap = new Map<string, MessageThread>();

    // Process inbox messages (received from employers)
    inbox.forEach(msg => {
      const senderId = msg.sender_id;
      if (!threadMap.has(senderId) && msg.sender_profile) {
        threadMap.set(senderId, {
          id: senderId,
          senderProfile: msg.sender_profile,
          lastMessage: msg,
          unreadCount: 0,
          messages: [],
        });
      }
      const thread = threadMap.get(senderId);
      if (thread) {
        thread.messages.push(msg);
        if (!msg.is_read) {
          thread.unreadCount++;
        }
        // Update last message if newer
        if (new Date(msg.created_at) > new Date(thread.lastMessage.created_at)) {
          thread.lastMessage = msg;
        }
      }
    });

    // Add sent messages to threads
    sent.forEach(msg => {
      const recipientId = msg.recipient_id;
      const thread = threadMap.get(recipientId);
      if (thread) {
        thread.messages.push(msg);
        // Update last message if newer
        if (new Date(msg.created_at) > new Date(thread.lastMessage.created_at)) {
          thread.lastMessage = msg;
        }
      }
    });

    // Sort messages within each thread by date
    threadMap.forEach(thread => {
      thread.messages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    // Convert to array and sort by last message date
    return Array.from(threadMap.values()).sort((a, b) => 
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [inbox, sent]);

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleBack = () => {
    setSelectedThreadId(null);
    refetch();
  };

  // Only show loading if there's no cached data at all
  const hasData = inbox.length > 0 || sent.length > 0;
  
  if (isLoading && !hasData) {
    return (
      <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col opacity-0">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  // Show chat view if thread is selected
  if (selectedThread) {
    return (
      <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col animate-fade-in max-w-4xl mx-auto px-3 md:px-6">
        <ChatView 
          thread={selectedThread}
          currentUserId={user?.id || ''}
          onBack={handleBack}
          markAsRead={markAsRead}
          refetch={refetch}
        />
      </div>
    );
  }

  // Show thread list
  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col animate-fade-in max-w-4xl mx-auto px-3 md:px-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Meddelanden</h1>
          {unreadCount > 0 && (
            <p className="text-white/60 text-sm">{unreadCount} olästa meddelanden</p>
          )}
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-hidden rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
        {threads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">Inga meddelanden</h3>
            <p className="text-white text-sm max-w-xs">
              När du söker jobb eller arbetsgivare kontaktar dig visas konversationerna här
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {threads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  currentUserId={user?.id || ''}
                  onClick={() => handleSelectThread(thread.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// Thread list item - Slack-style
function ThreadItem({ 
  thread, 
  currentUserId,
  onClick,
}: { 
  thread: MessageThread;
  currentUserId: string;
  onClick: () => void;
}) {
  const profile = thread.senderProfile;
  
  const getDisplayName = () => {
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name;
    }
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Okänd';
  };

  const getAvatarUrl = () => {
    if (profile.role === 'employer' && profile.company_logo_url) {
      return profile.company_logo_url;
    }
    return profile.profile_image_url;
  };

  const getInitials = () => {
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name.substring(0, 2).toUpperCase();
    }
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Igår';
    return format(date, 'd MMM', { locale: sv });
  };

  const lastMessage = thread.lastMessage;
  const isOwnMessage = lastMessage.sender_id === currentUserId;
  const hasUnread = thread.unreadCount > 0;

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
            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
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
          <span className="text-white text-xs flex-shrink-0">
            {formatTime(lastMessage.created_at)}
          </span>
        </div>
        
        {/* Job context if available */}
        {lastMessage.job && (
          <div className="flex items-center gap-1.5 text-white text-xs mb-1">
            <Briefcase className="h-3 w-3 text-white" />
            <span className="truncate">{lastMessage.job.title}</span>
          </div>
        )}
        
        {/* Last message preview */}
        <p className={cn(
          "text-sm truncate text-white",
          hasUnread && "font-medium"
        )}>
          {isOwnMessage && <span className="text-white/70">Du: </span>}
          {lastMessage.content}
        </p>
      </div>

      {/* Chevron indicator */}
      <ChevronLeft className="h-5 w-5 text-white rotate-180 flex-shrink-0" />
    </button>
  );
}

// Fullscreen chat view
function ChatView({ 
  thread, 
  currentUserId,
  onBack,
  markAsRead,
  refetch,
}: { 
  thread: MessageThread;
  currentUserId: string;
  onBack: () => void;
  markAsRead: (id: string) => void;
  refetch: () => void;
}) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const profile = thread.senderProfile;

  // Mark unread messages as read when opening
  useEffect(() => {
    thread.messages.forEach(msg => {
      if (!msg.is_read && msg.sender_id !== currentUserId) {
        markAsRead(msg.id);
      }
    });
  }, [thread.messages, currentUserId, markAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          recipient_id: thread.id,
          content: newMessage.trim(),
          job_id: thread.lastMessage.job_id,
        });

      if (error) throw error;
      
      setNewMessage('');
      textareaRef.current?.focus();
      refetch();
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
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name;
    }
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Okänd';
  };

  const getAvatarUrl = () => {
    if (profile.role === 'employer' && profile.company_logo_url) {
      return profile.company_logo_url;
    }
    return profile.profile_image_url;
  };

  const getInitials = () => {
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name.substring(0, 2).toUpperCase();
    }
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  // Group messages by date
  const groupedMessages = thread.messages.reduce((groups, msg) => {
    const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, Message[]>);

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
          {thread.lastMessage.job && (
            <p className="text-white/50 text-xs flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {thread.lastMessage.job.title}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {thread.messages.length === 0 ? (
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
                  <span className="text-white text-xs font-medium px-2">
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
                      senderProfile={thread.senderProfile}
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
  senderProfile,
}: { 
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  senderProfile: MessageThread['senderProfile'];
}) {
  const getAvatarUrl = () => {
    if (senderProfile.role === 'employer' && senderProfile.company_logo_url) {
      return senderProfile.company_logo_url;
    }
    return senderProfile.profile_image_url;
  };

  const getInitials = () => {
    if (senderProfile.role === 'employer' && senderProfile.company_name) {
      return senderProfile.company_name.substring(0, 2).toUpperCase();
    }
    const first = senderProfile.first_name?.[0] || '';
    const last = senderProfile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

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

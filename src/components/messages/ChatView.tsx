import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2, ChevronLeft, Briefcase, WifiOff } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { MessageThread, OptimisticMessage } from './types';
import { MessageBubble } from './MessageBubble';
import { MessageAttachmentPicker } from './MessageAttachmentPicker';
import { DesktopEmojiPicker } from './DesktopEmojiPicker';
import { Message } from '@/hooks/useMessages';
import { useOfflineMessageQueue } from '@/hooks/useOfflineMessageQueue';
import { useOnline } from '@/hooks/useOnlineStatus';

interface ChatViewProps {
  thread: MessageThread;
  currentUserId: string;
  onBack: () => void;
  markAsRead: (id: string) => void;
  refetch: () => void;
}

export function ChatView({ 
  thread, 
  currentUserId,
  onBack,
  markAsRead,
  refetch,
}: ChatViewProps) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { isOnline } = useOnline();
  const { queueMessage, queue } = useOfflineMessageQueue(currentUserId);

  const profile = thread.senderProfile;

  // Combine real messages with optimistic ones and queued offline messages
  const allMessages = useMemo(() => {
    // Convert queued messages to OptimisticMessage format
    const queuedAsOptimistic: OptimisticMessage[] = queue
      .filter(q => q.recipient_id === thread.id)
      .map(q => ({
        id: q.id,
        sender_id: q.sender_id,
        recipient_id: q.recipient_id,
        content: q.content,
        is_read: false,
        job_id: q.job_id,
        created_at: q.created_at,
        updated_at: q.created_at,
        isOptimistic: true,
      }));
    
    const combined = [...thread.messages, ...optimisticMessages, ...queuedAsOptimistic];
    return combined.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [thread.messages, optimisticMessages, queue, thread.id]);

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
  }, [allMessages]);

  // Clear optimistic messages when real messages arrive
  useEffect(() => {
    if (optimisticMessages.length > 0) {
      const realMessageContents = new Set(thread.messages.map(m => m.content));
      setOptimisticMessages(prev => 
        prev.filter(om => !realMessageContents.has(om.content))
      );
    }
  }, [thread.messages, optimisticMessages.length]);

  const handleSend = useCallback(async () => {
    if ((!newMessage.trim() && !pendingAttachment) || sending) return;
    
    const messageContent = newMessage.trim();
    const attachment = pendingAttachment;
    
    // Create optimistic message
    const optimisticMessage: OptimisticMessage = {
      id: `optimistic-${Date.now()}`,
      sender_id: currentUserId,
      recipient_id: thread.id,
      content: messageContent,
      is_read: false,
      job_id: thread.lastMessage.job_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isOptimistic: true,
    };
    
    // Clear input immediately for better UX
    setNewMessage('');
    setPendingAttachment(null);
    textareaRef.current?.focus();
    
    // If offline and no attachment, queue the message
    if (!isOnline && !attachment) {
      queueMessage({
        recipient_id: thread.id,
        content: messageContent,
        job_id: thread.lastMessage.job_id,
      });
      toast.info('Meddelande köat', { description: 'Skickas automatiskt när du är online' });
      return;
    }
    
    // If offline with attachment, show error
    if (!isOnline && attachment) {
      toast.error('Kan inte skicka bilaga offline', { description: 'Anslut till internet först' });
      setNewMessage(messageContent);
      setPendingAttachment(attachment);
      return;
    }
    
    // Add optimistic message immediately
    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    
    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          recipient_id: thread.id,
          content: messageContent || (attachment ? '' : ''),
          job_id: thread.lastMessage.job_id,
          attachment_url: attachment?.url || null,
          attachment_type: attachment?.type || null,
          attachment_name: attachment?.name || null,
        });

      if (error) throw error;
      
      refetch();
    } catch (error) {
      console.error('Error sending message:', error);
      
      // If network error and no attachment, queue for retry
      if (!navigator.onLine && !attachment) {
        queueMessage({
          recipient_id: thread.id,
          content: messageContent,
          job_id: thread.lastMessage.job_id,
        });
        toast.info('Meddelande köat', { description: 'Skickas automatiskt när du är online' });
      } else {
        toast.error('Kunde inte skicka meddelande');
        setNewMessage(messageContent); // Restore the message
        setPendingAttachment(attachment);
      }
      
      // Remove failed optimistic message
      setOptimisticMessages(prev => 
        prev.filter(m => m.id !== optimisticMessage.id)
      );
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, currentUserId, thread.id, thread.lastMessage.job_id, refetch, isOnline, queueMessage, pendingAttachment]);

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
  const groupedMessages = allMessages.reduce((groups, msg) => {
    const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, (Message | OptimisticMessage)[]>);

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
          className="text-white hover:text-white border border-white/30 md:hover:bg-white/10 md:hover:border-white/50 transition-all duration-300 active:scale-95 active:bg-white/20"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
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
            <p className="text-white text-xs flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {thread.lastMessage.job.title}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {allMessages.length === 0 ? (
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
                      currentUserId={currentUserId}
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
        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 mb-2 text-amber-400 text-xs">
            <WifiOff className="h-3 w-3" />
            <span>Offline – meddelanden köas och skickas automatiskt</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Attachment picker */}
          <MessageAttachmentPicker
            userId={currentUserId}
            recipientId={thread.id}
            onAttachmentUploaded={setPendingAttachment}
            disabled={sending || !isOnline}
          />
          
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isOnline ? "Skriv ett meddelande..." : "Skriv – skickas när du är online..."}
            className="min-h-[44px] max-h-32 resize-none bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl flex-1"
            rows={1}
          />
          
          {/* Desktop emoji picker - only visible on md+ screens */}
          <DesktopEmojiPicker
            onSelect={(emoji) => setNewMessage(prev => prev + emoji)}
            disabled={sending}
          />
          
          <Button
            variant="glass"
            size="icon"
            onClick={handleSend}
            disabled={(!newMessage.trim() && !pendingAttachment) || sending}
            className="h-11 w-11 flex-shrink-0 bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !isOnline ? (
              <WifiOff className="h-4 w-4 text-amber-400" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

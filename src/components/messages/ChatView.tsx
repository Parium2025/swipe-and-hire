import { useState, useRef, useEffect, useCallback } from 'react';
import { useConversationMessages, type Conversation, type ConversationMessage } from '@/hooks/useConversations';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOfflineMessageQueue } from '@/hooks/useOfflineMessageQueue';
import { getIsOnline } from '@/lib/connectivityManager';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { getConversationDisplayName, getConversationAvatarProfile } from '@/lib/conversationDisplayUtils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Loader2,
  Briefcase,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MESSAGES_PAGE_SIZE = 200;

interface ChatViewProps {
  conversation: Conversation;
  currentUserId: string;
  onBack: () => void;
  currentUserRole: 'job_seeker' | 'employer' | null;
  category: 'candidates' | 'colleagues';
}

export function ChatView({
  conversation,
  currentUserId,
  onBack,
  currentUserRole,
  category,
}: ChatViewProps) {
  const { messages, isLoading, isError, refetch, sendMessage, markAsRead, fetchOlderMessages, hasMore, loadingOlder } = useConversationMessages(conversation.id);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversation.id);
  const { queueMessage } = useOfflineMessageQueue(currentUserId || undefined);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevFirstMessageIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);

  const getViewportEl = useCallback((): HTMLDivElement | null => {
    if (!scrollAreaRef.current) return null;
    return scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
  }, []);

  const otherMembers = (conversation.members || []).filter(m => m.user_id !== currentUserId);
  const displayMember = otherMembers[0];

  const snapshot = conversation.applicationSnapshot;

  // Build a frozen sender profile for the candidate based on snapshot
  const candidateUserId = conversation.candidate_id;
  const snapshotSenderProfile = snapshot && candidateUserId ? {
    first_name: snapshot.first_name,
    last_name: snapshot.last_name,
    company_name: null,
    profile_image_url: snapshot.profile_image_snapshot_url,
    company_logo_url: null,
    role: 'job_seeker' as const,
  } : null;

  // Get current user's display name for typing indicator
  const getCurrentUserName = () => {
    const currentMember = (conversation.members || []).find(m => m.user_id === currentUserId);
    if (!currentMember?.profile) return 'Någon';
    const p = currentMember.profile;
    if (p.role === 'employer' && p.company_name) return p.company_name;
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Någon';
  };

  const avatarProfile = getConversationAvatarProfile(snapshot, displayMember);

  // Read receipts: determine the other member's last_read_at
  const otherMemberLastRead = otherMembers[0]?.last_read_at
    ? new Date(otherMembers[0].last_read_at)
    : null;

  // Mark as read when opening
  useEffect(() => {
    if (conversation.unread_count > 0) {
      markAsRead();
    }
  }, [conversation.id, conversation.unread_count, markAsRead]);

  // Reset scroll tracking when switching conversation
  useEffect(() => {
    isNearBottomRef.current = true;
    prevMessageCountRef.current = 0;
    prevFirstMessageIdRef.current = null;
    prevScrollHeightRef.current = 0;
  }, [conversation.id]);

  // Track if user is near bottom of scroll area
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement | null;
    if (!target) return;
    const threshold = 100;
    isNearBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
  }, []);

  // Smart scroll: keep all scrolling inside message viewport
  useEffect(() => {
    const viewport = getViewportEl();
    if (!viewport) return;

    const isInitialLoad = prevMessageCountRef.current === 0 && messages.length > 0;
    const firstMessageId = messages[0]?.id || null;
    const wasOlderMessagesPrepended = prevFirstMessageIdRef.current !== null
      && firstMessageId !== prevFirstMessageIdRef.current
      && messages.length > prevMessageCountRef.current;

    if (wasOlderMessagesPrepended) {
      const delta = viewport.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) viewport.scrollTop += delta;
    } else {
      const isNewMessage = messages.length > prevMessageCountRef.current;
      const lastMessage = messages[messages.length - 1];
      const isOwnNewMessage = isNewMessage && lastMessage?.sender_id === currentUserId;

      if (isInitialLoad || isOwnNewMessage || isNearBottomRef.current) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: isInitialLoad ? 'auto' : 'smooth',
        });
      }
    }

    prevMessageCountRef.current = messages.length;
    prevFirstMessageIdRef.current = firstMessageId;
    prevScrollHeightRef.current = viewport.scrollHeight;
  }, [messages, currentUserId, getViewportEl]);

  // Scroll to bottom when typing indicator appears (only if near bottom)
  useEffect(() => {
    const viewport = getViewportEl();
    if (!viewport) return;
    if (typingUsers.length > 0 && isNearBottomRef.current) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [typingUsers, getViewportEl]);

  // Auto-resize textarea
  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`; // max-h-32 = 128px
  }, []);

  // Handle input change with typing indicator + autogrow
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    autoResizeTextarea();
    if (e.target.value.trim()) {
      startTyping(getCurrentUserName());
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    stopTyping(getCurrentUserName());
    setSending(true);

    try {
      if (!getIsOnline()) {
        // Queue for offline sync
        queueMessage({
          recipient_id: candidateUserId || otherMembers[0]?.user_id || '',
          content: newMessage.trim(),
          job_id: conversation.job_id,
          application_id: conversation.application_id,
        });
        toast.info('Meddelandet skickas när du är online igen');
        setNewMessage('');
        // Reset textarea height
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      } else {
        await sendMessage(newMessage);
        setNewMessage('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
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

  const displayName = getConversationDisplayName({
    isGroup: conversation.is_group,
    groupName: conversation.name,
    snapshot,
    displayMember,
  });

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
    <div className="flex-1 flex flex-col rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="md:hidden text-pure-white active:scale-95 transition-transform p-2 -ml-2"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {displayName === 'Okänd användare' ? (
          <Skeleton className="h-10 w-10 rounded-full bg-white/10 flex-shrink-0" />
        ) : (
          <ConversationAvatar
            profile={avatarProfile}
            isGroup={conversation.is_group}
            groupName={conversation.name}
            size="md"
            className={cn(
              "border-2",
              conversation.is_group
                ? ""
                : category === 'candidates'
                  ? "border-emerald-500/50"
                  : "border-blue-500/50"
            )}
          />
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-pure-white truncate">
            {displayName === 'Okänd användare' ? <Skeleton className="h-4 w-28 bg-white/10 rounded inline-block" /> : displayName}
          </h2>
          {conversation.is_group && (
            <p className="text-pure-white text-xs">
              {conversation.members.length} medlemmar
            </p>
          )}
          {snapshot?.job_title ? (
            <p className="text-pure-white text-xs flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              <span className="truncate">{snapshot.job_title}</span>
            </p>
          ) : conversation.job && (
            <p className="text-pure-white text-xs flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {conversation.job.title}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4" onScrollCapture={handleScroll}>
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
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-pure-white text-sm">Kunde inte ladda meddelanden</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-pure-white hover:bg-white/10 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Försök igen
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <p className="text-pure-white text-sm">Inga meddelanden ännu</p>
            <p className="text-pure-white text-xs">Skriv ett meddelande för att starta konversationen</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Load older messages button */}
            {hasMore && !isLoading && messages.length >= MESSAGES_PAGE_SIZE && (
              <div className="flex justify-center py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchOlderMessages}
                  disabled={loadingOlder}
                  className="text-pure-white hover:bg-white/10 text-xs gap-2"
                >
                  {loadingOlder ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Laddar äldre meddelanden...
                    </>
                  ) : (
                    'Visa äldre meddelanden'
                  )}
                </Button>
              </div>
            )}
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-pure-white text-xs font-medium px-2">
                    {formatDateHeader(date)}
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="space-y-3">
                  {msgs.map((msg, idx) => {
                    const resolvedMessage = snapshotSenderProfile && candidateUserId && msg.sender_id === candidateUserId
                      ? { ...msg, sender_profile: snapshotSenderProfile }
                      : msg;

                    // Determine if the other party has read this message
                    const isOwnMsg = msg.sender_id === currentUserId;
                    const isRead = isOwnMsg && otherMemberLastRead
                      ? otherMemberLastRead >= new Date(msg.created_at)
                      : false;

                    return (
                      <div key={msg.id} id={`msg-${msg.id}`}>
                        <MessageBubble
                          message={resolvedMessage}
                          isOwn={isOwnMsg}
                          showAvatar={idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id}
                          isGroup={conversation.is_group}
                          currentUserRole={currentUserRole}
                          isRead={isRead}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
            <div className="flex items-center gap-2 text-pure-white text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-pure-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-pure-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-pure-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            className="min-h-[44px] max-h-32 resize-none bg-white/5 border-white/10 text-pure-white placeholder:text-pure-white rounded-xl"
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

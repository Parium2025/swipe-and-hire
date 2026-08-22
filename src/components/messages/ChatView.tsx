import { useState, useRef, useEffect, useCallback } from 'react';
import { looksLikeVideoFile, readVideoDurationFromBlob, MAX_VIDEO_SECONDS } from '@/lib/videoInput';
import { ATTACHMENT_ACCEPT, validateAttachment, resolveContentType } from '@/lib/chatFileTypes';
import { useConversationMessages, type Conversation, type ConversationMessage } from '@/hooks/useConversations';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOfflineMessageQueue } from '@/hooks/useOfflineMessageQueue';
import { useMuteConversation } from '@/hooks/useMuteConversation';
import { useDeleteConversation } from '@/hooks/useDeleteConversation';
import { useBlockConversation } from '@/hooks/useBlockConversation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


import { getIsOnline } from '@/lib/connectivityManager';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { getConversationDisplayName, getConversationAvatarProfile, resolveDisplayMember } from '@/lib/conversationDisplayUtils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Loader2,
  Briefcase,
  ChevronLeft,
  RefreshCw,
  Paperclip,
  X,
  Search,
  ChevronUp,
  ChevronDown,
  Pencil,
  Check,
  Bell,
  BellOff,
  MoreVertical,
  Trash2,
  ShieldBan,
} from 'lucide-react';

import { format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MESSAGES_PAGE_SIZE = 200;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
  const { messages, isLoading, isError, refetch, sendMessage, editMessage, markAsRead, fetchOlderMessages, hasMore, loadingOlder } = useConversationMessages(conversation.id);
  const { getReactionsForMessage, toggleReaction } = useMessageReactions(conversation.id);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversation.id);
  const { queueMessage } = useOfflineMessageQueue(currentUserId || undefined);
  const { setMuted, isUpdating: isUpdatingMute } = useMuteConversation();
  const { deleteConversation, isDeleting } = useDeleteConversation();
  const { blockConversation, isBlocking } = useBlockConversation();
  const [confirmAction, setConfirmAction] = useState<'delete' | 'block' | null>(null);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editOriginalContent, setEditOriginalContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevFirstMessageIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchingDb, setSearchingDb] = useState(false);
  const [olderMatchCount, setOlderMatchCount] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getViewportEl = useCallback((): HTMLDivElement | null => {
    if (!scrollAreaRef.current) return null;
    return scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
  }, []);

  const otherMembers = (conversation.members || []).filter(m => m.user_id !== currentUserId);
  const { displayMember, isSelf: isSelfConversation } = resolveDisplayMember(conversation.members, currentUserId);

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
    // Reset search
    setShowSearch(false);
    setSearchQuery('');
    setDebouncedQuery('');
    setSearchMatchIds([]);
    setDbSearchResultIds([]);
    setOlderMatchCount(0);
    setPendingFile(null);
    setEditingMessageId(null);
    setEditOriginalContent('');
  }, [conversation.id]);

  // Track if user is near bottom of scroll area
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement | null;
    if (!target) return;
    const threshold = 100;
    isNearBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
  }, []);

  // Smart scroll
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

  // Scroll to bottom when typing indicator appears
  useEffect(() => {
    const viewport = getViewportEl();
    if (!viewport) return;
    if (typingUsers.length > 0 && isNearBottomRef.current) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [typingUsers, getViewportEl]);

  // Debounce search query (300ms)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedQuery('');
      setSearchMatchIds([]);
      setSearchIndex(0);
      setOlderMatchCount(0);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // DB-powered search: searches ALL messages in conversation (not just loaded)
  const [dbSearchResultIds, setDbSearchResultIds] = useState<string[]>([]);

  useEffect(() => {
    if (!debouncedQuery) {
      setDbSearchResultIds([]);
      return;
    }

    let cancelled = false;
    setSearchingDb(true);

    (async () => {
      try {
        // Escapa ILIKE-wildcards men behåll tecken som punkt, komma och parenteser —
        // värdet citeras i .or() så PostgREST-syntaxen inte krockar med innehållet.
        const escaped = debouncedQuery
          .replace(/\\/g, '\\\\')     // backslash först
          .replace(/%/g, '\\%')       // ILIKE wildcard
          .replace(/_/g, '\\_');      // ILIKE single-char wildcard
        if (!escaped.trim()) {
          if (!cancelled) {
            setDbSearchResultIds([]);
            setSearchMatchIds([]);
            setOlderMatchCount(0);
          }
          return;
        }
        // Citerat värde: dubbelcitat inuti måste escapas för PostgREST.
        const pattern = `"%${escaped.replace(/"/g, '\\"')}%"`;
        const { data, error } = await supabase
          .from('conversation_messages')
          .select('id')
          .eq('conversation_id', conversation.id)
          .eq('is_system_message', false)
          .or(`content.ilike.${pattern},attachment_name.ilike.${pattern}`)

          .order('created_at', { ascending: true });

        if (cancelled) return;

        if (error) {
          // Clear stale results on error instead of keeping old matches
          setDbSearchResultIds([]);
          setSearchMatchIds([]);
          setOlderMatchCount(0);
          return;
        }

        setDbSearchResultIds((data || []).map(m => m.id));
      } catch {
        if (cancelled) return;
        // Fallback to local search
        const query = debouncedQuery.toLowerCase();
        const matches = messages
          .filter(m => !m.is_system_message && (
            m.content.toLowerCase().includes(query) ||
            (m.attachment_name && m.attachment_name.toLowerCase().includes(query))
          ))
          .map(m => m.id);
        setDbSearchResultIds([]);
        setSearchMatchIds(matches);
        setOlderMatchCount(0);
        setSearchIndex(matches.length > 0 ? matches.length - 1 : 0);
      } finally {
        if (!cancelled) setSearchingDb(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, conversation.id]);

  // Separate effect: reconcile DB results with loaded messages (runs when messages update, NOT re-querying DB)
  useEffect(() => {
    if (dbSearchResultIds.length === 0) {
      // DB returned 0 results (or was cleared) — clear local matches too
      if (debouncedQuery) {
        setSearchMatchIds([]);
        setOlderMatchCount(0);
      }
      return;
    }

    const loadedIds = new Set(messages.map(m => m.id));
    const localMatches = dbSearchResultIds.filter(id => loadedIds.has(id));
    const olderCount = dbSearchResultIds.length - localMatches.length;

    setSearchMatchIds(localMatches);
    setOlderMatchCount(olderCount);
    setSearchIndex(prev => Math.min(prev, Math.max(0, localMatches.length - 1)));
  }, [dbSearchResultIds, messages, debouncedQuery]);

  // Scroll to current search match
  useEffect(() => {
    if (searchMatchIds.length === 0) return;
    const matchId = searchMatchIds[searchIndex];
    if (!matchId) return;
    const el = document.getElementById(`msg-${matchId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchIndex, searchMatchIds]);

  // Auto-resize textarea
  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    autoResizeTextarea();
    if (e.target.value.trim()) {
      startTyping(getCurrentUserName());
    }
  };

  // File upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = validateAttachment(file);
    if (!check.ok) {
      toast.error(check.error!, check.description ? { description: check.description } : undefined);
      return;
    }

    setPendingFile(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    let payload: Blob = file;
    let ext = file.name.split('.').pop() || 'bin';
    // Härled MIME-typ från filändelsen när webbläsaren inte kan (HEIC, Pages,
    // gamla Office-format) — annars avvisar serverkontrollen filen.
    let contentType = resolveContentType(file) ?? file.type ?? '';

    // 🎬 Videor i chatten går genom exakt samma kedja som profilvideor:
    // längdgräns → 720p H.264 i enheten → blockera om filen inte går att
    // spela upp överallt. Utan detta kunde en HEVC-video från en iPhone
    // skickas till en arbetsgivare på Android och bara visas som svart ruta.
    if (looksLikeVideoFile(file)) {
      const seconds = await readVideoDurationFromBlob(file);
      if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
        toast.error('Videon är för lång', {
          description: `Max längd är ${MAX_VIDEO_SECONDS} sekunder.`,
        });
        return null;
      }

      let playableEverywhere = false;
      try {
        const { optimizeVideoForUpload } = await import('@/lib/videoTranscode');
        const result = await optimizeVideoForUpload(file);
        payload = result.blob;
        ext = result.extension;
        contentType = result.transcoded ? 'video/mp4' : file.type || 'video/mp4';
        playableEverywhere = result.playableEverywhere;
      } catch (error) {
        console.warn('[ChatView] videokomprimering hoppades över', error);
      }

      if (!playableEverywhere) {
        toast.error('Videoformatet stöds inte', {
          description:
            'Videon kunde inte bearbetas i din webbläsare och skulle inte gå att spela upp på alla enheter. Spara om den som MP4 (H.264) och försök igen.',
        });
        return null;
      }
    }

    const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `${currentUserId}/${conversation.id}/${Date.now()}.${safeExt}`;

    try {
      // 🚀 Resilient upload med retry + exponential backoff
      const { uploadWithRetry } = await import('@/lib/uploadWithProgress');
      setUploadProgress(0);
      await uploadWithRetry({
        bucket: 'message-attachments',
        path,
        file: payload,
        contentType,
        upsert: true,
        // Bilagor är oföränderliga (unik sökväg per fil) → ett års cache gör
        // att samma video aldrig hämtas två gånger av samma mottagare.
        cacheControl: '31536000',
        onProgress: (p) => setUploadProgress(Math.round(p.percent ?? 0)),
      });
      setUploadProgress(null);
    } catch (error) {
      setUploadProgress(null);
      console.error('Upload error:', error);
      toast.error('Kunde inte ladda upp filen');
      return null;
    }

    // Get signed URL (private bucket)
    const { data: signedData } = await supabase.storage
      .from('message-attachments')
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

    if (!signedData?.signedUrl) {
      toast.error('Kunde inte skapa länk till filen');
      return null;
    }

    return {
      url: signedData.signedUrl,
      type: contentType,
      name: file.name,
    };
  };

  // Start editing a message
  const handleStartEdit = useCallback((messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditOriginalContent(currentContent);
    setNewMessage(currentContent);
    setPendingFile(null);
    // Focus textarea after state update
    setTimeout(() => {
      textareaRef.current?.focus();
      autoResizeTextarea();
    }, 50);
  }, [autoResizeTextarea]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditOriginalContent('');
    setNewMessage('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, []);

  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingFile) || sending) return;

    // Handle edit submission
    if (editingMessageId) {
      if (newMessage.trim() === editOriginalContent) {
        // No changes, just cancel
        handleCancelEdit();
        return;
      }
      setSending(true);
      try {
        await editMessage(editingMessageId, newMessage.trim());
        handleCancelEdit();
      } catch (error) {
        console.error('Error editing message:', error);
        toast.error('Kunde inte redigera meddelandet');
      } finally {
        setSending(false);
      }
      return;
    }

    stopTyping(getCurrentUserName());
    setSending(true);

    try {
      if (!getIsOnline() && !pendingFile) {
        queueMessage({
          recipient_id: candidateUserId || otherMembers[0]?.user_id || '',
          content: newMessage.trim(),
          job_id: conversation.job_id,
          application_id: conversation.application_id,
        });
        toast.info('Meddelandet skickas när du är online igen');
        setNewMessage('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      } else {
        // Upload file if pending
        let attachment: { url: string; type: string; name: string } | null = null;
        if (pendingFile) {
          setUploadingFile(true);
          attachment = await uploadFile(pendingFile);
          setUploadingFile(false);
          if (!attachment) {
            setSending(false);
            return;
          }
        }

        await sendMessage(
          newMessage.trim() || (pendingFile ? `📎 ${pendingFile.name}` : ''),
          attachment ? { url: attachment.url, type: attachment.type, name: attachment.name } : undefined,
        );
        setNewMessage('');
        setPendingFile(null);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Kunde inte skicka meddelande');
    } finally {
      setSending(false);
      setUploadingFile(false);
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
    isSelf: isSelfConversation,
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

  const currentSearchMatchId = searchMatchIds[searchIndex] || null;

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

        {/* Tysta konversationen */}
        <button
          type="button"
          onClick={() => setMuted({ conversationId: conversation.id, muted: !conversation.is_muted })}
          disabled={isUpdatingMute}
          aria-label={conversation.is_muted ? 'Slå på notiser för konversationen' : 'Tysta konversationen'}
          title={conversation.is_muted ? 'Notiser är avstängda för den här chatten' : 'Tysta den här chatten'}
          className={cn(
            "p-2 rounded-full transition-colors disabled:opacity-50",
            conversation.is_muted ? "bg-white/15 text-white" : "text-pure-white md:hover:bg-white/10"
          )}
        >
          {conversation.is_muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>

        {/* Search toggle */}
        <button
          onClick={() => { setShowSearch(prev => !prev); if (showSearch) { setSearchQuery(''); setDebouncedQuery(''); setSearchMatchIds([]); setDbSearchResultIds([]); setOlderMatchCount(0); } }}
          className={cn(
            "p-2 rounded-full transition-colors",
            showSearch ? "bg-white/15 text-white" : "text-pure-white md:hover:bg-white/10"
          )}
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Fler åtgärder: radera / blockera permanent */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Fler alternativ för konversationen"
              className="p-2 rounded-full text-pure-white transition-colors md:hover:bg-white/10"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={() => setConfirmAction('delete')}>
              <Trash2 className="mr-2 h-4 w-4" />
              Radera chatten
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setConfirmAction('block')}
              className="text-destructive focus:text-destructive"
            >
              <ShieldBan className="mr-2 h-4 w-4" />
              Blockera användaren
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'block' ? 'Blockera användaren?' : 'Radera chatten?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'block'
                ? 'Personen kan fortsätta skriva, men inget når dig — ingen chatt, notis eller push. Chatten döljs i din inkorg. När du häver blockeringen kommer chatten tillbaka och du kan läsa allt som skrevs under tiden.'
                : 'Konversationen försvinner ur din inkorg. Motparten kan fortfarande skriva, och då dyker chatten upp igen.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting || isBlocking}
              className={confirmAction === 'block' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              onClick={() => {
                if (confirmAction === 'block') {
                  blockConversation({
                    conversationId: conversation.id,
                    userIds: conversation.members
                      .map((m) => m.user_id)
                      .filter((id) => id !== currentUserId),
                  });
                } else {
                  deleteConversation(conversation.id);
                }
                setConfirmAction(null);
                onBack();
              }}
            >
              {confirmAction === 'block' ? 'Blockera' : 'Radera'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {conversation.is_muted && (
        <div className="flex items-start gap-2 border-b border-white/10 bg-white/5 px-4 py-2">
          <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" />
          <p className="min-w-0 break-words text-xs text-white">
            Tystad — nya meddelanden hamnar här men ger ingen notis eller push.
          </p>
        </div>
      )}


      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/10 overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowSearch(false);
                    setSearchQuery('');
                    setDebouncedQuery('');
                    setSearchMatchIds([]);
                    setDbSearchResultIds([]);
                    setOlderMatchCount(0);
                  }
                }}
                placeholder="Sök efter meddelanden & filer..."
                className="h-8 bg-white/5 border-white/10 text-pure-white placeholder:text-pure-white text-sm"
                autoFocus
              />
              {searchingDb && (
                <Loader2 className="h-3.5 w-3.5 text-pure-white animate-spin flex-shrink-0" />
              )}
              {!searchingDb && searchMatchIds.length > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-pure-white text-xs whitespace-nowrap">
                    {searchIndex + 1}/{searchMatchIds.length}
                    {olderMatchCount > 0 && (
                      <span className="text-pure-white/60"> (+{olderMatchCount})</span>
                    )}
                  </span>
                  <button onClick={() => setSearchIndex(i => Math.max(0, i - 1))} className="p-1 text-pure-white md:hover:text-white">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setSearchIndex(i => Math.min(searchMatchIds.length - 1, i + 1))} className="p-1 text-pure-white md:hover:text-white">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {!searchingDb && debouncedQuery && searchMatchIds.length === 0 && olderMatchCount === 0 && (
                <span className="text-pure-white text-xs whitespace-nowrap">Inga träffar</span>
              )}
              {!searchingDb && searchMatchIds.length === 0 && olderMatchCount > 0 && (
                <span className="text-pure-white text-xs whitespace-nowrap">{olderMatchCount} i äldre</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

                    const isOwnMsg = msg.sender_id === currentUserId;
                    const isRead = isOwnMsg && otherMemberLastRead
                      ? otherMemberLastRead >= new Date(msg.created_at)
                      : false;

                    const isSearchHighlighted = currentSearchMatchId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className={cn(
                          "transition-colors rounded-lg",
                          isSearchHighlighted && "bg-yellow-500/10 ring-1 ring-yellow-500/30 p-1 -m-1"
                        )}
                      >
                        <MessageBubble
                          message={resolvedMessage}
                          isOwn={isOwnMsg}
                          showAvatar={idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id}
                          isGroup={conversation.is_group}
                          currentUserRole={currentUserRole}
                          isRead={isRead}
                          reactions={!msg.id.startsWith('temp-') ? getReactionsForMessage(msg.id) : []}
                          onToggleReaction={!msg.id.startsWith('temp-') ? (emoji) => toggleReaction({ messageId: msg.id, emoji }) : undefined}
                          onEdit={handleStartEdit}
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

      {/* Pending file preview */}
      {pendingFile && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2">
          <div className="flex flex-col gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="h-3.5 w-3.5 text-pure-white flex-shrink-0" />
              <span className="text-sm text-pure-white truncate">{pendingFile.name}</span>
              <span className="text-pure-white text-xs flex-shrink-0">
                {pendingFile.size >= 1024 * 1024
                  ? `${(pendingFile.size / (1024 * 1024)).toFixed(1)} MB`
                  : `${(pendingFile.size / 1024).toFixed(0)} KB`}
              </span>
            </div>
            {uploadProgress !== null && (
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-[width] duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-[10px] text-pure-white tabular-nums">{uploadProgress}%</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setPendingFile(null)}
            disabled={uploadingFile}
            className="p-1.5 rounded-full md:hover:bg-white/10 text-pure-white disabled:opacity-40"
            aria-label="Ta bort bilaga"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Edit indicator */}
      {editingMessageId && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-sm text-pure-white flex-1 truncate">Redigerar meddelande</span>
          <button
            onClick={handleCancelEdit}
            className="p-1.5 rounded-full md:hover:bg-white/10 text-pure-white active:scale-95 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-end gap-2">
          {/* File attach button - hidden during edit */}
          {!editingMessageId && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-xl text-pure-white md:hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Bifoga fil"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.heic,.heif,.mp4,.m4v,.mov,.webm,.3gp,.3g2,.mkv,.mp3,.m4a,.aac,.wav,.ogg,.opus,.pdf,.doc,.docx,.rtf,.odt,.odp,.ods,.pages,.numbers,.key,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.json,.zip,.rar,.7z"
          />

          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && editingMessageId) {
                handleCancelEdit();
                return;
              }
              handleKeyDown(e);
            }}
            placeholder={editingMessageId ? "Redigera meddelandet..." : "Skriv ett meddelande..."}
            className={cn(
              "min-h-[44px] max-h-32 resize-none bg-white/5 border-white/10 text-pure-white placeholder:text-pure-white rounded-xl",
              editingMessageId && "border-blue-500/30"
            )}
            rows={1}
          />
          <Button
            variant="glass"
            size="icon"
            aria-label={editingMessageId ? "Spara ändring" : "Skicka meddelande"}
            onClick={handleSend}
            disabled={(!newMessage.trim() && !pendingFile) || sending}
            className={cn(
              "h-11 w-11 flex-shrink-0",
              editingMessageId
                ? "bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30"
                : "bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30"
            )}
          >
            {sending || uploadingFile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingMessageId ? (
              <Check className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

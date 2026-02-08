import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  sender_profile?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    profile_image_url: string | null;
    company_logo_url: string | null;
    role: 'job_seeker' | 'employer';
  };
  recipient_profile?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    profile_image_url: string | null;
    company_logo_url: string | null;
    role: 'job_seeker' | 'employer';
  };
  job?: {
    title: string;
  };
}

// Cache key for localStorage
const MESSAGES_CACHE_KEY = 'parium_messages_cache';
const PAGE_SIZE = 50; // Messages per page

function getMessagesFromCache(): { inbox: Message[]; sent: Message[]; timestamp: number } | null {
  try {
    const cached = localStorage.getItem(MESSAGES_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Cache valid for 5 minutes
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return parsed;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function setMessagesCache(inbox: Message[], sent: Message[]) {
  try {
    localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify({
      inbox,
      sent,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore cache errors
  }
}

// Fetch messages with cursor-based pagination
async function fetchMessagePage(
  userId: string,
  type: 'inbox' | 'sent',
  cursor?: string
): Promise<{ messages: Message[]; nextCursor: string | null }> {
  const column = type === 'inbox' ? 'recipient_id' : 'sender_id';
  
  let query = supabase
    .from('messages')
    .select(`*, job:job_id (title)`)
    .eq(column, userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  
  // Cursor-based: fetch messages older than the cursor
  if (cursor) {
    query = query.lt('created_at', cursor);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  const messages = data || [];
  const nextCursor = messages.length === PAGE_SIZE 
    ? messages[messages.length - 1]?.created_at 
    : null;
  
  return { messages, nextCursor };
}

// Fetch profile data for a batch of user IDs
async function fetchProfiles(userIds: string[]): Promise<Map<string, Message['sender_profile']>> {
  if (userIds.length === 0) return new Map();
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
    .in('user_id', userIds);
  
  return new Map(profiles?.map(p => [p.user_id, p]) || []);
}

export function useMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get cached data for instant load
  const cachedData = getMessagesFromCache();

  // Infinite query for inbox messages with cursor-based pagination
  const inboxQuery = useInfiniteQuery({
    queryKey: ['messages', 'inbox', user?.id],
    queryFn: async ({ pageParam }) => {
      if (!user) return { messages: [], nextCursor: null };
      return fetchMessagePage(user.id, 'inbox', pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!user,
    staleTime: Infinity, // Never refetch — realtime handles all updates
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Infinite query for sent messages with cursor-based pagination
  const sentQuery = useInfiniteQuery({
    queryKey: ['messages', 'sent', user?.id],
    queryFn: async ({ pageParam }) => {
      if (!user) return { messages: [], nextCursor: null };
      return fetchMessagePage(user.id, 'sent', pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!user,
    staleTime: Infinity, // Never refetch — realtime handles all updates
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Flatten pages into message arrays
  const rawInbox = useMemo(() => 
    inboxQuery.data?.pages.flatMap(p => p.messages) || [],
    [inboxQuery.data]
  );
  
  const rawSent = useMemo(() => 
    sentQuery.data?.pages.flatMap(p => p.messages) || [],
    [sentQuery.data]
  );

  // Fetch and attach profiles to messages
  const messagesWithProfilesQuery = useQuery({
    queryKey: ['messages', 'profiles', rawInbox.length, rawSent.length],
    queryFn: async () => {
      const inboxSenderIds = [...new Set(rawInbox.map(m => m.sender_id))];
      const sentRecipientIds = [...new Set(rawSent.map(m => m.recipient_id))];
      const allUserIds = [...new Set([...inboxSenderIds, ...sentRecipientIds])];
      
      const profileMap = await fetchProfiles(allUserIds);
      
      const inbox = rawInbox.map(msg => ({
        ...msg,
        sender_profile: profileMap.get(msg.sender_id) || null,
      })) as Message[];

      const sent = rawSent.map(msg => ({
        ...msg,
        recipient_profile: profileMap.get(msg.recipient_id) || null,
      })) as Message[];

      // Update cache
      setMessagesCache(inbox, sent);

      return { inbox, sent };
    },
    enabled: rawInbox.length > 0 || rawSent.length > 0,
    staleTime: Infinity,
    // Use cached data for instant load
    initialData: cachedData ? { inbox: cachedData.inbox, sent: cachedData.sent } : undefined,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          // Invalidate and refetch when we receive a new message
          queryClient.invalidateQueries({ queryKey: ['messages', 'inbox', user.id] });
          queryClient.invalidateQueries({ queryKey: ['messages', 'profiles'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${user.id}`,
        },
        () => {
          // Invalidate when we send a message
          queryClient.invalidateQueries({ queryKey: ['messages', 'sent', user.id] });
          queryClient.invalidateQueries({ queryKey: ['messages', 'profiles'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Mark message as read with optimistic update
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!navigator.onLine) return;
      
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;
    },
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ['messages'] });
      
      // Optimistically update the profiles query data
      queryClient.setQueryData(['messages', 'profiles', rawInbox.length, rawSent.length], 
        (old: { inbox: Message[]; sent: Message[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            inbox: old.inbox.map(m => 
              m.id === messageId ? { ...m, is_read: true } : m
            ),
          };
        }
      );
    },
  });

  // Load more functions
  const loadMoreInbox = useCallback(() => {
    if (inboxQuery.hasNextPage && !inboxQuery.isFetchingNextPage) {
      inboxQuery.fetchNextPage();
    }
  }, [inboxQuery]);

  const loadMoreSent = useCallback(() => {
    if (sentQuery.hasNextPage && !sentQuery.isFetchingNextPage) {
      sentQuery.fetchNextPage();
    }
  }, [sentQuery]);

  // Get unread count
  const inbox = messagesWithProfilesQuery.data?.inbox || cachedData?.inbox || [];
  const sent = messagesWithProfilesQuery.data?.sent || cachedData?.sent || [];
  const unreadCount = inbox.filter(m => !m.is_read).length;

  const refetch = useCallback(() => {
    inboxQuery.refetch();
    sentQuery.refetch();
  }, [inboxQuery, sentQuery]);

  return {
    inbox,
    sent,
    isLoading: inboxQuery.isLoading || sentQuery.isLoading,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    refetch,
    // Pagination helpers
    loadMoreInbox,
    loadMoreSent,
    hasMoreInbox: !!inboxQuery.hasNextPage,
    hasMoreSent: !!sentQuery.hasNextPage,
    isLoadingMoreInbox: inboxQuery.isFetchingNextPage,
    isLoadingMoreSent: sentQuery.isFetchingNextPage,
  };
}

// Hook for background preloading - call this in layout/app component
export function useMessagesPreload() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Prefetch messages data in background
    queryClient.prefetchQuery({
      queryKey: ['messages', 'all', user.id],
      queryFn: async () => {
        const [inboxResult, sentResult] = await Promise.all([
          supabase
            .from('messages')
            .select(`*, job:job_id (title)`)
            .eq('recipient_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('messages')
            .select(`*, job:job_id (title)`)
            .eq('sender_id', user.id)
            .order('created_at', { ascending: false }),
        ]);

        const allUserIds = [
          ...new Set([
            ...(inboxResult.data?.map(m => m.sender_id) || []),
            ...(sentResult.data?.map(m => m.recipient_id) || []),
          ])
        ];

        let profileMap = new Map();
        if (allUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
            .in('user_id', allUserIds);
          profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        }

        const inbox = (inboxResult.data || []).map(msg => ({
          ...msg,
          sender_profile: profileMap.get(msg.sender_id) || null,
        }));

        const sent = (sentResult.data || []).map(msg => ({
          ...msg,
          recipient_profile: profileMap.get(msg.recipient_id) || null,
        }));

        setMessagesCache(inbox, sent);
        return { inbox, sent };
      },
      staleTime: Infinity,
    });
  }, [user, queryClient]);
}

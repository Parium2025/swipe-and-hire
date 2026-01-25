import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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

export function useMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get cached data for instant load
  const cachedData = getMessagesFromCache();

  // Fetch all messages in a single optimized query
  const messagesQuery = useQuery({
    queryKey: ['messages', 'all', user?.id],
    queryFn: async () => {
      if (!user) return { inbox: [], sent: [] };

      // Fetch inbox and sent in parallel
      const [inboxResult, sentResult] = await Promise.all([
        supabase
          .from('messages')
          .select(`
            *,
            job:job_id (title)
          `)
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('messages')
          .select(`
            *,
            job:job_id (title)
          `)
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (inboxResult.error) throw inboxResult.error;
      if (sentResult.error) throw sentResult.error;

      // Get unique user IDs for profile lookup
      const inboxSenderIds = [...new Set(inboxResult.data?.map(m => m.sender_id) || [])];
      const sentRecipientIds = [...new Set(sentResult.data?.map(m => m.recipient_id) || [])];
      const allUserIds = [...new Set([...inboxSenderIds, ...sentRecipientIds])];

      // Fetch all profiles in one query (optimized join alternative)
      let profileMap = new Map<string, Message['sender_profile']>();
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
      })) as Message[];

      const sent = (sentResult.data || []).map(msg => ({
        ...msg,
        recipient_profile: profileMap.get(msg.recipient_id) || null,
      })) as Message[];

      // Update cache
      setMessagesCache(inbox, sent);

      return { inbox, sent };
    },
    enabled: !!user,
    // Use cache as initial data for instant load
    initialData: cachedData ? { inbox: cachedData.inbox, sent: cachedData.sent } : undefined,
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
    refetchInterval: 60 * 1000, // Background refresh every minute
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
          queryClient.invalidateQueries({ queryKey: ['messages', 'all', user.id] });
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
          queryClient.invalidateQueries({ queryKey: ['messages', 'all', user.id] });
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', 'all'] });

      // Get current data
      const previousData = queryClient.getQueryData(['messages', 'all', user?.id]);

      // Optimistically update
      queryClient.setQueryData(['messages', 'all', user?.id], (old: { inbox: Message[]; sent: Message[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          inbox: old.inbox.map(m => 
            m.id === messageId ? { ...m, is_read: true } : m
          ),
        };
      });

      return { previousData };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['messages', 'all', user?.id], context.previousData);
      }
    },
  });

  // Get unread count
  const unreadCount = messagesQuery.data?.inbox?.filter(m => !m.is_read).length || 0;

  return {
    inbox: messagesQuery.data?.inbox || [],
    sent: messagesQuery.data?.sent || [],
    isLoading: messagesQuery.isLoading,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    refetch: () => messagesQuery.refetch(),
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
      staleTime: 30 * 1000,
    });
  }, [user, queryClient]);
}

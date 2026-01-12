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

export function useMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch received messages (inbox)
  const inboxQuery = useQuery({
    queryKey: ['messages', 'inbox', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          job:job_id (title)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles separately
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      if (senderIds.length === 0) return [];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(msg => ({
        ...msg,
        sender_profile: profileMap.get(msg.sender_id) || null,
      })) as Message[];
    },
    enabled: !!user,
  });

  // Fetch sent messages
  const sentQuery = useQuery({
    queryKey: ['messages', 'sent', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          job:job_id (title)
        `)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch recipient profiles separately
      const recipientIds = [...new Set(data?.map(m => m.recipient_id) || [])];
      if (recipientIds.length === 0) return [];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
        .in('user_id', recipientIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(msg => ({
        ...msg,
        recipient_profile: profileMap.get(msg.recipient_id) || null,
      })) as Message[];
    },
    enabled: !!user,
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
          // Invalidate inbox when we receive a new message
          queryClient.invalidateQueries({ queryKey: ['messages', 'inbox', user.id] });
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
          // Invalidate sent when we send a message
          queryClient.invalidateQueries({ queryKey: ['messages', 'sent', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Mark message as read
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
    },
  });

  // Get unread count
  const unreadCount = inboxQuery.data?.filter(m => !m.is_read).length || 0;

  return {
    inbox: inboxQuery.data || [],
    sent: sentQuery.data || [],
    isLoading: inboxQuery.isLoading || sentQuery.isLoading,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    refetch: () => {
      inboxQuery.refetch();
      sentQuery.refetch();
    },
  };
}

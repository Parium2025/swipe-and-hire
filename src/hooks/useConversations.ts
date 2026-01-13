import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ConversationMember {
  user_id: string;
  is_admin: boolean;
  last_read_at: string | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    profile_image_url: string | null;
    company_logo_url: string | null;
    role: 'job_seeker' | 'employer';
  };
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_system_message: boolean;
  sender_profile?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    profile_image_url: string | null;
    company_logo_url: string | null;
    role: 'job_seeker' | 'employer';
  };
}

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  job_id: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string | null;
  members: ConversationMember[];
  last_message?: ConversationMessage;
  unread_count: number;
  job?: {
    title: string;
  };
}

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all conversations for current user
  const conversationsQuery = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // First get all conversation IDs where user is a member
      const { data: memberships, error: memberError } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) return [];

      const conversationIds = memberships.map(m => m.conversation_id);
      const lastReadMap = new Map(memberships.map(m => [m.conversation_id, m.last_read_at]));

      // Fetch conversations with job info
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          job:job_id (title)
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (convError) throw convError;
      if (!conversations) return [];

      // Fetch all members for these conversations
      const { data: allMembers, error: membersError } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id, is_admin, last_read_at')
        .in('conversation_id', conversationIds);

      if (membersError) throw membersError;

      // Get unique user IDs to fetch profiles
      const allUserIds = [...new Set(allMembers?.map(m => m.user_id) || [])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
        .in('user_id', allUserIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Fetch last message for each conversation
      const { data: lastMessages } = await supabase
        .from('conversation_messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      // Group last messages by conversation
      const lastMessageMap = new Map<string, ConversationMessage>();
      lastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, {
            ...msg,
            sender_profile: profileMap.get(msg.sender_id) || undefined,
          });
        }
      });

      // Count unread messages per conversation
      const unreadCounts = new Map<string, number>();
      for (const conv of conversations) {
        const lastRead = lastReadMap.get(conv.id);
        if (!lastRead) {
          // Count all messages
          const { count } = await supabase
            .from('conversation_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id);
          unreadCounts.set(conv.id, count || 0);
        } else {
          // Count messages after last read
          const { count } = await supabase
            .from('conversation_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .gt('created_at', lastRead);
          unreadCounts.set(conv.id, count || 0);
        }
      }

      // Build final conversation objects
      return conversations.map(conv => {
        const members = (allMembers || [])
          .filter(m => m.conversation_id === conv.id)
          .map(m => ({
            ...m,
            profile: profileMap.get(m.user_id),
          }));

        return {
          ...conv,
          members,
          last_message: lastMessageMap.get(conv.id),
          unread_count: unreadCounts.get(conv.id) || 0,
        } as Conversation;
      });
    },
    enabled: !!user,
  });

  // Subscribe to realtime updates for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
        },
        () => {
          // Refresh conversations when new message arrives
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Total unread count across all conversations
  const totalUnreadCount = conversationsQuery.data?.reduce((sum, c) => sum + c.unread_count, 0) || 0;

  return {
    conversations: conversationsQuery.data || [],
    isLoading: conversationsQuery.isLoading,
    totalUnreadCount,
    refetch: conversationsQuery.refetch,
  };
}

export function useConversationMessages(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data: messages, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(messages?.map(m => m.sender_id) || [])];
      if (senderIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (messages || []).map(msg => ({
        ...msg,
        sender_profile: profileMap.get(msg.sender_id),
      })) as ConversationMessage[];
    },
    enabled: !!conversationId,
  });

  // Subscribe to realtime messages for this conversation
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Mark conversation as read
  const markAsRead = useCallback(async () => {
    if (!conversationId || !user) return;

    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
  }, [conversationId, user, queryClient]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !user || !content.trim()) return;

    const { error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim(),
      });

    if (error) throw error;

    // Update last read
    await markAsRead();
  }, [conversationId, user, markAsRead]);

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    sendMessage,
    markAsRead,
    refetch: messagesQuery.refetch,
  };
}

// Create a new conversation
export function useCreateConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      memberIds, 
      name, 
      isGroup = false,
      jobId = null,
      initialMessage,
    }: {
      memberIds: string[];
      name?: string;
      isGroup?: boolean;
      jobId?: string | null;
      initialMessage?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // For 1-1 chats, check if conversation already exists
      if (!isGroup && memberIds.length === 1) {
        const otherUserId = memberIds[0];
        
        // Find existing 1-1 conversation
        const { data: existingMemberships } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', user.id);

        if (existingMemberships) {
          for (const membership of existingMemberships) {
            const { data: otherMember } = await supabase
              .from('conversation_members')
              .select('user_id')
              .eq('conversation_id', membership.conversation_id)
              .eq('user_id', otherUserId)
              .single();

            if (otherMember) {
              // Check if it's a 1-1 (only 2 members)
              const { count } = await supabase
                .from('conversation_members')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', membership.conversation_id);

              if (count === 2) {
                // Found existing 1-1 conversation
                return { id: membership.conversation_id, isExisting: true };
              }
            }
          }
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: isGroup ? name : null,
          is_group: isGroup,
          job_id: jobId,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add creator as admin member
      const { error: creatorError } = await supabase
        .from('conversation_members')
        .insert({
          conversation_id: conversation.id,
          user_id: user.id,
          is_admin: true,
        });

      if (creatorError) throw creatorError;

      // Add other members
      for (const memberId of memberIds) {
        if (memberId !== user.id) {
          await supabase
            .from('conversation_members')
            .insert({
              conversation_id: conversation.id,
              user_id: memberId,
              is_admin: false,
            });
        }
      }

      // Send initial message if provided
      if (initialMessage) {
        await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: conversation.id,
            sender_id: user.id,
            content: initialMessage,
          });
      }

      return { id: conversation.id, isExisting: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

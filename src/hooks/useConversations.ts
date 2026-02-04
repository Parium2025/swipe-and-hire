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

// 🔥 localStorage cache for instant-load
const CONVERSATIONS_CACHE_KEY = 'parium_conversations_cache';

interface CachedConversations {
  userId: string;
  conversations: Conversation[];
  timestamp: number;
}

function readConversationsCache(userId: string): Conversation[] | null {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedConversations = JSON.parse(raw);
    // Only use if same user
    if (cached.userId !== userId) return null;
    // Don't use empty cache as valid data - force refetch
    if (cached.conversations.length === 0) return null;
    return cached.conversations;
  } catch {
    return null;
  }
}

function writeConversationsCache(userId: string, conversations: Conversation[]): void {
  try {
    const cached: CachedConversations = {
      userId,
      conversations: conversations.slice(0, 50), // Max 50 to save space
      timestamp: Date.now(),
    };
    localStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check for cached data BEFORE query runs
  const hasCachedData = user ? readConversationsCache(user.id) !== null : false;

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
      if (!memberships || memberships.length === 0) {
        writeConversationsCache(user.id, []);
        return [];
      }

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

      // Fetch ALL messages for these conversations in ONE query
      // We'll use this to calculate both last_message AND unread_count
      const { data: allMessages } = await supabase
        .from('conversation_messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      // Group last messages by conversation
      const lastMessageMap = new Map<string, ConversationMessage>();
      const unreadCounts = new Map<string, number>();
      
      // Initialize unread counts
      conversationIds.forEach(id => unreadCounts.set(id, 0));
      
      // Process all messages in memory (much faster than N database calls)
      allMessages?.forEach(msg => {
        // Track last message per conversation
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, {
            ...msg,
            sender_profile: profileMap.get(msg.sender_id) || undefined,
          });
        }
        
        // Count unread messages (not from current user, after last_read)
        if (msg.sender_id !== user.id) {
          const lastRead = lastReadMap.get(msg.conversation_id);
          if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
            unreadCounts.set(
              msg.conversation_id, 
              (unreadCounts.get(msg.conversation_id) || 0) + 1
            );
          }
        }
      });

      // Build final conversation objects
      const result = conversations.map(conv => {
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

      // 🔥 Cache for instant-load on next visit
      writeConversationsCache(user.id, result);

      return result;
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    // 🔥 Instant-load from localStorage cache
    initialData: () => {
      if (!user) return undefined;
      const cached = readConversationsCache(user.id);
      return cached ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!user) return undefined;
      const cached = readConversationsCache(user.id);
      return cached ? Date.now() - 60000 : undefined; // Trigger background refetch
    },
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

  // Subscribe to realtime messages for this conversation - instant cache update
  useEffect(() => {
    if (!conversationId || !user) return;

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
        async (payload) => {
          const newMessage = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            content: string;
            created_at: string;
            is_system_message: boolean;
          };

          // Skip if it's our own message (we already added it optimistically)
          if (newMessage.sender_id === user.id) return;

          // Fetch sender profile for the new message
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
            .eq('user_id', newMessage.sender_id)
            .single();

          // Add message directly to cache - instant update!
          queryClient.setQueryData<ConversationMessage[]>(
            ['conversation-messages', conversationId],
            (old) => {
              if (!old) return [{ ...newMessage, sender_profile: senderProfile || undefined }];
              
              // Check if message already exists
              if (old.some(m => m.id === newMessage.id)) return old;
              
              return [...old, { ...newMessage, sender_profile: senderProfile || undefined }];
            }
          );

          // Also update conversation list to show new last message
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, queryClient]);

  // Mark conversation as read
  const markAsRead = useCallback(async () => {
    if (!conversationId || !user) return;
    if (!navigator.onLine) return; // Silent fail for mark as read - non-critical

    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
  }, [conversationId, user, queryClient]);

  // Send message with optimistic update - instant UI feedback
  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !user || !content.trim()) return;
    if (!navigator.onLine) throw new Error('Du är offline');

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ConversationMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      is_system_message: false,
      sender_profile: undefined, // Will be filled by realtime update
    };

    // Add message to cache immediately (optimistic)
    queryClient.setQueryData<ConversationMessage[]>(
      ['conversation-messages', conversationId],
      (old) => [...(old || []), optimisticMessage]
    );

    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp message with real one
      queryClient.setQueryData<ConversationMessage[]>(
        ['conversation-messages', conversationId],
        (old) => old?.map(m => m.id === tempId ? { ...data, sender_profile: optimisticMessage.sender_profile } : m) || []
      );

      // Update last read
      await markAsRead();
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData<ConversationMessage[]>(
        ['conversation-messages', conversationId],
        (old) => old?.filter(m => m.id !== tempId) || []
      );
      throw error;
    }
  }, [conversationId, user, markAsRead, queryClient]);

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
      if (!navigator.onLine) throw new Error('Du är offline');

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

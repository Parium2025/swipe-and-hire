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

// Frozen profile from job application - used for employer-candidate conversations
export interface ApplicationSnapshot {
  application_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_image_snapshot_url: string | null;
  video_snapshot_url: string | null;
  cv_url: string | null;
  job_title: string | null;
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
  application_id: string | null; // Current job context - updates when switching jobs
  candidate_id: string | null; // The job seeker user ID - one conversation per candidate
  created_by: string;
  created_at: string;
  last_message_at: string | null;
  members: ConversationMember[];
  last_message?: ConversationMessage;
  unread_count: number;
  job?: {
    title: string;
  };
  // Frozen profile snapshot from current application context (for employer-candidate chats)
  applicationSnapshot?: ApplicationSnapshot;
}

// 🔥 localStorage cache for instant-load
const CONVERSATIONS_CACHE_KEY = 'parium_conversations_cache';
// Bump this version when cache structure changes or when we need to invalidate old data
const CACHE_VERSION = 4; // v4: unified per-candidate conversations with candidate_id

interface CachedConversations {
  userId: string;
  conversations: Conversation[];
  timestamp: number;
  version?: number;
}

function readConversationsCache(userId: string): Conversation[] | null {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedConversations = JSON.parse(raw);
    // Only use if same user
    if (cached.userId !== userId) return null;
    // Invalidate old cache versions (missing profiles, etc.)
    if (!cached.version || cached.version < CACHE_VERSION) {
      localStorage.removeItem(CONVERSATIONS_CACHE_KEY);
      return null;
    }
    // Don't use empty cache as valid data - force refetch
    if (cached.conversations.length === 0) return null;

    // If we somehow cached a 1:1 conversation with only our own membership row,
    // the UI will show “Okänd användare”. Invalidate that cache.
    const hasMissingOtherMember = cached.conversations.some((conv) => {
      if (conv.is_group) return false;
      const otherMembers = (conv.members || []).filter((m) => m.user_id !== userId);
      return otherMembers.length === 0;
    });
    if (hasMissingOtherMember) {
      localStorage.removeItem(CONVERSATIONS_CACHE_KEY);
      return null;
    }

    // Validate that cached conversations have profile data
    // If any member is missing profile info, invalidate cache
    const hasMissingProfiles = cached.conversations.some(conv => 
      conv.members.some(m => !m.profile?.first_name && !m.profile?.company_name)
    );
    if (hasMissingProfiles) {
      localStorage.removeItem(CONVERSATIONS_CACHE_KEY);
      return null;
    }
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
      version: CACHE_VERSION,
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

      // Get application_ids for conversations that have them
      const applicationIds = conversations
        .map(c => c.application_id)
        .filter((id): id is string => id !== null);

      // Fetch application snapshots for frozen profile data
      let applicationSnapshotMap = new Map<string, ApplicationSnapshot>();
      if (applicationIds.length > 0) {
        const { data: applications } = await supabase
          .from('job_applications')
          .select(`
            id,
            first_name,
            last_name,
            profile_image_snapshot_url,
            video_snapshot_url,
            cv_url,
            job:job_id (title)
          `)
          .in('id', applicationIds);

        if (applications) {
          applications.forEach(app => {
            applicationSnapshotMap.set(app.id, {
              application_id: app.id,
              first_name: app.first_name,
              last_name: app.last_name,
              profile_image_snapshot_url: app.profile_image_snapshot_url,
              video_snapshot_url: app.video_snapshot_url,
              cv_url: app.cv_url,
              job_title: (app.job as any)?.title || null,
            });
          });
        }
      }

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
          // Include frozen profile snapshot from application if available
          applicationSnapshot: conv.application_id 
            ? applicationSnapshotMap.get(conv.application_id) 
            : undefined,
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

// Create or find unified conversation per candidate
// One thread per candidate - job context can change with system messages
export function useCreateConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      memberIds, 
      name, 
      isGroup = false,
      jobId = null,
      applicationId = null,
      initialMessage,
    }: {
      memberIds: string[];
      name?: string;
      isGroup?: boolean;
      jobId?: string | null;
      applicationId?: string | null;
      initialMessage?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      if (!navigator.onLine) throw new Error('Du är offline');

      const candidateId = memberIds[0]; // The job seeker
      let conversationId: string | null = null;
      let isExisting = false;
      let needsJobContextSwitch = false;
      let previousApplicationId: string | null = null;

      // For 1-1 chats, look for existing unified conversation with this candidate
      if (!isGroup && memberIds.length === 1) {
        // Find conversation by candidate_id (new unified approach)
        const { data: existingByCandidate } = await supabase
          .from('conversations')
          .select('id, application_id')
          .eq('candidate_id', candidateId)
          .not('candidate_id', 'is', null)
          .single();

        if (existingByCandidate) {
          conversationId = existingByCandidate.id;
          isExisting = true;
          previousApplicationId = existingByCandidate.application_id;
          
          // Check if job context is changing
          if (applicationId && applicationId !== previousApplicationId) {
            needsJobContextSwitch = true;
          }
        } else {
          // Fallback: look for legacy conversations (by application_id or membership)
          if (applicationId) {
            const { data: legacyByApp } = await supabase
              .from('conversations')
              .select('id, application_id')
              .eq('application_id', applicationId)
              .single();

            if (legacyByApp) {
              // Migrate: set candidate_id on this conversation
              await supabase
                .from('conversations')
                .update({ candidate_id: candidateId })
                .eq('id', legacyByApp.id);
              
              conversationId = legacyByApp.id;
              isExisting = true;
            }
          }

          // Still no conversation? Check by membership
          if (!conversationId) {
            const { data: myMemberships } = await supabase
              .from('conversation_members')
              .select('conversation_id')
              .eq('user_id', user.id);

            if (myMemberships) {
              for (const membership of myMemberships) {
                const { data: otherMember } = await supabase
                  .from('conversation_members')
                  .select('user_id')
                  .eq('conversation_id', membership.conversation_id)
                  .eq('user_id', candidateId)
                  .single();

                if (otherMember) {
                  const { count } = await supabase
                    .from('conversation_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('conversation_id', membership.conversation_id);

                  if (count === 2) {
                    // Found existing 1-1 - migrate to unified model
                    const { data: conv } = await supabase
                      .from('conversations')
                      .select('application_id')
                      .eq('id', membership.conversation_id)
                      .single();

                    await supabase
                      .from('conversations')
                      .update({ candidate_id: candidateId })
                      .eq('id', membership.conversation_id);

                    conversationId = membership.conversation_id;
                    isExisting = true;
                    previousApplicationId = conv?.application_id || null;
                    
                    if (applicationId && applicationId !== previousApplicationId) {
                      needsJobContextSwitch = true;
                    }
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // Create new conversation if none exists
      if (!conversationId) {
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            name: isGroup ? name : null,
            is_group: isGroup,
            job_id: jobId,
            application_id: applicationId,
            candidate_id: isGroup ? null : candidateId, // Set candidate_id for 1-1 chats
            created_by: user.id,
          })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = conversation.id;

        // Add creator as admin member
        await supabase
          .from('conversation_members')
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
            is_admin: true,
          });

        // Add other members
        for (const memberId of memberIds) {
          if (memberId !== user.id) {
            await supabase
              .from('conversation_members')
              .insert({
                conversation_id: conversationId,
                user_id: memberId,
                is_admin: false,
              });
          }
        }
      }

      // Handle job context switch - update application_id and add system message
      if (needsJobContextSwitch && applicationId && conversationId) {
        // Get job title for the system message
        const { data: application } = await supabase
          .from('job_applications')
          .select('job:job_id (title)')
          .eq('id', applicationId)
          .single();

        const jobTitle = (application?.job as any)?.title || 'Okänd tjänst';

        // Atomär transaktion: båda operationerna lyckas eller ingen
        // Premium Spotify-känsla - inga inkonsistenta tillstånd möjliga
        const { error: switchError } = await supabase.rpc('switch_conversation_job_context', {
          p_conversation_id: conversationId,
          p_new_application_id: applicationId,
          p_new_job_id: jobId,
          p_job_title: jobTitle,
        });

        if (switchError) {
          console.error('Failed to switch job context:', switchError);
          // Non-critical: conversation still works, just without the marker
        }
      }

      // Send initial message if provided
      if (initialMessage && conversationId) {
        await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: initialMessage,
          });
      }

      return { id: conversationId, isExisting, jobContextSwitched: needsJobContextSwitch };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

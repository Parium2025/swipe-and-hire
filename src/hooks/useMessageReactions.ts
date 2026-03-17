import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

/** Grouped reaction for display: emoji + count + whether current user reacted */
export interface GroupedReaction {
  emoji: string;
  count: number;
  hasOwn: boolean;
}

export function useMessageReactions(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all reactions for messages in this conversation
  const reactionsQuery = useQuery({
    queryKey: ['message-reactions', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      // Get message IDs for this conversation from cache
      const messages = queryClient.getQueryData<any[]>(['conversation-messages', conversationId]);
      const messageIds = messages?.map(m => m.id).filter(id => !id.startsWith('temp-')) || [];
      
      if (messageIds.length === 0) return [];

      const { data, error } = await supabase
        .from('conversation_message_reactions')
        .select('*')
        .in('message_id', messageIds);

      if (error) throw error;
      return (data || []) as MessageReaction[];
    },
    enabled: !!conversationId,
    staleTime: 30 * 1000,
  });

  // Realtime subscription for reactions
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`reactions-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_message_reactions',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['message-reactions', conversationId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Toggle reaction (add if not exists, remove if exists)
  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if reaction already exists
      const { data: existing } = await supabase
        .from('conversation_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        // Remove reaction
        await supabase
          .from('conversation_message_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        // Add reaction
        await supabase
          .from('conversation_message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', conversationId] });
    },
  });

  // Group reactions by message ID
  const getReactionsForMessage = (messageId: string): GroupedReaction[] => {
    const reactions = reactionsQuery.data || [];
    const messageReactions = reactions.filter(r => r.message_id === messageId);
    
    const grouped = new Map<string, { count: number; hasOwn: boolean }>();
    messageReactions.forEach(r => {
      const existing = grouped.get(r.emoji) || { count: 0, hasOwn: false };
      existing.count++;
      if (r.user_id === user?.id) existing.hasOwn = true;
      grouped.set(r.emoji, existing);
    });

    return Array.from(grouped.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasOwn: data.hasOwn,
    }));
  };

  return {
    getReactionsForMessage,
    toggleReaction: toggleReaction.mutate,
    isToggling: toggleReaction.isPending,
  };
}

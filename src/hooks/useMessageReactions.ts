import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useAuth } from './useAuth';
import { useCallback, useEffect, useMemo } from 'react';

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
  // We depend on the messages query being loaded first to get message IDs
  const messagesData = queryClient.getQueryData<any[]>(['conversation-messages', conversationId]);
  const messageIds = useMemo(
    () => messagesData?.map((m: any) => m.id).filter((id: string) => !id.startsWith('temp-')) || [],
    [messagesData],
  );
  const messageIdsKey = useMemo(() => messageIds.join(','), [messageIds]);

  const reactionsQuery = useQuery({
    queryKey: ['message-reactions', conversationId, messageIdsKey],
    queryFn: async () => {
      if (!conversationId || messageIds.length === 0) return [];

      // Batch into chunks of 200 to avoid PostgREST URL length limits
      const CHUNK_SIZE = 200;
      const allReactions: MessageReaction[] = [];

      for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
        const chunk = messageIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('conversation_message_reactions')
          .select('*')
          .in('message_id', chunk);

        if (error) throw error;
        if (data) allReactions.push(...(data as MessageReaction[]));
      }

      return allReactions;
    },
    enabled: !!conversationId && messageIds.length > 0,
    staleTime: 30 * 1000,
  });

  // Realtime subscription for reactions
  useEffect(() => {
    if (!conversationId) return;

    const channel = createRealtimeChannel(`reactions-${conversationId}`)
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
      const { data: existing, error: lookupError } = await supabase
        .from('conversation_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (existing) {
        // Remove reaction
        const { data, error } = await supabase
          .from('conversation_message_reactions')
          .delete()
          .eq('id', existing.id)
          .eq('user_id', user.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Reaktionen kunde inte tas bort');
      } else {
        // Add reaction
        const { error } = await supabase
          .from('conversation_message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });
        // Två samtidiga tryck kan mötas i det unika indexet; slutläget är redan rätt.
        if (error && error.code !== '23505') throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', conversationId] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', conversationId] });
    },
  });

  // Group reactions by message ID
  const groupedReactions = useMemo(() => {
    const byMessage = new Map<string, Map<string, { count: number; hasOwn: boolean }>>();
    for (const reaction of reactionsQuery.data || []) {
      let grouped = byMessage.get(reaction.message_id);
      if (!grouped) {
        grouped = new Map();
        byMessage.set(reaction.message_id, grouped);
      }
      const current = grouped.get(reaction.emoji) || { count: 0, hasOwn: false };
      grouped.set(reaction.emoji, {
        count: current.count + 1,
        hasOwn: current.hasOwn || reaction.user_id === user?.id,
      });
    }
    return new Map(
      Array.from(byMessage.entries()).map(([messageId, grouped]) => [
        messageId,
        Array.from(grouped.entries()).map(([emoji, data]) => ({ emoji, ...data })),
      ]),
    );
  }, [reactionsQuery.data, user?.id]);

  const getReactionsForMessage = useCallback(
    (messageId: string): GroupedReaction[] => groupedReactions.get(messageId) ?? [],
    [groupedReactions],
  );

  return {
    getReactionsForMessage,
    toggleReaction: toggleReaction.mutate,
    isToggling: toggleReaction.isPending,
  };
}

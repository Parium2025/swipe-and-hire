import { useState, useCallback } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface GroupedReaction {
  emoji: string;
  count: number;
  userIds: string[];
  hasReacted: boolean;
}

export function useMessageReactions(messageId: string, currentUserId: string) {
  const queryClient = useQueryClient();
  
  const { data: reactions = [], isLoading } = useQuery({
    queryKey: ['message-reactions', messageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId);
      
      if (error) throw error;
      return data as MessageReaction[];
    },
    staleTime: 30000, // 30 seconds
  });

  // Group reactions by emoji
  const groupedReactions: GroupedReaction[] = reactions.reduce((acc, reaction) => {
    const existing = acc.find(r => r.emoji === reaction.emoji);
    if (existing) {
      existing.count++;
      existing.userIds.push(reaction.user_id);
      if (reaction.user_id === currentUserId) {
        existing.hasReacted = true;
      }
    } else {
      acc.push({
        emoji: reaction.emoji,
        count: 1,
        userIds: [reaction.user_id],
        hasReacted: reaction.user_id === currentUserId,
      });
    }
    return acc;
  }, [] as GroupedReaction[]);

  const addReaction = useMutation({
    mutationFn: async (emoji: string) => {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        });
      
      if (error) throw error;
    },
    onMutate: async (emoji) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['message-reactions', messageId] });
      
      const previousReactions = queryClient.getQueryData(['message-reactions', messageId]);
      
      queryClient.setQueryData(['message-reactions', messageId], (old: MessageReaction[] = []) => [
        ...old,
        {
          id: `optimistic-${Date.now()}`,
          message_id: messageId,
          user_id: currentUserId,
          emoji,
          created_at: new Date().toISOString(),
        },
      ]);
      
      return { previousReactions };
    },
    onError: (err, emoji, context) => {
      queryClient.setQueryData(['message-reactions', messageId], context?.previousReactions);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', messageId] });
    },
  });

  const removeReaction = useMutation({
    mutationFn: async (emoji: string) => {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji);
      
      if (error) throw error;
    },
    onMutate: async (emoji) => {
      await queryClient.cancelQueries({ queryKey: ['message-reactions', messageId] });
      
      const previousReactions = queryClient.getQueryData(['message-reactions', messageId]);
      
      queryClient.setQueryData(['message-reactions', messageId], (old: MessageReaction[] = []) =>
        old.filter(r => !(r.emoji === emoji && r.user_id === currentUserId))
      );
      
      return { previousReactions };
    },
    onError: (err, emoji, context) => {
      queryClient.setQueryData(['message-reactions', messageId], context?.previousReactions);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', messageId] });
    },
  });

  const toggleReaction = useCallback((emoji: string) => {
    const hasReacted = reactions.some(r => r.emoji === emoji && r.user_id === currentUserId);
    if (hasReacted) {
      removeReaction.mutate(emoji);
    } else {
      addReaction.mutate(emoji);
    }
  }, [reactions, currentUserId, addReaction, removeReaction]);

  return {
    reactions,
    groupedReactions,
    isLoading,
    toggleReaction,
    addReaction: addReaction.mutate,
    removeReaction: removeReaction.mutate,
  };
}

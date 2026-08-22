import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface BlockedUser {
  id: string;
  blocked_id: string;
  conversation_id: string | null;
  reason: string | null;
  created_at: string;
}

/**
 * Blockering + permanent radering av en konversation.
 *
 * Skillnad mot "Radera chatt" (useDeleteConversation):
 *  - Radera chatt  → tar bort konversationen ur DIN inkorg. Motparten kan
 *                    fortfarande skriva och chatten dyker upp igen.
 *  - Blockera      → databasspärren (trigger `enforce_conversation_block`)
 *                    hindrar att meddelanden ens SPARAS mellan er. Inget når
 *                    fram — varken chatt, notis eller push — förrän du häver
 *                    blockeringen. Gäller åt båda hållen.
 */
export function useBlockedUsers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversation-blocks', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<BlockedUser[]> => {
      const { data, error } = await supabase
        .from('conversation_blocks')
        .select('id, blocked_id, conversation_id, reason, created_at, released_at')
        .is('released_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BlockedUser[];
    },
  });
}

export function useBlockConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const blockMutation = useMutation({
    mutationFn: async ({
      conversationId,
      userIds,
      reason,
    }: {
      conversationId: string;
      userIds: string[];
      reason?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const targets = Array.from(new Set(userIds.filter((id) => id && id !== user.id)));
      if (targets.length === 0) throw new Error('Ingen motpart att blockera');

      const { error: blockError } = await supabase.from('conversation_blocks').upsert(
        targets.map((blocked_id) => ({
          blocker_id: user.id,
          blocked_id,
          conversation_id: conversationId,
          reason: reason?.trim() || null,
        })),
        { onConflict: 'blocker_id,blocked_id' }
      );
      if (blockError) throw blockError;

      // Ta bort konversationen ur din inkorg i samma svep.
      const { error: leaveError } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
      if (leaveError) throw leaveError;

      return conversationId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['conversation-blocks'] });
      toast.success('Användaren är blockerad', {
        description: 'Inget når fram till dig från den här personen. Du kan häva blockeringen i inställningarna.',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to block conversation:', error);
      toast.error('Kunde inte blockera', { description: error.message });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('conversation_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);
      if (error) throw error;
      return blockedId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversation-blocks'] });
      toast.success('Blockeringen är hävd');
    },
    onError: (error: Error) => {
      console.error('Failed to unblock:', error);
      toast.error('Kunde inte häva blockeringen');
    },
  });

  return {
    blockConversation: blockMutation.mutate,
    isBlocking: blockMutation.isPending,
    unblockUser: unblockMutation.mutate,
    isUnblocking: unblockMutation.isPending,
  };
}

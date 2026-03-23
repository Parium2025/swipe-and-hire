import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

/**
 * Hook for deleting a conversation (leaves the conversation by removing membership).
 * Uses the new conversations system (conversation_messages + conversation_members).
 */
export function useDeleteConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user) throw new Error('Not authenticated');
      // Remove own membership from conversation (effectively "deleting" it for this user)
      const { error } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
      return conversationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Konversation raderad');
    },
    onError: (error: Error) => {
      console.error('Failed to delete conversation:', error);
      if (error.message === 'Du är offline') {
        toast.error('Du är offline', { description: 'Anslut till internet för att radera konversationen' });
      } else {
        toast.error('Kunde inte radera konversation');
      }
    },
  });

  return {
    deleteConversation: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}

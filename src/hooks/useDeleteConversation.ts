import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

/**
 * Hook for deleting a conversation (all messages between user and another party)
 */
export function useDeleteConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user) throw new Error('Not authenticated');
      if (!navigator.onLine) throw new Error('Du är offline');

      // Delete all messages in both directions between these two users
      const { error: sentError } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', user.id)
        .eq('recipient_id', otherUserId);

      if (sentError) throw sentError;

      const { error: receivedError } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', otherUserId)
        .eq('recipient_id', user.id);

      if (receivedError) throw receivedError;

      return otherUserId;
    },
    onSuccess: () => {
      // Invalidate all message queries
      queryClient.invalidateQueries({ queryKey: ['messages'] });
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

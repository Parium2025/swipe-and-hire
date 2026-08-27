import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import type { Conversation } from './useConversations';

/**
 * Tysta / avtysta en enskild konversation.
 *
 * Tystad = inga notiser (klocka/push) skapas för nya meddelanden i just den
 * konversationen. Meddelandena landar fortfarande i inkorgen och syns när
 * användaren själv går in i chatten — precis som Slack.
 *
 * Känslan är optimistisk: ikon, haptik och notis sker i samma frame som
 * trycket. Servern hinner ikapp i bakgrunden; vid fel rullas allt tillbaka.
 */
export function useMuteConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ conversationId, muted }: { conversationId: string; muted: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('conversation_members')
        .update({ muted_at: muted ? new Date().toISOString() : null })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
      return { conversationId, muted };
    },
    onMutate: async ({ conversationId, muted }) => {
      const key = ['conversations', user?.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Conversation[]>(key);

      queryClient.setQueryData<Conversation[]>(key, (prev) =>
        prev?.map((c) => (c.id === conversationId ? { ...c, is_muted: muted } : c))
      );

      toast.success(muted ? 'Konversationen är tystad' : 'Notiser påslagna igen', {
        description: muted
          ? 'Du får inga notiser härifrån. Meddelanden syns fortfarande i chatten.'
          : undefined,
        // Klick på notisen tar dig direkt till konversationen.
        route: `/messages?conversation=${conversationId}`,
      } as Parameters<typeof toast.success>[1]);

      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      console.error('Failed to toggle conversation mute:', error);
      if (context?.previous) {
        queryClient.setQueryData(['conversations', user?.id], context.previous);
      }
      toast.error('Kunde inte ändra notisinställningen');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    },
  });

  return {
    setMuted: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}

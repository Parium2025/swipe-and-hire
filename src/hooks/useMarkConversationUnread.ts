import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getIsOnline } from '@/lib/connectivityManager';
import type { Conversation } from '@/hooks/useConversations';

/**
 * Markera en konversation som oläst igen.
 * Sätter last_read_at strax före senaste meddelandet så att serverns
 * unread-beräkning ger minst 1 — badgar i sidebar/topnav uppdateras direkt
 * via optimistisk cache-uppdatering.
 */
export function useMarkConversationUnread() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isMarking, setIsMarking] = useState(false);

  const markAsUnread = useCallback(
    async (conversationId: string) => {
      if (!user) return;

      const conversations = queryClient.getQueryData<Conversation[]>(['conversations', user.id]);
      const conversation = conversations?.find((c) => c.id === conversationId);
      const lastAt = conversation?.last_message?.created_at || conversation?.last_message_at;
      if (!lastAt) return; // Inget meddelande att markera som oläst

      // 1 sekund före senaste meddelandet -> exakt ett oläst
      const newLastRead = new Date(new Date(lastAt).getTime() - 1000).toISOString();

      // Optimistisk uppdatering
      queryClient.setQueryData<Conversation[]>(['conversations', user.id], (prev) => {
        if (!prev) return prev;
        const next = prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: Math.max(1, c.unread_count || 0) } : c
        );
        try {
          const total = next.reduce((sum, c) => sum + (c.unread_count || 0), 0);
          sessionStorage.setItem('parium_job_seeker_unread_messages', String(total));
          sessionStorage.setItem('parium_unread_messages', String(total));
        } catch {
          /* privat läge */
        }
        return next;
      });

      if (!getIsOnline()) return;

      setIsMarking(true);
      try {
        await supabase
          .from('conversation_members')
          .update({ last_read_at: newLastRead, manually_unread: true } as never)
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);
      } catch (err) {
        console.warn('markAsUnread failed:', err);
      } finally {
        setIsMarking(false);
      }
    },
    [user, queryClient]
  );

  return { markAsUnread, isMarking };
}

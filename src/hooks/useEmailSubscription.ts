import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EmailSubscriptionState {
  recipient: string;
  subscribed: boolean;
}

/**
 * Läser och styr om kontots e-postadress är avregistrerad från app-mejl.
 * Avregistreringen ligger hos e-posttjänsten (per adress + avsändardomän),
 * inte i notisinställningarna — därför måste den kunna styras separat.
 */
export function useEmailSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['email-subscription', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<EmailSubscriptionState | null> => {
      const { data, error } = await supabase.functions.invoke('email-subscription', {
        body: { action: 'status' },
      });
      if (error) throw error;
      if (!data || typeof data.subscribed !== 'boolean') return null;
      return data as EmailSubscriptionState;
    },
    retry: 1,
  });

  const setSubscribed = useCallback(
    async (subscribed: boolean) => {
      const { data, error } = await supabase.functions.invoke('email-subscription', {
        body: { action: subscribed ? 'resubscribe' : 'unsubscribe' },
      });
      if (error) throw error;
      // Optimistiskt: visa direkt det läge användaren valde även om e-posttjänsten
      // är fördröjt konsekvent, så att mejlreglagen slås på direkt vid aktivering.
      queryClient.setQueryData(['email-subscription', userId], {
        recipient: data?.recipient ?? '',
        subscribed,
      } satisfies EmailSubscriptionState);
      // Synka om mot e-posttjänsten efter en stund för att bekräfta läget.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['email-subscription', userId] });
      }, 15_000);
      return data as EmailSubscriptionState;
    },
    [queryClient, userId],
  );

  return {
    // Okänt läge behandlas som prenumererat så inget felaktigt varningsblock visas.
    subscribed: query.data ? query.data.subscribed : true,
    isKnown: !!query.data,
    isLoading: query.isLoading,
    setSubscribed,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['email-subscription', userId] }),
  };
}

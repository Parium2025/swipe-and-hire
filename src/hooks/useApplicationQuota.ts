import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';

export interface ApplicationQuota {
  allowed: boolean;
  used: number;
  limit: number;
  is_premium: boolean;
  reset_at: string | null;
}

const DEFAULT_QUOTA: ApplicationQuota = {
  allowed: true,
  used: 0,
  limit: 3,
  is_premium: false,
  reset_at: null,
};

export function useApplicationQuota() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['application-quota', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<ApplicationQuota> => {
      if (!userId) return DEFAULT_QUOTA;
      const { data, error } = await supabase.rpc('get_application_quota' as any, {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data as ApplicationQuota) ?? DEFAULT_QUOTA;
    },
  });

  const refresh = useCallback(() => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ['application-quota', userId] });
  }, [queryClient, userId]);

  return {
    quota: query.data ?? DEFAULT_QUOTA,
    isLoading: query.isLoading,
    refresh,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type NotificationType = 
  | 'new_application' 
  | 'new_message' 
  | 'interview_scheduled' 
  | 'saved_search_match'
  | 'job_closed';

interface NotificationPreference {
  notification_type: NotificationType;
  is_enabled: boolean;
}

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('notification_type, is_enabled')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as NotificationPreference[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const isEnabled = (type: NotificationType): boolean => {
    const pref = preferences.find(p => p.notification_type === type);
    return pref?.is_enabled ?? true; // default enabled
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ type, enabled }: { type: NotificationType; enabled: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          { user_id: user.id, notification_type: type, is_enabled: enabled, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,notification_type' }
        );
      if (error) throw error;
    },
    onMutate: async ({ type, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences', user?.id] });
      const previous = queryClient.getQueryData<NotificationPreference[]>(['notification-preferences', user?.id]);
      
      queryClient.setQueryData<NotificationPreference[]>(
        ['notification-preferences', user?.id],
        (old = []) => {
          const exists = old.find(p => p.notification_type === type);
          if (exists) {
            return old.map(p => p.notification_type === type ? { ...p, is_enabled: enabled } : p);
          }
          return [...old, { notification_type: type, is_enabled: enabled }];
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notification-preferences', user?.id], context.previous);
      }
    },
  });

  return {
    isEnabled,
    toggle: (type: NotificationType, enabled: boolean) => toggleMutation.mutate({ type, enabled }),
    isLoading,
  };
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type NotificationType = 
  | 'new_application' 
  | 'new_message' 
  | 'interview_scheduled' 
  | 'saved_search_match'
  | 'job_closed'
  | 'saved_job_expiring'
  | 'application_status';

export type NotificationChannel = 'push' | 'email';

interface NotificationPreference {
  notification_type: NotificationType;
  is_enabled: boolean;
  email_enabled: boolean;
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
        .select('notification_type, is_enabled, email_enabled')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as NotificationPreference[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const isEnabled = (type: NotificationType, channel: NotificationChannel = 'push'): boolean => {
    const pref = preferences.find(p => p.notification_type === type);
    if (!pref) return true; // default enabled
    return channel === 'email' ? pref.email_enabled : pref.is_enabled;
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ type, enabled, channel }: { type: NotificationType; enabled: boolean; channel: NotificationChannel }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const updateField = channel === 'email' ? 'email_enabled' : 'is_enabled';
      
      // First check if row exists
      const { data: existing } = await supabase
        .from('notification_preferences')
        .select('id')
        .eq('user_id', user.id)
        .eq('notification_type', type)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('notification_preferences')
          .update({ [updateField]: enabled, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('notification_type', type);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            notification_type: type,
            is_enabled: channel === 'push' ? enabled : true,
            email_enabled: channel === 'email' ? enabled : true,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onMutate: async ({ type, enabled, channel }) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences', user?.id] });
      const previous = queryClient.getQueryData<NotificationPreference[]>(['notification-preferences', user?.id]);
      
      queryClient.setQueryData<NotificationPreference[]>(
        ['notification-preferences', user?.id],
        (old = []) => {
          const exists = old.find(p => p.notification_type === type);
          if (exists) {
            return old.map(p => p.notification_type === type 
              ? { ...p, [channel === 'email' ? 'email_enabled' : 'is_enabled']: enabled } 
              : p
            );
          }
          return [...old, { 
            notification_type: type, 
            is_enabled: channel === 'push' ? enabled : true,
            email_enabled: channel === 'email' ? enabled : true,
          }];
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
    toggle: (type: NotificationType, enabled: boolean, channel: NotificationChannel = 'push') => 
      toggleMutation.mutate({ type, enabled, channel }),
    isLoading,
  };
};

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Prefetches employer data (templates, company profile, reviews)
 * so pages like /reviews and "Skapa ny annons" load instantly.
 */
export function useEmployerPrefetch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Prefetch job templates for instant "Skapa ny annons" dialog load
  useEffect(() => {
    if (!user) return;

    const prefetchTemplates = async () => {
      try {
        const { data } = await supabase
          .from('job_templates')
          .select('*')
          .eq('employer_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });

        if (data) {
          queryClient.setQueryData(['job-templates', user.id], data);
        }
      } catch (error) {
        console.error('Failed to prefetch templates:', error);
      }
    };

    prefetchTemplates();
  }, [user, queryClient]);

  // Prefetch company profile for instant /reviews load
  useEffect(() => {
    if (!user) return;

    queryClient.prefetchQuery({
      queryKey: ['company-profile', user.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
    });
  }, [user, queryClient]);

  // Prefetch company reviews for instant /reviews load
  useEffect(() => {
    if (!user) return;

    queryClient.prefetchQuery({
      queryKey: ['company-reviews', user.id],
      queryFn: async () => {
        const { data: reviews, error } = await supabase
          .from('company_reviews')
          .select('*')
          .eq('company_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!reviews || reviews.length === 0) return [];

        const userIds = reviews
          .filter(r => !r.is_anonymous)
          .map(r => r.user_id);

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds);

          if (profiles) {
            const profileMap = new Map(profiles.map(p => [p.user_id, p]));
            return reviews.map(r => ({
              ...r,
              profiles: profileMap.get(r.user_id) || undefined,
            }));
          }
        }

        return reviews;
      },
    });
  }, [user, queryClient]);
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeMeetingLink } from '@/lib/meetingLink';

/**
 * Företagets standard-möteslänk.
 *
 * Används så att en inbjuden kollega automatiskt får organisationens
 * befintliga möteslänk föreslagen i välkomsttunneln, i företagsprofilen
 * och när en intervju bokas – utan att behöva fråga någon.
 *
 * Egen sparad länk vinner alltid (funktionen sorterar den först).
 */
export const useOrgDefaultVideoLink = () => {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['org-default-video-link', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_org_default_interview_video_link');
      if (error) {
        console.warn('Kunde inte hämta organisationens standardlänk:', error.message);
        return '';
      }
      return normalizeMeetingLink((data as string) || '');
    },
  });

  return data || '';
};

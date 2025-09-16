import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MaskedProfile {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
  interests: any;
  cv_url?: string;
  employment_status?: string;
  working_hours?: string;
  availability?: string;
  home_location?: string; // City level only
  first_name?: string;
  bio?: string; // Truncated for privacy
  profile_image_url?: string;
  video_url?: string;
}

export const useSecureProfileAccess = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getJobSeekerProfile = async (jobSeekerId: string): Promise<MaskedProfile | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_consented_profile_for_employer', {
        job_seeker_uuid: jobSeekerId
      });

      if (error) {
        console.error('Failed to fetch job seeker profile:', error);
        
        // Handle specific security errors
        if (error.message.includes('Access denied')) {
          toast({
            title: "Åtkomst nekad",
            description: "Du har inte behörighet att visa denna profil.",
            variant: "destructive"
          });
        } else if (error.message.includes('no valid permission')) {
          toast({
            title: "Ingen behörighet",
            description: "Du behöver en giltig ansökan för att visa denna profil.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Fel uppstod",
            description: "Kunde inte hämta profilinformation.",
            variant: "destructive"
          });
        }
        return null;
      }

      // Return the first (and should be only) result
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error accessing job seeker profile:', error);
      toast({
        title: "Fel uppstod",
        description: "Kunde inte hämta profilinformation.",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const revokeProfileAccess = async (employerId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('revoke_profile_access', {
        target_employer_id: employerId
      });

      if (error) {
        console.error('Failed to revoke profile access:', error);
        toast({
          title: "Fel uppstod",
          description: "Kunde inte återkalla åtkomst.",
          variant: "destructive"
        });
        return false;
      }

      if (data) {
        toast({
          title: "Åtkomst återkallad",
          description: "Arbetsgivaren har inte längre åtkomst till din profil.",
          variant: "default"
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error revoking profile access:', error);
      toast({
        title: "Fel uppstod",
        description: "Kunde inte återkalla åtkomst.",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    getJobSeekerProfile,
    revokeProfileAccess,
    loading
  };
};
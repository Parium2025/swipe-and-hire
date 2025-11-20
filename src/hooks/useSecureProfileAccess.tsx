import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

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
  last_name?: string; // Now included with consent
  age?: number; // Age instead of birth_date
  profile_image_url?: string;
  video_url?: string;
  phone?: string; // Included with consent
  postal_code?: string; // Included with consent
}

export const useSecureProfileAccess = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getJobSeekerProfile = async (jobSeekerId: string): Promise<MaskedProfile | null> => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      
      const { data, error } = await supabase.rpc('get_consented_profile_for_employer', {
        p_employer_id: user.user.id,
        p_profile_id: jobSeekerId
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

      // Return the first (and should be only) result, mapping to MaskedProfile
      if (data && data.length > 0) {
        const profile = data[0];
        return {
          ...profile,
          role: 'job_seeker',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          onboarding_completed: true,
          interests: []
        } as MaskedProfile;
      }
      return null;
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
    // Note: This functionality requires a revoke_profile_access RPC function
    // which is not yet implemented in the database
    console.warn('revokeProfileAccess not yet implemented');
    toast({
      title: "Funktion inte tillgänglig",
      description: "Denna funktion är inte tillgänglig än.",
      variant: "default"
    });
    return false;
  };

  return {
    getJobSeekerProfile,
    revokeProfileAccess,
    loading
  };
};
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

export type UserRole = Database['public']['Enums']['user_role'];

interface UserRoleData {
  id: string;
  user_id: string;
  role: UserRole;
  organization_id?: string;
  is_active: boolean;
}

interface Organization {
  id: string;
  name: string;
  org_number?: string;
  website?: string;
  description?: string;
  logo_url?: string;
  subscription_plan: string;
  max_recruiters: number;
}

interface Profile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company_name?: string;
  org_number?: string;
  industry?: string;
  address?: string;
  website?: string;
  company_description?: string;
  employee_count?: string;
  bio?: string;
  location?: string;
  birth_date?: string;
  profile_image_url?: string;
  video_url?: string;
  cover_image_url?: string;
  cv_url?: string;
  cv_filename?: string;
  employment_status?: string;
  working_hours?: string;
  availability?: string;
  interests?: string | string[];
  home_location?: string;
  organization_id?: string;
  onboarding_completed?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRoleData | null;
  organization: Organization | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: { 
    role: UserRole; 
    first_name: string; 
    last_name: string; 
    phone?: string; 
    organization_id?: string;
    company_name?: string;
    org_number?: string;
    industry?: string;
    address?: string;
    website?: string;
    company_description?: string;
    employee_count?: string;
  }) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signInWithPhone: (phone: string) => Promise<{ error?: any }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: any }>;
  refreshProfile: () => Promise<void>;
  resendConfirmation: (email: string, userRole?: string, firstName?: string) => Promise<{ error?: any }>;
  resetPassword: (email: string) => Promise<{ error?: any }>;
  updatePassword: (newPassword: string) => Promise<{ error?: any }>;
  hasRole: (role: UserRole) => boolean;
  isSuperAdmin: () => boolean;
  isCompanyUser: () => boolean;
  getRedirectPath: () => string;
  switchRole: (newRole: UserRole) => Promise<{ error?: any }>;
  confirmEmail: (token: string) => Promise<{ success: boolean; message: string; email: string }>;
  cleanupExpiredConfirmations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const CACHED_PROFILE_KEY = 'parium_cached_profile';
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(CACHED_PROFILE_KEY) : null;
      return raw ? JSON.parse(raw) as Profile : null;
    } catch {
      return null;
    }
  });
  const [userRole, setUserRole] = useState<UserRoleData | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const isManualSignOutRef = useRef(false);
  const isInitializingRef = useRef(true);
  const isSigningInRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let sessionInitialized = false;

    // Set up auth state listener FIRST to avoid missing events and deadlocks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        console.log('[AuthStateChange]', event, { hasSession: !!session });
        
        // Token refresh-händelser loggas för felsökning
        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Session token uppdaterades automatiskt');
        }
        
        // Update session and user state for all events
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Skip fetching user data again for INITIAL_SESSION to avoid duplication
          // The initial getSession() call below handles this
          if (event !== 'INITIAL_SESSION') {
            // Defer any Supabase calls to avoid blocking the callback
            setTimeout(() => {
              if (!mounted) return;
              fetchUserData(session.user!.id).then(() => {
                if (mounted) setLoading(false);
              });
            }, 0);
          }
        } else {
          setProfile(null);
          setUserRole(null);
          setOrganization(null);
          try { if (typeof window !== 'undefined') localStorage.removeItem(CACHED_PROFILE_KEY); } catch {}
          if (event !== 'INITIAL_SESSION') {
            setLoading(false);
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || sessionInitialized) return;
      sessionInitialized = true;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserData(session.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // Don't auto-logout on profile errors, just set profile to null
        setProfile(null);
        return;
      } else if (!profileData) {
        // Don't auto-logout, just set profile to null and let app handle it
        setProfile(null);
        return;
      } else {
        // Convert JSONB interests to string array
        const processedProfile = {
          ...profileData,
          interests: profileData.interests 
            ? (Array.isArray(profileData.interests) 
                ? profileData.interests 
                : typeof profileData.interests === 'string' 
                  ? JSON.parse(profileData.interests) 
                  : [])
            : []
        };
        setProfile(processedProfile);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify({
              id: processedProfile.id,
              user_id: processedProfile.user_id,
              first_name: processedProfile.first_name,
              last_name: processedProfile.last_name,
              company_name: processedProfile.company_name,
              industry: processedProfile.industry,
              profile_image_url: processedProfile.profile_image_url,
              cover_image_url: processedProfile.cover_image_url,
              video_url: processedProfile.video_url,
              company_logo_url: (processedProfile as any).company_logo_url
            }));
          }
        } catch (e) {
          console.warn('Failed to cache profile:', e);
        }

        // Cache organization_id early for faster queries
        if (profileData.organization_id) {
          try {
            localStorage.setItem('org_id', profileData.organization_id);
          } catch (e) {
            console.warn('Failed to cache org_id:', e);
          }
        }
      }

      // Parallelize role and organization fetches
      const rolePromise = supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      const orgPromise = profileData?.organization_id
        ? supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      // Execute in parallel
      const [roleResult, orgResult] = await Promise.all([
        rolePromise,
        orgPromise
      ]);

      const { data: roleData, error: roleError } = roleResult;
      
      if (roleError) {
        console.error('Error fetching user role:', roleError);
      } else {
        setUserRole(roleData);

        // If profile didn't have org_id but role does, fetch organization
        if (!profileData?.organization_id && roleData?.organization_id) {
          try {
            localStorage.setItem('org_id', roleData.organization_id);
          } catch (e) {
            console.warn('Failed to cache org_id from role:', e);
          }

          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', roleData.organization_id)
            .maybeSingle();

          if (orgError) {
            console.error('Error fetching organization:', orgError);
          } else if (orgData) {
            setOrganization(orgData);
          }
        } else if (orgResult.data) {
          if (orgResult.error) {
            console.error('Error fetching organization:', orgResult.error);
          } else {
            setOrganization(orgResult.data);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const signUp = async (email: string, password: string, userData: { 
    role: UserRole; 
    first_name: string; 
    last_name: string; 
    phone?: string; 
    organization_id?: string;
    company_name?: string;
    org_number?: string;
    industry?: string;
    address?: string;
    website?: string;
    company_description?: string;
    employee_count?: string;
  }) => {
    try {
      // Använd din befintliga custom-signup Edge Function som använder Resend
      const { data, error } = await supabase.functions.invoke('custom-signup', {
        body: {
          email,
          password,
          data: userData
        }
      });

      if (error) throw error;

      if (data?.error || data?.success === false) {
        // Hantera befintlig användare med specifik flagga
        if (data.isExistingUser) {
          toast({
            title: data.error || "Hoppsan! Den här adressen är redan registrerad",
            description: data.message || `Det ser ut som att du redan har ett konto med ${email}. Logga gärna in – eller återställ lösenordet om du har glömt det.`,
            variant: "default",
            duration: 8000
          });
          
          return { 
            error: { 
              message: data.error || "Email already exists", 
              userFriendlyMessage: data.message || "E-postadressen finns redan registrerad",
              isExistingUser: true,
              error: data.error,
              originalMessage: data.message
            }
          };
        }
        
        // Hantera andra fel med redan registrerad text (fallback)
        if (data.error && (data.error.includes("already registered") || data.error.includes("already been registered"))) {
          toast({
            title: "Hoppsan! Den här adressen är redan registrerad",
            description: `Det ser ut som att du redan har ett konto med ${email}. Logga gärna in – eller återställ lösenordet om du har glömt det.`,
            variant: "default",
            duration: 8000
          });
          
          return { 
            error: { 
              message: "Email already exists", 
              userFriendlyMessage: "E-postadressen finns redan registrerad",
              isExistingUser: true 
            }
          };
        }
        
        throw new Error(data.error);
      }

      // Registrering lyckades
      toast({
        title: "Registrering lyckad!",
        description: "Kontrollera din e-post för att aktivera ditt konto",
        duration: 10000
      });

      return { user: data?.user };
    } catch (error: any) {
      console.error("Signup error:", error);
      
      // Hantera Edge Function responser som kommer som fel
      if (error?.context?.body) {
        try {
          const errorData = typeof error.context.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context.body;
          
          if (errorData?.isExistingUser) {
            toast({
              title: errorData.error || "Hoppsan! Den här adressen är redan registrerad",
              description: errorData.message || `Det ser ut som att du redan har ett konto med ${email}. Logga gärna in – eller återställ lösenordet om du har glömt det.`,
              variant: "default",
              duration: 8000
            });
            
            return { 
              error: { 
                message: errorData.error || "Email already exists", 
                userFriendlyMessage: errorData.message || "E-postadressen finns redan registrerad",
                isExistingUser: true,
                error: errorData.error,
                originalMessage: errorData.message
              }
            };
          }
        } catch (parseError) {
          console.error('Error parsing edge function response:', parseError);
        }
      }
      
      let errorTitle = "Registreringsfel";
      let errorDescription = error.message || "Ett oväntat fel inträffade. Försök igen.";

      // Handle specific error cases
      if (errorDescription.includes("already been registered") || errorDescription.includes("already registered") || errorDescription.includes("already")) {
        errorTitle = "Hoppsan! Den här adressen är redan registrerad";
        errorDescription = `Det ser ut som att du redan har ett konto med ${email}. Logga gärna in – eller återställ lösenordet om du har glömt det.`;
        
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "default",
          duration: 8000
        });
        
        return { 
          error: { 
            message: "Email already exists", 
            userFriendlyMessage: errorDescription,
            isExistingUser: true 
          }
        };
      } else if (errorDescription.includes("Password should be")) {
        errorTitle = "Lösenordet är för svagt";
        errorDescription = "Lösenordet måste vara minst 6 tecken långt.";
      } else if (errorDescription.includes("Invalid email")) {
        errorTitle = "Ogiltig e-postadress";
        errorDescription = "Ange en giltig e-postadress.";
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive"
      });
      
      return { error: { message: errorDescription, userFriendlyMessage: errorDescription, isExistingUser: errorDescription.includes("redan") } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      isSigningInRef.current = true;
      console.log('🔍 SignIn started for:', email);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          toast({
            title: "Inloggning misslyckades",
            description: "Fel e-postadress eller lösenord. Kontrollera dina uppgifter och försök igen.",
            variant: "destructive"
          });
        } else if (error.message === 'Email not confirmed') {
          toast({
            title: "Kontot är inte bekräftat",
            description: "Du behöver bekräfta din e-post först. Kolla din inkorg eller begär en ny bekräftelselänk.",
            variant: "default",
            duration: 8000
          });
          return { error: { ...error, code: 'email_not_confirmed', message: 'Email not confirmed' } };
        } else {
          toast({ title: "Inloggningsfel", description: error.message, variant: "destructive" });
        }
        return { error };
      }

      // No toast on success - immediate navigation for best UX
      return {};
    } catch (error: any) {
      toast({ title: "Inloggningsfel", description: "Ett oväntat fel inträffade. Försök igen.", variant: "destructive" });
      return { error };
    } finally {
      isSigningInRef.current = false;
    }
  };

  const signInWithPhone = async (phone: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          channel: 'sms'
        }
      });

      if (error) {
        toast({
          title: "SMS-fel",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "SMS skickad",
        description: "Kontrollera din telefon för verifieringskod"
      });

      return { data };
    } catch (error) {
      toast({
        title: "SMS-fel",
        description: "Kunde inte skicka SMS",
        variant: "destructive"
      });
      return { error };
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms'
      });

      if (error) {
        toast({
          title: "Verifieringsfel",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Inloggad!",
        description: "Du är nu inloggad via telefon"
      });

      return { data };
    } catch (error) {
      toast({
        title: "Verifieringsfel",
        description: "Fel kod eller utgången kod",
        variant: "destructive"
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Markera att detta är en manuell utloggning
      isManualSignOutRef.current = true;

      // 1) Rensa applikationsstate först
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole(null);
      setOrganization(null);
      
      // 2) Rensa bara sessionStorage, inte localStorage
      // Låt Supabase hantera sina egna tokens i localStorage
      try { 
        sessionStorage.clear(); 
      } catch (e) {
        console.warn('Could not clear sessionStorage:', e);
      }

      // 3) Signera ut från Supabase (global scope)
      // Detta rensar Supabase's tokens på rätt sätt
      await supabase.auth.signOut({ scope: 'global' });

      // 4) Notify och redirect
      toast({ title: 'Utloggad', description: 'Du har loggats ut', duration: 2000 });
      window.location.replace('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      // Säkerställ att vi ändå rensar och redirectar även vid API-fel
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole(null);
      setOrganization(null);
      window.location.replace('/auth');
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        console.error('Supabase profile update error:', error);
        toast({
          title: "Fel vid uppdatering", 
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      // Refresh profile
      await fetchUserData(user.id);
      
      toast({
        title: "Profil uppdaterad",
        description: "Dina ändringar har sparats",
        duration: 2000
      });

      return {};
    } catch (error) {
      console.error('Profile update exception:', error);
      return { error };
    }
  };

  const resendConfirmation = async (email: string, userRole?: string) => {
    try {
      // Use our token-generating edge function to ensure the link works for both roles
      const { data, error } = await supabase.functions.invoke('resend-confirmation', {
        body: { email }
      });

      if (error) throw error;

      toast({
        title: "Ny bekräftelselänk skickad!",
        description: "Kolla din e-post för den nya bekräftelselänken",
        duration: 8000
      });

      return { success: true };
    } catch (error: any) {
      console.error('Resend confirmation error:', error);
      
      let errorMessage = error.message || "Ett fel inträffade. Försök igen.";
      
      if (errorMessage.includes("Email rate limit")) {
        errorMessage = "För många e-postförfrågningar. Vänta en stund innan du försöker igen.";
      } else if (errorMessage.includes("User not found")) {
        errorMessage = "Ingen användare hittades med denna e-postadress.";
      }
      
      toast({
        title: "Kunde inte skicka bekräftelselänk",
        description: errorMessage,
        variant: "destructive"
      });

      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      // Tillbaka till vår edge function - den kommer att fungera nu
      const { data, error } = await supabase.functions.invoke('send-reset-password', {
        body: { email }
      });

      if (error) {
        console.error('Reset password error:', error);
        toast({
          title: "Fel vid lösenordsåterställning",
          description: error.message || "Kunde inte skicka återställningsmail. Försök igen.",
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Återställningsmail skickat!",
        description: "Kontrollera din e-post för instruktioner om lösenordsåterställning.",
        duration: 8000
      });

      return { success: true };
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast({
        title: "Fel vid lösenordsåterställning",
        description: "Kunde inte skicka återställningsmail. Försök igen.",
        variant: "destructive"
      });
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast({
          title: "Fel vid uppdatering av lösenord",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Lösenord uppdaterat!",
        description: "Ditt lösenord har uppdaterats framgångsrikt."
      });

      return {};
    } catch (error) {
      return { error };
    }
  };

  // Helper functions for role checking
  const hasRole = (role: UserRole): boolean => {
    return userRole?.role === role;
  };

  const isSuperAdmin = (): boolean => {
    return hasRole('super_admin');
  };

  const isCompanyUser = (): boolean => {
    return hasRole('company_admin') || hasRole('recruiter') || hasRole('employer');
  };

  const getRedirectPath = (): string => {
    if (!userRole) return '/';
    
    switch (userRole.role) {
      case 'super_admin':
        return '/admin';
      case 'company_admin':
      case 'recruiter':
      case 'employer':
        return '/employer';
      case 'job_seeker':
        return '/jobs';
      default:
        return '/';
    }
  };

  const switchRole = async (newRole: UserRole): Promise<{ error?: any }> => {
    if (!user) return { error: 'No user logged in' };

    try {
      // Deactivate current role
      if (userRole) {
        await supabase
          .from('user_roles')
          .update({ is_active: false })
          .eq('id', userRole.id);
      }

      // Activate or create new role
      const { data: existingRole, error: fetchError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', newRole)
        .maybeSingle();

      if (fetchError) return { error: fetchError };

      if (existingRole) {
        // Activate existing role
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ is_active: true })
          .eq('id', existingRole.id);

        if (updateError) return { error: updateError };
      } else {
        // Create new role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert([{
            user_id: user.id,
            role: newRole,
            is_active: true
          }]);

        if (insertError) return { error: insertError };
      }

      // Refresh user data
      await fetchUserData(user.id);
      
      toast({
        title: "Roll bytt",
        description: `Du har bytt till ${newRole === 'job_seeker' ? 'jobbsökande' : 'arbetsgivare'}.`
      });

      return {};
    } catch (error) {
      toast({
        title: "Fel vid rollbyte",
        description: "Kunde inte byta roll. Försök igen.",
        variant: "destructive"
      });
      return { error };
    }
  };

  // Bekräfta e-post funktion
  const confirmEmail = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('confirm-email', {
        body: { token }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return { success: true, message: data.message, email: data.email };
    } catch (error: any) {
      console.error('Email confirmation error:', error);
      throw error;
    }
  };

  // Cleanup-funktion för Edge Function
  const cleanupExpiredConfirmations = async () => {
    try {
      await supabase.functions.invoke('cleanup-expired-confirmations');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };


  const value = {
    user,
    session,
    profile,
    userRole,
    organization,
    loading,
    signUp,
    signIn,
    signInWithPhone,
    verifyOtp,
    signOut,
    updateProfile,
    refreshProfile,
    resendConfirmation,
    resetPassword,
    updatePassword,
    hasRole,
    isSuperAdmin,
    isCompanyUser,
    getRedirectPath,
    switchRole,
    confirmEmail,
    cleanupExpiredConfirmations
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
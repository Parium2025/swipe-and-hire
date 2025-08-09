import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export type UserRole = 'super_admin' | 'company_admin' | 'recruiter' | 'job_seeker' | 'employer';

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
  bio?: string;
  location?: string;
  profile_image_url?: string;
  video_url?: string;
  cv_url?: string;
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
  signUp: (email: string, password: string, userData: { role: UserRole; first_name: string; last_name: string; phone?: string; organization_id?: string }) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signInWithPhone: (phone: string) => Promise<{ error?: any }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: any }>;
  resendConfirmation: (email: string) => Promise<{ error?: any }>;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRoleData | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    let sessionInitialized = false;

    // Handle initial session check first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || sessionInitialized) return;
      
      sessionInitialized = true;
      console.log('Initial session check:', session?.user?.id);
      
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

    // Set up auth state listener after initial check
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.id);
        
        // Skip ALL INITIAL_SESSION events to prevent duplicates
        if (event === 'INITIAL_SESSION') {
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            if (mounted) {
              fetchUserData(session.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
          setOrganization(null);
        }
      }
    );

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
      } else if (!profileData) {
        console.log('Profile not found for user, logging out...');
        // Om profilen inte finns, logga ut användaren
        await signOut();
        return;
      } else {
        setProfile(profileData);
      }

      // Fetch user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
      } else {
        setUserRole(roleData);

        // Fetch organization if user has one
        if (roleData?.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', roleData.organization_id)
            .maybeSingle();

          if (orgError) {
            console.error('Error fetching organization:', orgError);
          } else {
            setOrganization(orgData);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const signUp = async (email: string, password: string, userData: { role: UserRole; first_name: string; last_name: string; phone?: string; organization_id?: string }) => {
    try {
      console.log('Starting custom signup with Resend for:', email);
      
      // Använd din befintliga custom-signup Edge Function som använder Resend
      const { data, error } = await supabase.functions.invoke('custom-signup', {
        body: {
          email,
          password,
          data: userData
        }
      });

      if (error) {
        console.error('Custom signup error:', error);
        throw error;
      }

      console.log('Custom signup result:', data);

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
        description: "Kontrollera din e-post för att aktivera ditt konto.",
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
      // Först kontrollera om e-postadressen finns i systemet
      const { data: userData, error: userCheckError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', 'NOT_EXISTS') // Dummy query först
        .limit(1);

      // Kontrollera om användaren finns via en auth query
      try {
        const response = await fetch(`https://rvtsfnaqlnggfkoqygbm.supabase.co/rest/v1/profiles?select=user_id&limit=1`, {
          method: 'HEAD', // Bara för att testa anslutningen
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dHNmbmFxbG5nZ2Zrb3F5Z2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MjU3OTIsImV4cCI6MjA2OTMwMTc5Mn0.it7eb24bwKvZt7p6Co5tZ7Dpu7AA-InLdJu_boq7HmA'
          }
        });
      } catch (fetchError) {
        // Ignorera fetch fel, fortsätt med vanlig inloggning
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Specialhantering för "Invalid login credentials"
        if (error.message === 'Invalid login credentials') {
          // Kolla om användaren faktiskt finns via vår edge function
          try {
            const { data: userCheck, error: checkError } = await supabase.functions.invoke('check-user-exists', {
              body: { email }
            });

            if (checkError) {
              console.error('Error checking user:', checkError);
              throw checkError;
            }

            if (userCheck.userExists && userCheck.isConfirmed) {
              // Användaren finns och är bekräftad - detta är fel lösenord
              toast({
                title: "Fel lösenord",
                description: "Lösenordet stämmer inte. Har du glömt det? Tryck på 'Återställ lösenord' nedan.",
                variant: "destructive",
                duration: 8000
              });
              
              return { 
                error: { 
                  ...error,
                  message: 'Invalid login credentials',
                  showResetPassword: true
                }
              };
            } else if (!userCheck.userExists) {
              // Användaren finns inte alls - visa registrera-meddelande
              toast({
                title: "Vi hittar inget konto med den här e-postadressen",
                description: "Vill du komma igång? Tryck på Registrera för att skapa ett konto direkt.",
                variant: "default",
                duration: 8000
              });
              
              return { 
                error: { 
                  ...error,
                  message: 'User not found',
                  showRegister: true
                }
              };
            } else {
              // Användaren finns men är inte bekräftad
              toast({
                title: "Kontot är inte bekräftat",
                description: "Du behöver bekräfta din e-post först. Kolla din inkorg eller begär en ny bekräftelselänk.",
                variant: "default",
                duration: 8000
              });
              
              return { 
                error: { 
                  ...error,
                  code: 'email_not_confirmed',
                  message: 'Email not confirmed'
                }
              };
            }
          } catch (checkError) {
            // Fallback om edge function misslyckas
            toast({
              title: "Inloggning misslyckades",
              description: "Kontrollera din e-post och lösenord. Har du glömt lösenordet? Tryck på 'Återställ lösenord' nedan.",
              variant: "destructive",
              duration: 8000
            });
          }
          
          return { 
            error: { 
              ...error,
              userFriendlyMessage: "Inloggning misslyckades"
            }
          };
        }
        
        toast({
          title: "Inloggningsfel",
          description: error.code === 'email_not_confirmed' 
            ? "Du behöver bekräfta din e-post först."
            : error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Välkommen tillbaka!",
        description: "Du är nu inloggad."
      });

      // Navigate to home after successful login
      setTimeout(() => {
        window.location.href = '/';
      }, 500);

      return {};
    } catch (error) {
      return { error };
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setOrganization(null);
    toast({
      title: "Utloggad",
      description: "Du har loggats ut."
    });
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
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
        description: "Dina ändringar har sparats."
      });

      return {};
    } catch (error) {
      return { error };
    }
  };

  const resendConfirmation = async (email: string) => {
    try {
      console.log('Resending confirmation email using Supabase native method for:', email);
      
      // Använd Supabase's inbyggda resend funktionalitet
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`
        }
      });

      if (error) {
        console.error('Supabase resend error:', error);
        throw error;
      }

      console.log('Confirmation email resent successfully');

      toast({
        title: "Ny bekräftelselänk skickad!",
        description: "Kolla din e-post för den nya bekräftelselänken. Gmail-användare: kontrollera även skräpposten!",
        duration: 8000
      });

      return { success: true };
    } catch (error: any) {
      console.error('Resend confirmation error:', error);
      
      let errorMessage = error.message || "Ett fel inträffade. Försök igen.";
      
      // Hantera specifika felmeddelanden
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
      console.log(`Sending password reset for: ${email}`);
      
      // Use our custom edge function for sending reset email
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
        title: "📧 Återställningsmail skickat!",
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
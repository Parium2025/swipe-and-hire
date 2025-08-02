import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

type UserRole = 'job_seeker' | 'employer';

interface Profile {
  id: string;
  user_id: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company_name?: string;
  org_number?: string;
  bio?: string;
  location?: string;
  profile_image_url?: string;
  video_url?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: { role: UserRole; first_name: string; last_name: string; phone?: string }) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signInWithPhone: (phone: string) => Promise<{ error?: any }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: any }>;
  resendConfirmation: (email: string) => Promise<{ error?: any }>;
  resetPassword: (email: string) => Promise<{ error?: any }>;
  updatePassword: (newPassword: string) => Promise<{ error?: any }>;
  switchRole: (newRole: UserRole) => Promise<{ error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
        fetchProfile(session.user.id).then(() => {
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
              fetchProfile(session.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const signUp = async (email: string, password: string, userData: { role: UserRole; first_name: string; last_name: string; phone?: string }) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userData
        }
      });

      if (error) {
        toast({
          title: "Registreringsfel",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Registrering lyckad",
        description: "Kontrollera din e-post för att bekräfta ditt konto."
      });

      // Send custom confirmation email
      try {
        const redirectUrl = `${window.location.origin}/`;
        await supabase.functions.invoke('send-confirmation-email', {
          body: {
            email,
            confirmationUrl: redirectUrl,
            type: 'signup'
          }
        });
      } catch (emailError) {
        console.log('Custom email send failed, falling back to Supabase default');
      }

      return {};
    } catch (error) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
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
      await fetchProfile(user.id);
      
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
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        toast({
          title: "Fel vid skickning av bekräftelse",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Bekräftelsemail skickat!",
        description: "Kontrollera din e-post för att bekräfta ditt konto."
      });

      return {};
    } catch (error) {
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`
      });

      if (error) {
        toast({
          title: "Fel vid lösenordsåterställning",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Återställningsmail skickat!",
        description: "Kontrollera din e-post för instruktioner om lösenordsåterställning."
      });

      // Send custom reset email
      try {
        const resetUrl = `${window.location.origin}/auth?reset=true`;
        await supabase.functions.invoke('send-confirmation-email', {
          body: {
            email,
            confirmationUrl: resetUrl,
            type: 'reset'
          }
        });
      } catch (emailError) {
        console.log('Custom email send failed, falling back to Supabase default');
      }

      return {};
    } catch (error) {
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

  const switchRole = async (newRole: UserRole) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', user.id);

      if (error) {
        toast({
          title: "Fel vid rollbyte",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      // Refresh profile
      await fetchProfile(user.id);
      
      toast({
        title: "Roll uppdaterad!",
        description: `Du är nu registrerad som ${newRole === 'employer' ? 'arbetsgivare' : 'jobbsökare'}.`
      });

      return {};
    } catch (error) {
      return { error };
    }
  };

  const value = {
    user,
    session,
    profile,
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
    switchRole
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
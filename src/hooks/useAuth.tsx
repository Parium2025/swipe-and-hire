import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { getMediaUrl } from '@/lib/mediaManager';
import { preloadImages } from '@/lib/serviceWorkerManager';

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

// SessionStorage keys för omedelbar visning (som arbetsgivarsidan)
const AVATAR_CACHE_KEY = 'parium_avatar_url';
const COVER_CACHE_KEY = 'parium_cover_url';
const VIDEO_CACHE_KEY = 'parium_video_url';
const TOTAL_JOBS_CACHE_KEY = 'parium_total_jobs';
const SAVED_JOBS_CACHE_KEY = 'parium_saved_jobs';
const UNIQUE_COMPANIES_CACHE_KEY = 'parium_unique_companies';
const NEW_THIS_WEEK_CACHE_KEY = 'parium_new_this_week';
// Employer stats cache keys
const EMPLOYER_MY_JOBS_CACHE_KEY = 'parium_employer_my_jobs';
const EMPLOYER_ACTIVE_JOBS_CACHE_KEY = 'parium_employer_active_jobs';
const EMPLOYER_TOTAL_VIEWS_CACHE_KEY = 'parium_employer_total_views';
const EMPLOYER_TOTAL_APPLICATIONS_CACHE_KEY = 'parium_employer_total_applications';
const EMPLOYER_CANDIDATES_CACHE_KEY = 'parium_employer_candidates';
const UNREAD_MESSAGES_CACHE_KEY = 'parium_unread_messages';
const JOB_SEEKER_UNREAD_MESSAGES_CACHE_KEY = 'parium_job_seeker_unread_messages';
const COMPANY_REVIEWS_COUNT_CACHE_KEY = 'parium_company_reviews_count';
const COMPANY_LOGO_CACHE_KEY = 'parium_company_logo_url';
const MY_APPLICATIONS_CACHE_KEY = 'parium_my_applications';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRoleData | null;
  organization: Organization | null;
  loading: boolean;
  authAction: 'login' | 'logout' | null;
  /** Förladdade signed URLs för snabb sidebar-rendering */
  preloadedAvatarUrl: string | null;
  preloadedCoverUrl: string | null;
  preloadedVideoUrl: string | null;
  preloadedCompanyLogoUrl: string | null;
  /** Förladdade räknare för sidebar och stats (jobbsökare) */
  preloadedTotalJobs: number;
  preloadedSavedJobs: number;
  preloadedUniqueCompanies: number;
  preloadedNewThisWeek: number;
  /** Förladdade räknare för employer stats */
  preloadedEmployerMyJobs: number;
  preloadedEmployerActiveJobs: number;
  preloadedEmployerTotalViews: number;
  preloadedEmployerTotalApplications: number;
  preloadedEmployerCandidates: number;
  preloadedUnreadMessages: number;
  preloadedJobSeekerUnreadMessages: number;
  preloadedCompanyReviewsCount: number;
  preloadedMyApplications: number;
  refreshSidebarCounts: () => Promise<void>;
  refreshEmployerStats: () => Promise<void>;
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
  const [authAction, setAuthAction] = useState<'login' | 'logout' | null>(null);
  const [mediaPreloadComplete, setMediaPreloadComplete] = useState(false); // 🎯 Ny state för att tracka media-laddning
  // Initialisera från sessionStorage för omedelbar visning (som arbetsgivarsidan)
  const [preloadedAvatarUrl, setPreloadedAvatarUrl] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem(AVATAR_CACHE_KEY) : null;
    } catch { return null; }
  });
  const [preloadedCoverUrl, setPreloadedCoverUrl] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem(COVER_CACHE_KEY) : null;
    } catch { return null; }
  });
  const [preloadedVideoUrl, setPreloadedVideoUrl] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem(VIDEO_CACHE_KEY) : null;
    } catch { return null; }
  });
  const [preloadedTotalJobs, setPreloadedTotalJobs] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(TOTAL_JOBS_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedSavedJobs, setPreloadedSavedJobs] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(SAVED_JOBS_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedUniqueCompanies, setPreloadedUniqueCompanies] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(UNIQUE_COMPANIES_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedNewThisWeek, setPreloadedNewThisWeek] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(NEW_THIS_WEEK_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  // Employer stats
  const [preloadedEmployerMyJobs, setPreloadedEmployerMyJobs] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(EMPLOYER_MY_JOBS_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedEmployerActiveJobs, setPreloadedEmployerActiveJobs] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(EMPLOYER_ACTIVE_JOBS_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedEmployerTotalViews, setPreloadedEmployerTotalViews] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(EMPLOYER_TOTAL_VIEWS_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedEmployerTotalApplications, setPreloadedEmployerTotalApplications] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(EMPLOYER_TOTAL_APPLICATIONS_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedCompanyLogoUrl, setPreloadedCompanyLogoUrl] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem(COMPANY_LOGO_CACHE_KEY) : null;
    } catch { return null; }
  });
  const [preloadedEmployerCandidates, setPreloadedEmployerCandidates] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(EMPLOYER_CANDIDATES_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedUnreadMessages, setPreloadedUnreadMessages] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(UNREAD_MESSAGES_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedJobSeekerUnreadMessages, setPreloadedJobSeekerUnreadMessages] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(JOB_SEEKER_UNREAD_MESSAGES_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedCompanyReviewsCount, setPreloadedCompanyReviewsCount] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(COMPANY_REVIEWS_COUNT_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const [preloadedMyApplications, setPreloadedMyApplications] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(MY_APPLICATIONS_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const isManualSignOutRef = useRef(false);
  const isInitializingRef = useRef(true);
  const isSigningInRef = useRef(false);
  const mediaPreloadCompleteRef = useRef(false);
 
  // Håll en ref i synk med state så att async login kan läsa korrekt värde
  useEffect(() => {
    mediaPreloadCompleteRef.current = mediaPreloadComplete;
  }, [mediaPreloadComplete]);
 
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
                // Om vi inte är i en aktiv email-inloggning hanterar vi loading här
                if (!isSigningInRef.current) {
                  // 🎯 Vänta på att media är klar innan vi släpper loading
                  const checkMediaReady = setInterval(() => {
                    if (mediaPreloadCompleteRef.current) {
                      clearInterval(checkMediaReady);
                      if (mounted) {
                        setLoading(false);
                        setAuthAction(null);
                      }
                    }
                  }, 50);
                  
                  // Timeout efter max ~2 sekunder (fallback om media är seg)
                  setTimeout(() => {
                    clearInterval(checkMediaReady);
                    if (mounted) {
                      setLoading(false);
                      setAuthAction(null);
                    }
                  }, 2000);
                }
              });
            }, 0);
          }
        } else {
          setProfile(null);
          setUserRole(null);
          setOrganization(null);
          setMediaPreloadComplete(false);
          setPreloadedAvatarUrl(null);
          setPreloadedCoverUrl(null);
          setPreloadedVideoUrl(null);
          // Rensa sessionStorage-cache vid utloggning
          try {
            sessionStorage.removeItem(AVATAR_CACHE_KEY);
            sessionStorage.removeItem(COVER_CACHE_KEY);
            sessionStorage.removeItem(VIDEO_CACHE_KEY);
          } catch {}
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
          // 🎯 Vänta på media innan vi släpper initial loading
          const checkMediaReady = setInterval(() => {
            if (mediaPreloadComplete) {
              clearInterval(checkMediaReady);
              if (mounted) {
                setLoading(false);
                setAuthAction(null);
              }
            }
          }, 50);
          
          // Timeout efter max 1.1 sekunder för initial load (matchar "Loggar in..." screen)
          setTimeout(() => {
            clearInterval(checkMediaReady);
            if (mounted) {
              setLoading(false);
              setAuthAction(null);
            }
          }, 1100);
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
        // Vid fel: nollställ profil men markera media som klar så att login inte fastnar
        setProfile(null);
        setMediaPreloadComplete(true);
        return;
      } else if (!profileData) {
        // Ingen profil än: låt onboarding hantera resten men blockera inte login
        setProfile(null);
        setMediaPreloadComplete(true);
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
        
        // 🔥 KRITISKT: Förladdda kritiska bilder (avatar + cover) INNAN vi släpper loading-state
        // Video är tung – den cachas i bakgrunden men blockerar inte inloggning
        (async () => {
          try {
            setMediaPreloadComplete(false);
            mediaPreloadCompleteRef.current = false;
            
            const criticalImages: string[] = [];
            let avatarUrl: string | null = null;
            let coverUrl: string | null = null;
            
            // Parallell fetch av avatar + cover med timeout per request
            const fetchWithTimeout = async (promise: Promise<string | null>, timeoutMs: number): Promise<string | null> => {
              const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
              return Promise.race([promise, timeoutPromise]);
            };
            
            // Profilbild (max 800ms)
            if (processedProfile.profile_image_url) {
              try {
                avatarUrl = await fetchWithTimeout(
                  getMediaUrl(processedProfile.profile_image_url, 'profile-image', 86400),
                  800
                );
                if (avatarUrl) criticalImages.push(avatarUrl);
              } catch (err) {
                console.warn('Avatar URL generation failed, continuing:', err);
              }
            }
            
            // Cover-bild (max 800ms)
            if (processedProfile.cover_image_url) {
              try {
                coverUrl = await fetchWithTimeout(
                  getMediaUrl(processedProfile.cover_image_url, 'cover-image', 86400),
                  800
                );
                if (coverUrl) criticalImages.push(coverUrl);
              } catch (err) {
                console.warn('Cover URL generation failed, continuing:', err);
              }
            }
            
            // DOM-preload med timeout (max 500ms totalt)
            if (criticalImages.length > 0) {
              try {
                const { preloadImages } = await import('@/hooks/useImagePreloader');
                await Promise.race([
                  preloadImages(criticalImages, 'high'),
                  new Promise((resolve) => setTimeout(resolve, 500))
                ]);
              } catch (preloadError) {
                console.warn('DOM preload timeout, continuing:', preloadError);
              }
            }
            
            // Sätt URLs för sidebar + spara i sessionStorage för omedelbar visning
            setPreloadedAvatarUrl(avatarUrl || coverUrl || null);
            setPreloadedCoverUrl(coverUrl || null);
            
            // Spara till sessionStorage (som arbetsgivarsidan)
            try {
              if (avatarUrl) sessionStorage.setItem(AVATAR_CACHE_KEY, avatarUrl);
              else sessionStorage.removeItem(AVATAR_CACHE_KEY);
              if (coverUrl) sessionStorage.setItem(COVER_CACHE_KEY, coverUrl);
              else sessionStorage.removeItem(COVER_CACHE_KEY);
            } catch {}
            
            // Markera som klar (släpp inloggning)
            mediaPreloadCompleteRef.current = true;
            setMediaPreloadComplete(true);
            
            // Video i bakgrunden (blockerar INTE men cachas för omedelbar visning)
            if (processedProfile.video_url) {
              (async () => {
                try {
                  const videoUrl = await getMediaUrl(processedProfile.video_url, 'profile-video', 86400);
                  if (videoUrl) {
                    // Spara till state OCH sessionStorage
                    setPreloadedVideoUrl(videoUrl);
                    try { sessionStorage.setItem(VIDEO_CACHE_KEY, videoUrl); } catch {}
                    
                    const { imageCache } = await import('@/lib/imageCache');
                    await imageCache.preloadImages([videoUrl]);
                  }
                } catch (err) {
                  console.warn('Background video preload failed:', err);
                }
              })();
            }
            
            // Company logo för employer sidebar (public bucket, ingen signed URL behövs)
            if ((processedProfile as any).company_logo_url) {
              const companyLogoUrl = (processedProfile as any).company_logo_url;
              setPreloadedCompanyLogoUrl(companyLogoUrl);
              try { sessionStorage.setItem(COMPANY_LOGO_CACHE_KEY, companyLogoUrl); } catch {}
              
              // Preload logo image
              (async () => {
                try {
                  const { imageCache } = await import('@/lib/imageCache');
                  await imageCache.preloadImages([companyLogoUrl]);
                } catch (err) {
                  console.warn('Company logo preload failed:', err);
                }
              })();
            }
          } catch (error) {
            console.error('Media preload error:', error);
            setPreloadedAvatarUrl(null);
            setPreloadedCoverUrl(null);
            setPreloadedVideoUrl(null);
            mediaPreloadCompleteRef.current = true;
            setMediaPreloadComplete(true);
          }
        })();
        
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
        setUserRole(roleData as UserRoleData);

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
      setAuthAction('login');
      setLoading(true); // 🔥 Håll loading true under hela inloggningen
      isSigningInRef.current = true;
      console.log('🔍 SignIn started for:', email);
 
      // Minsta visningstid för "Loggar in..." (ca 1–1.1 sekund)
      const minDelayPromise = new Promise(resolve => setTimeout(resolve, 1100));
 
      // Starta auth-anropet
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
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
          // Släpp loading vid obekräftat konto
          setLoading(false);
          setAuthAction(null);
          return { error: { ...error, code: 'email_not_confirmed', message: 'Email not confirmed' } };
        } else {
          toast({ title: "Inloggningsfel", description: error.message, variant: "destructive" });
        }
        // Släpp loading direkt vid fel
        setLoading(false);
        setAuthAction(null);
        return { error };
      }
 
      // CRITICAL: Block login if email is not confirmed
      if (signInData?.user && !signInData.user.email_confirmed_at) {
        console.log('🚫 Login blocked: Email not confirmed for', email);
        
        // Sign out i bakgrunden utan att vänta
        supabase.auth.signOut();
        
        toast({
          title: "Kontot är inte bekräftat",
          description: "Du behöver bekräfta din e-post först genom att klicka på länken i bekräftelsemailet. Kolla din inkorg!",
          variant: "default",
          duration: 10000
        });
        
        setLoading(false);
        setAuthAction(null);
        return { error: { code: 'email_not_confirmed', message: 'Email not confirmed' } };
      }
 
      // Lyckad inloggning – nollställ media-preload och vänta tills kritiska bilder hunnit laddas klart
      setMediaPreloadComplete(false);
      mediaPreloadCompleteRef.current = false;

      const mediaPromise = new Promise<void>((resolve) => {
        const start = Date.now();
        const checkMedia = setInterval(() => {
          if (mediaPreloadCompleteRef.current) {
            clearInterval(checkMedia);
            resolve();
          } else if (Date.now() - start > 1500) {
            // Fallback: max ~1.5 sekunder extra väntan även om media inte rapporterar klart
            clearInterval(checkMedia);
            console.log('⏱️ Media preload timeout (~1.5s), fortsätter login ändå');
            resolve();
          }
        }, 50);
      });
 
      console.log('✅ Login successful, waiting for minimum delay + media preload...');
      await Promise.all([minDelayPromise, mediaPromise]);
 
      console.log('✅ Minimum delay + media preload klar, släpper in användaren');
      setLoading(false);
      setAuthAction(null);
 
      return {};
    } catch (error: any) {
      setLoading(false);
      setAuthAction(null);
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
      console.log('🚪 Attempting to sign out...');
      setAuthAction('logout');
      
      // Markera att detta är en manuell utloggning
      isManualSignOutRef.current = true;

      // Sätt loading state för smooth utloggning
      setLoading(true);

      // Vänta 1.1 sekund (identiskt med login-skärmen) för smooth känsla
      await new Promise(resolve => setTimeout(resolve, 550));
      
      // Låt backend sköta sessionen
      await supabase.auth.signOut({ scope: 'global' });
      
      // Vänta resterande tid för smooth övergång
      await new Promise(resolve => setTimeout(resolve, 550));
      
      console.log('✅ User signed out successfully');
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      toast({
        variant: "destructive",
        title: "Fel",
        description: "Kunde inte logga ut. Försök igen.",
      });
    } finally {
      setLoading(false);
      isManualSignOutRef.current = false;
      setAuthAction(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const updateProfile = async (updates: Partial<Profile>): Promise<{ error?: any }> => {
    if (!user) return { error: 'No user logged in' };

    try {
      // Ensure interests is always an array when updating
      const cleanedUpdates: any = { ...updates };
      if (cleanedUpdates.interests) {
        cleanedUpdates.interests = Array.isArray(cleanedUpdates.interests)
          ? cleanedUpdates.interests
          : [cleanedUpdates.interests];
      }

      // Map frontend-only fields to actual database columns
      if (Object.prototype.hasOwnProperty.call(cleanedUpdates, 'employment_status')) {
        cleanedUpdates.employment_type = cleanedUpdates.employment_status;
        delete cleanedUpdates.employment_status;
      }

      if (Object.prototype.hasOwnProperty.call(cleanedUpdates, 'working_hours')) {
        cleanedUpdates.work_schedule = cleanedUpdates.working_hours;
        delete cleanedUpdates.working_hours;
      }

      if (Object.prototype.hasOwnProperty.call(cleanedUpdates, 'cv_filename')) {
        cleanedUpdates.profile_file_name = cleanedUpdates.cv_filename;
        delete cleanedUpdates.cv_filename;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(cleanedUpdates)
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
      
      // Don't show toast here - let the calling component handle UI feedback
      // This prevents duplicate notifications

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
    return userRole?.role === 'employer' && user?.email === 'fredrikandits@hotmail.com';
  };

  const isCompanyUser = (): boolean => {
    return hasRole('employer');
  };

  const getRedirectPath = (): string => {
    if (!userRole) return '/';
    
    if (userRole.role === 'employer') {
      return '/dashboard';
    } else if (userRole.role === 'job_seeker') {
      return '/search-jobs';
    }
    return '/';
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


  // Funktion för att uppdatera sidebar-räknare (används av realtime + initial load)
  const refreshSidebarCounts = useCallback(async () => {
    console.log('[refreshSidebarCounts] Triggered - user:', user?.id);
    try {
      // Hämta aktiva jobb med employer_id, created_at OCH expires_at för att filtrera bort utgångna
      const { data: activeJobs } = await supabase
        .from('job_postings')
        .select('employer_id, created_at, expires_at')
        .eq('is_active', true);
      
      // Filtrera bort utgångna jobb (där expires_at har passerat)
      const now = new Date();
      const nonExpiredJobs = (activeJobs || []).filter(job => {
        if (!job.expires_at) return true; // Inget utgångsdatum = fortfarande aktivt
        return new Date(job.expires_at) > now;
      });
      
      const newTotalJobs = nonExpiredJobs.length;
      console.log('[refreshSidebarCounts] Total jobs (non-expired):', newTotalJobs);
      setPreloadedTotalJobs(newTotalJobs);
      try { sessionStorage.setItem(TOTAL_JOBS_CACHE_KEY, String(newTotalJobs)); } catch {}

      // Räkna unika företag (endast icke-utgångna)
      const uniqueEmployers = new Set(nonExpiredJobs.map(j => j.employer_id));
      const newUniqueCompanies = uniqueEmployers.size;
      setPreloadedUniqueCompanies(newUniqueCompanies);
      try { sessionStorage.setItem(UNIQUE_COMPANIES_CACHE_KEY, String(newUniqueCompanies)); } catch {}

      // Räkna nya denna vecka (endast icke-utgångna)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const newThisWeek = nonExpiredJobs.filter(j => new Date(j.created_at) > weekAgo).length;
      setPreloadedNewThisWeek(newThisWeek);
      try { sessionStorage.setItem(NEW_THIS_WEEK_CACHE_KEY, String(newThisWeek)); } catch {}

      // Hämta antal sparade jobb för användaren (endast icke-utgångna)
      if (user) {
        const { data: savedJobsData } = await supabase
          .from('saved_jobs')
          .select('job_id, job_postings!inner(is_active, expires_at)')
          .eq('user_id', user.id);
        
        // Filtrera bort sparade jobb där jobbannonsen har utgått
        const now = new Date();
        const activeSavedJobs = (savedJobsData || []).filter((sj: any) => {
          const job = sj.job_postings;
          if (!job || !job.is_active) return false;
          if (job.expires_at && new Date(job.expires_at) <= now) return false;
          return true;
        });
        
        const newSavedJobs = activeSavedJobs.length;
        console.log('[refreshSidebarCounts] Saved jobs (non-expired):', newSavedJobs);
        setPreloadedSavedJobs(newSavedJobs);
        try { sessionStorage.setItem(SAVED_JOBS_CACHE_KEY, String(newSavedJobs)); } catch {}

        // Hämta antal olästa meddelanden för jobbsökare
        const { count: jobSeekerUnread } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false);
        
        const jsUnread = jobSeekerUnread || 0;
        setPreloadedJobSeekerUnreadMessages(jsUnread);
        try { sessionStorage.setItem(JOB_SEEKER_UNREAD_MESSAGES_CACHE_KEY, String(jsUnread)); } catch {}

        // Hämta antal ansökningar för jobbsökare
        const { count: myApplications } = await supabase
          .from('job_applications')
          .select('*', { count: 'exact', head: true })
          .eq('applicant_id', user.id);
        
        const appCount = myApplications || 0;
        console.log('[refreshSidebarCounts] My applications:', appCount);
        setPreloadedMyApplications(appCount);
        try { sessionStorage.setItem(MY_APPLICATIONS_CACHE_KEY, String(appCount)); } catch {}
      }
    } catch (err) {
      console.error('[refreshSidebarCounts] Error:', err);
    }
  }, [user]);

  // Funktion för att uppdatera employer stats (används av realtime + initial load)
  const refreshEmployerStats = useCallback(async () => {
    if (!user) return;
    
    try {
      // Hämta alla jobb för denna employer
      const { data: myJobs } = await supabase
        .from('job_postings')
        .select('id, is_active, views_count, applications_count')
        .eq('employer_id', user.id);
      
      if (!myJobs) return;
      
      // Mina annonser (totalt)
      const myJobsCount = myJobs.length;
      setPreloadedEmployerMyJobs(myJobsCount);
      try { sessionStorage.setItem(EMPLOYER_MY_JOBS_CACHE_KEY, String(myJobsCount)); } catch {}
      
      // Aktiva annonser
      const activeJobs = myJobs.filter(j => j.is_active);
      const activeCount = activeJobs.length;
      setPreloadedEmployerActiveJobs(activeCount);
      try { sessionStorage.setItem(EMPLOYER_ACTIVE_JOBS_CACHE_KEY, String(activeCount)); } catch {}
      
      // Totala visningar
      const totalViews = activeJobs.reduce((sum, j) => sum + (j.views_count || 0), 0);
      setPreloadedEmployerTotalViews(totalViews);
      try { sessionStorage.setItem(EMPLOYER_TOTAL_VIEWS_CACHE_KEY, String(totalViews)); } catch {}
      
      // Totala ansökningar
      const totalApplications = activeJobs.reduce((sum, j) => sum + (j.applications_count || 0), 0);
      setPreloadedEmployerTotalApplications(totalApplications);
      try { sessionStorage.setItem(EMPLOYER_TOTAL_APPLICATIONS_CACHE_KEY, String(totalApplications)); } catch {}
      
      // Hämta antal unika kandidater (baserat på job_applications)
      const jobIds = myJobs.map(j => j.id);
      if (jobIds.length > 0) {
        const { count } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .in('job_id', jobIds);
        
        const candidatesCount = count || 0;
        setPreloadedEmployerCandidates(candidatesCount);
        try { sessionStorage.setItem(EMPLOYER_CANDIDATES_CACHE_KEY, String(candidatesCount)); } catch {}
      } else {
        setPreloadedEmployerCandidates(0);
        try { sessionStorage.setItem(EMPLOYER_CANDIDATES_CACHE_KEY, '0'); } catch {}
      }
      
      // Hämta antal olästa meddelanden
      const { count: unreadCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      const unread = unreadCount || 0;
      setPreloadedUnreadMessages(unread);
      try { sessionStorage.setItem(UNREAD_MESSAGES_CACHE_KEY, String(unread)); } catch {}

      // Hämta antal company reviews för denna employer
      const { count: reviewsCount } = await supabase
        .from('company_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', user.id);
      
      const reviews = reviewsCount || 0;
      setPreloadedCompanyReviewsCount(reviews);
      try { sessionStorage.setItem(COMPANY_REVIEWS_COUNT_CACHE_KEY, String(reviews)); } catch {}
    } catch (err) {
      console.error('Error refreshing employer stats:', err);
    }
  }, [user]);

  // Ladda räknare vid inloggning
  useEffect(() => {
    if (user && !loading) {
      refreshSidebarCounts();
      refreshEmployerStats();
    }
  }, [user, loading, refreshSidebarCounts, refreshEmployerStats]);

  // Realtime-prenumerationer för räknare
  useEffect(() => {
    if (!user) return;

    console.log('[Realtime] Setting up subscriptions for user:', user.id);

    const jobChannel = supabase
      .channel('auth-job-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_postings' },
        (payload) => {
          console.log('[Realtime] job_postings change:', payload.eventType);
          refreshSidebarCounts();
          refreshEmployerStats();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] job_postings subscription status:', status);
      });

    const savedChannel = supabase
      .channel(`auth-saved-jobs-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_jobs', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('[Realtime] saved_jobs change:', payload.eventType);
          refreshSidebarCounts();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] saved_jobs subscription status:', status);
      });

    // Real-time för ansökningar (uppdaterar employer stats OCH jobbsökarens räknare)
    const applicationsChannel = supabase
      .channel(`auth-applications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_applications', filter: `applicant_id=eq.${user.id}` },
        (payload) => {
          console.log('[Realtime] job_applications change:', payload.eventType);
          refreshSidebarCounts();
          refreshEmployerStats();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] job_applications subscription status:', status);
      });

    // Real-time för meddelanden (uppdaterar oläst-badge för både employer och jobbsökare)
    const messagesChannel = supabase
      .channel(`auth-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          console.log('[Realtime] messages change:', payload.eventType);
          refreshEmployerStats();
          refreshSidebarCounts();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] messages subscription status:', status);
      });

    // Real-time för company reviews (uppdaterar recensionsräknare för arbetsgivare)
    const reviewsChannel = supabase
      .channel(`auth-reviews-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'company_reviews', filter: `company_id=eq.${user.id}` },
        (payload) => {
          console.log('[Realtime] company_reviews change:', payload.eventType);
          refreshEmployerStats();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] company_reviews subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up subscriptions');
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(savedChannel);
      supabase.removeChannel(applicationsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(reviewsChannel);
    };
  }, [user, refreshSidebarCounts, refreshEmployerStats]);

  const value: AuthContextType = {
    user,
    session,
    profile,
    userRole,
    organization,
    loading,
    authAction,
    preloadedAvatarUrl,
    preloadedCoverUrl,
    preloadedVideoUrl,
    preloadedCompanyLogoUrl,
    preloadedTotalJobs,
    preloadedSavedJobs,
    preloadedUniqueCompanies,
    preloadedNewThisWeek,
    preloadedEmployerMyJobs,
    preloadedEmployerActiveJobs,
    preloadedEmployerTotalViews,
    preloadedEmployerTotalApplications,
    preloadedEmployerCandidates,
    preloadedUnreadMessages,
    preloadedJobSeekerUnreadMessages,
    preloadedCompanyReviewsCount,
    preloadedMyApplications,
    refreshSidebarCounts,
    refreshEmployerStats,
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
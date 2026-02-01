import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { getMediaUrl } from '@/lib/mediaManager';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { preloadImages } from '@/lib/serviceWorkerManager';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { preloadWeatherLocation } from '@/hooks/useWeather';
import { clearAllDrafts } from '@/hooks/useFormDraft';
import { triggerBackgroundSync, clearAllAppCaches } from '@/hooks/useEagerRatingsPreload';
import { showAuthSplash } from '@/lib/authSplashEvents';

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
const EMPLOYER_DASHBOARD_JOBS_CACHE_KEY = 'parium_employer_dashboard_jobs';
const EMPLOYER_TOTAL_VIEWS_CACHE_KEY = 'parium_employer_total_views';
const EMPLOYER_TOTAL_APPLICATIONS_CACHE_KEY = 'parium_employer_total_applications';
const EMPLOYER_CANDIDATES_CACHE_KEY = 'parium_employer_candidates';
const UNREAD_MESSAGES_CACHE_KEY = 'parium_unread_messages';
const JOB_SEEKER_UNREAD_MESSAGES_CACHE_KEY = 'parium_job_seeker_unread_messages';
const COMPANY_REVIEWS_COUNT_CACHE_KEY = 'parium_company_reviews_count';
const COMPANY_LOGO_CACHE_KEY = 'parium_company_logo_url';
const MY_APPLICATIONS_CACHE_KEY = 'parium_my_applications';
const MY_CANDIDATES_CACHE_KEY = 'parium_my_candidates';

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
  preloadedEmployerDashboardJobs: number;
  preloadedEmployerTotalViews: number;
  preloadedEmployerTotalApplications: number;
  preloadedEmployerCandidates: number;
  preloadedUnreadMessages: number;
  preloadedJobSeekerUnreadMessages: number;
  preloadedCompanyReviewsCount: number;
  preloadedMyApplications: number;
  preloadedMyCandidates: number;
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
  const [preloadedEmployerDashboardJobs, setPreloadedEmployerDashboardJobs] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(EMPLOYER_DASHBOARD_JOBS_CACHE_KEY) : null;
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
  const [preloadedMyCandidates, setPreloadedMyCandidates] = useState<number>(() => {
    try {
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(MY_CANDIDATES_CACHE_KEY) : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch { return 0; }
  });
  const isManualSignOutRef = useRef(false);
  const isInitializingRef = useRef(true);
  const isSigningInRef = useRef(false);
  const mediaPreloadCompleteRef = useRef(false);
  const profileLoadedRef = useRef(false); // 🔧 Track when profile is loaded for login flow
  const prefetchedEmployerCandidateMediaForUserRef = useRef<string | null>(null);
  // 🔄 Track current user ID for cross-tab session change detection
  const currentUserIdRef = useRef<string | null>(null);
  // Avoid doing heavy localStorage sweeps during the very first paint on /auth.
  const didInitialLoggedOutCleanupRef = useRef(false);
 
  // Håll en ref i synk med state så att async login kan läsa korrekt värde
  useEffect(() => {
    mediaPreloadCompleteRef.current = mediaPreloadComplete;
  }, [mediaPreloadComplete]);
 
  useEffect(() => {
    let mounted = true;
    let sessionInitialized = false;

    const scheduleLoggedOutCacheClear = (event: string) => {
      try {
        const isInitial = event === 'INITIAL_SESSION';
        if (isInitial) {
          // On cold start while logged out: don't block first paint.
          if (didInitialLoggedOutCleanupRef.current) return;
          didInitialLoggedOutCleanupRef.current = true;
        }

        const isAuthRoute =
          typeof window !== 'undefined' && window.location?.pathname === '/auth';

        const run = () => {
          try {
            clearAllAppCaches();
          } catch {
            // ignore
          }
        };

        // On /auth we defer aggressively; on other routes we can clear next tick.
        if (isAuthRoute) {
          const ric = (window as any).requestIdleCallback as
            | ((cb: () => void, opts?: any) => void)
            | undefined;
          if (typeof ric === 'function') {
            ric(run, { timeout: 2000 } as any);
          } else {
            setTimeout(run, 1500);
          }
        } else {
          setTimeout(run, 0);
        }
      } catch {
        // Last-resort fallback
        setTimeout(() => {
          try { clearAllAppCaches(); } catch {}
        }, 0);
      }
    };

    // Set up auth state listener FIRST to avoid missing events and deadlocks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        // 🔄 Detect cross-tab session changes (different user logged in)
        const newUserId = session?.user?.id ?? null;
        const previousUserId = currentUserIdRef.current;
        
        // Check if user changed (not initial load and not manual sign-in/out)
        if (
          previousUserId !== null && 
          newUserId !== null && 
          previousUserId !== newUserId &&
          !isManualSignOutRef.current &&
          !isSigningInRef.current
        ) {
          // Different user logged in from another tab
          console.log('🔄 Session changed in another tab - different user detected');
          toast({
            title: 'Sessionen har ändrats',
            description: 'Du har loggats in med ett annat konto i en annan flik. Sidan laddas om.',
            duration: 4000,
          });
          // Clear all caches and reload after a short delay
          setTimeout(() => {
            clearAllAppCaches();
            window.location.href = '/auth';
          }, 1500);
          return;
        }
        
        // Check if user was logged out from another tab (but not manually)
        if (
          previousUserId !== null && 
          newUserId === null &&
          !isManualSignOutRef.current &&
          event !== 'INITIAL_SESSION'
        ) {
          console.log('🔄 Session ended in another tab - user was logged out');
          toast({
            title: 'Du har loggats ut',
            description: 'Sessionen avslutades i en annan flik.',
            duration: 4000,
          });
          setTimeout(() => {
            clearAllAppCaches();
            window.location.href = '/auth';
          }, 1500);
          return;
        }
        
        // Update tracking refs
        currentUserIdRef.current = newUserId;
        
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
          profileLoadedRef.current = false; // 🔧 Reset profile loaded flag on logout
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
          // 🗑️ Rensa ALLA app-cacher så inget gammalt visas vid nästa login
          // Defer on /auth to avoid blocking first paint / causing visible jank.
          scheduleLoggedOutCacheClear(event);
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
        // Vid fel: nollställ profil men markera som klar så att login inte fastnar
        setProfile(null);
        setMediaPreloadComplete(true);
        profileLoadedRef.current = true; // 🔧 Still mark as "loaded" so login can proceed
        return;
      } else if (!profileData) {
        // Ingen profil än: låt onboarding hantera resten men blockera inte login
        setProfile(null);
        setMediaPreloadComplete(true);
        profileLoadedRef.current = true; // 🔧 Still mark as "loaded" so login can proceed
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
        profileLoadedRef.current = true; // 🔧 Mark profile as loaded for login flow
        
        // 🔥 KRITISKT: Förladdda kritiska bilder (avatar + cover) INNAN vi släpper loading-state
        // Video är tung – den cachas i bakgrunden men blockerar inte inloggning
        (async () => {
          try {
            setMediaPreloadComplete(false);
            mediaPreloadCompleteRef.current = false;
            
            const criticalImages: string[] = [];
            let avatarUrl: string | null = null;
            let coverUrl: string | null = null;
            
            // Parallell fetch av avatar + cover med timeout per request (ökat timeout för stabilitet)
            const fetchWithTimeout = async (promise: Promise<string | null>, timeoutMs: number): Promise<string | null> => {
              const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
              return Promise.race([promise, timeoutPromise]);
            };
            
            // Retry-wrapper för mer robust hämtning
            const fetchWithRetry = async (
              storagePath: string,
              mediaType: 'profile-image' | 'cover-image' | 'profile-video',
              timeoutMs: number,
              maxRetries: number = 2
            ): Promise<string | null> => {
              for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                  const result = await fetchWithTimeout(
                    getMediaUrl(storagePath, mediaType, 86400),
                    timeoutMs
                  );
                  if (result) return result;
                  // Om null på första försöket, prova igen med längre timeout
                  if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 200)); // Kort paus mellan retries
                  }
                } catch (err) {
                  console.warn(`Media fetch attempt ${attempt + 1} failed:`, err);
                }
              }
              return null;
            };
            
            // Parallell fetch av profilbild + cover (ökat timeout till 2000ms + retries)
            const [avatarResult, coverResult] = await Promise.all([
              processedProfile.profile_image_url
                ? fetchWithRetry(processedProfile.profile_image_url, 'profile-image', 2000)
                : Promise.resolve(null),
              processedProfile.cover_image_url
                ? fetchWithRetry(processedProfile.cover_image_url, 'cover-image', 2000)
                : Promise.resolve(null)
            ]);
            
            avatarUrl = avatarResult;
            coverUrl = coverResult;
            
            if (avatarUrl) criticalImages.push(avatarUrl);
            if (coverUrl) criticalImages.push(coverUrl);
            
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
            
            // Video i bakgrunden med retry-logik (blockerar INTE men cachas för omedelbar visning)
            if (processedProfile.video_url) {
              (async () => {
                try {
                  // Använd retry-funktionen för stabilare hämtning
                  const videoUrl = await fetchWithRetry(processedProfile.video_url, 'profile-video', 3000, 2);
                  if (videoUrl) {
                    // Spara till state OCH sessionStorage
                    setPreloadedVideoUrl(videoUrl);
                    try { sessionStorage.setItem(VIDEO_CACHE_KEY, videoUrl); } catch {}
                    
                    // Notera: imageCache hoppar över videofiler automatiskt
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
            
            // 🌤️ Preload weather location in background (for employer home page)
            // This runs silently and caches the location so it's ready when user reaches home
            preloadWeatherLocation().catch(err => {
              console.warn('Weather location preload failed (non-blocking):', err);
            });
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
      setLoading(true);
      isSigningInRef.current = true;
      
      // 🗑️ KRITISKT: Rensa ALL app-cache DIREKT vid login
      // Detta förhindrar att gammal data (t.ex. snö-vädereffekt från tidigare session)
      // visas innan ny data hämtas
      clearAllAppCaches();
      profileLoadedRef.current = false; // 🔧 Reset before new login attempt
 
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
 
      // Lyckad inloggning – vänta på minsta visningstid OCH att profilen laddas
      await minDelayPromise;
      
      // 🔧 KRITISK FIX: Vänta på att fetchUserData faktiskt har laddat profilen
      // Nu använder vi profileLoadedRef för att veta när profilen är redo
      const profileCheckStart = Date.now();
      const maxWaitMs = 3000;
      
      await new Promise<void>((resolve) => {
        const checkProfile = () => {
          const elapsed = Date.now() - profileCheckStart;
          
          // Kolla om profilen har laddats via ref
          if (profileLoadedRef.current) {
            resolve();
          } else if (elapsed >= maxWaitMs) {
            // Timeout - fortsätt ändå för att inte blockera
            console.warn('Profile load timeout - continuing anyway');
            resolve();
          } else {
            setTimeout(checkProfile, 50);
          }
        };
        checkProfile();
      });

      // 🚀 BACKGROUND SYNC ENGINE: Starta all preloading DIREKT vid login
      // Kör i bakgrunden - blockera inte UI
      triggerBackgroundSync().catch(console.warn);

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
      setAuthAction('logout');

      // Show auth logo overlay immediately (covers the intentional sign-out delays)
      showAuthSplash();
      
      // Markera att detta är en manuell utloggning
      isManualSignOutRef.current = true;

      // Sätt loading state för smooth utloggning
      setLoading(true);

      // Vänta för smooth känsla
      await new Promise(resolve => setTimeout(resolve, 550));
      
      // Låt backend sköta sessionen
      await supabase.auth.signOut({ scope: 'global' });
      
      // Rensa alla sparade formulärutkast vid utloggning
      clearAllDrafts();
      
      // 🗑️ Rensa ALLA app-cacher (väder, betyg, snapshots etc) för att 
      // garantera att ingen gammal data visas vid nästa inloggning
      clearAllAppCaches();
      
      // Vänta resterande tid för smooth övergång
      await new Promise(resolve => setTimeout(resolve, 550));
    } catch (error: any) {
      console.error('Sign out error:', error);
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
    // Alla roller landar på /home efter inloggning
    return '/home';
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
    try {
      // Hämta aktiva jobb med employer_id, created_at OCH expires_at för att filtrera bort utgångna
      const { data: activeJobs } = await supabase
        .from('job_postings')
        .select('employer_id, created_at, expires_at')
        .eq('is_active', true);
      
      // Filtrera bort utgångna jobb (där expires_at har passerat)
      const now = new Date();
      const nonExpiredJobs = (activeJobs || []).filter(job => {
        if (!job.expires_at) return true;
        return new Date(job.expires_at) > now;
      });
      
      const newTotalJobs = nonExpiredJobs.length;
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

      // Hämta antal sparade jobb för användaren (alla, inklusive utgångna)
      if (user) {
        const { count: savedJobsCount } = await supabase
          .from('saved_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        const newSavedJobs = savedJobsCount || 0;
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
        setPreloadedMyApplications(appCount);
        try { sessionStorage.setItem(MY_APPLICATIONS_CACHE_KEY, String(appCount)); } catch {}
      }
    } catch (err) {
      // Silent error handling
    }
  }, [user]);

  // Funktion för att uppdatera employer stats (används av realtime + initial load)
  // OBS: För Dashboard-konsistens hämtar vi organisations-jobb om användaren tillhör en org
  const refreshEmployerStats = useCallback(async () => {
    if (!user) return;
    
    try {
      // Hämta organization_id för användaren (om de tillhör en)
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      const orgId = userRole?.organization_id;
      
      let orgJobs: { id: string; is_active: boolean | null; views_count: number | null; applications_count: number | null; employer_id: string; created_at: string; expires_at: string | null }[] = [];
      
      if (orgId) {
        // Hämta alla user_ids i organisationen
        const { data: orgUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('organization_id', orgId)
          .eq('is_active', true);
        
        const userIds = orgUsers?.map(u => u.user_id) || [user.id];
        
        // Hämta alla jobb för organisationen (inkl. created_at och expires_at för utgångsfiltrering)
        const { data } = await supabase
          .from('job_postings')
          .select('id, is_active, views_count, applications_count, employer_id, created_at, expires_at')
          .in('employer_id', userIds);
        
        orgJobs = data || [];
      } else {
        // Ingen organisation - hämta bara egna jobb
        const { data } = await supabase
          .from('job_postings')
          .select('id, is_active, views_count, applications_count, employer_id, created_at, expires_at')
          .eq('employer_id', user.id);
        
        orgJobs = data || [];
      }
      
      // Helper för att kolla om ett jobb är utgånget (samma logik som i date.ts)
      const isJobExpired = (createdAt: string, expiresAt: string | null): boolean => {
        const effectiveExpiry = expiresAt 
          ? new Date(expiresAt) 
          : new Date(new Date(createdAt).getTime() + 24 * 60 * 60 * 1000); // Default: 1 dag
        return effectiveExpiry < new Date();
      };
      
      // Mina annonser (totalt - alla i organisationen)
      const myJobsCount = orgJobs.length;
      setPreloadedEmployerMyJobs(myJobsCount);
      try { sessionStorage.setItem(EMPLOYER_MY_JOBS_CACHE_KEY, String(myJobsCount)); } catch {}
      
      // Aktiva annonser (exkludera utgångna jobb - samma filter som Dashboard)
      const activeJobs = orgJobs.filter(j => j.is_active && !isJobExpired(j.created_at, j.expires_at));
      const activeCount = activeJobs.length;
      setPreloadedEmployerActiveJobs(activeCount);
      try { sessionStorage.setItem(EMPLOYER_ACTIVE_JOBS_CACHE_KEY, String(activeCount)); } catch {}
      
      // Dashboard jobb (aktiva + utgångna, dvs alla is_active=true jobb)
      const dashboardJobs = orgJobs.filter(j => j.is_active);
      const dashboardCount = dashboardJobs.length;
      setPreloadedEmployerDashboardJobs(dashboardCount);
      try { sessionStorage.setItem(EMPLOYER_DASHBOARD_JOBS_CACHE_KEY, String(dashboardCount)); } catch {}
      
      // Totala visningar (bara från aktiva, icke-utgångna jobb)
      const totalViews = activeJobs.reduce((sum, j) => sum + (j.views_count || 0), 0);
      setPreloadedEmployerTotalViews(totalViews);
      try { sessionStorage.setItem(EMPLOYER_TOTAL_VIEWS_CACHE_KEY, String(totalViews)); } catch {}
      
      // Totala ansökningar (bara från aktiva, icke-utgångna jobb)
      const totalApplications = activeJobs.reduce((sum, j) => sum + (j.applications_count || 0), 0);
      setPreloadedEmployerTotalApplications(totalApplications);
      try { sessionStorage.setItem(EMPLOYER_TOTAL_APPLICATIONS_CACHE_KEY, String(totalApplications)); } catch {}
      
      // Hämta antal unika kandidater (baserat på job_applications för organisationens jobb)
      const jobIds = orgJobs.map(j => j.id);
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

      // Hämta antal kandidater i "Mina kandidater" (my_candidates table)
      const { count: myCandidatesCount } = await supabase
        .from('my_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('recruiter_id', user.id);
      
      const myCandidates = myCandidatesCount || 0;
      setPreloadedMyCandidates(myCandidates);
      try { sessionStorage.setItem(MY_CANDIDATES_CACHE_KEY, String(myCandidates)); } catch {}
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

  // Prefetch kandidat-avatarer i bakgrunden direkt efter login (så /candidates känns "bam")
  useEffect(() => {
    if (!user || loading) return;
    if (userRole?.role !== 'employer') return;

    // Kör 1 gång per user-id
    if (prefetchedEmployerCandidateMediaForUserRef.current === user.id) return;
    prefetchedEmployerCandidateMediaForUserRef.current = user.id;

    setTimeout(() => {
      (async () => {
        try {
          // 1. Prefetch kandidat-avatarer för /candidates
          const { data: apps, error } = await supabase
            .from('job_applications')
            .select('applicant_id')
            .order('applied_at', { ascending: false })
            .range(0, 24);

          if (!error && apps && apps.length > 0) {
            const applicantIds = [...new Set(apps.map((a: any) => a.applicant_id))].slice(0, 20);

            // Single batch RPC call instead of N individual calls (scales to millions)
            const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
              p_applicant_ids: applicantIds,
              p_employer_id: user.id,
            });

            const paths = (batchMediaData || [])
              .map((row: any) => row.profile_image_url)
              .filter((p: any): p is string => typeof p === 'string' && p.trim() !== '');
            if (paths.length > 0) {
              await Promise.all(paths.map((p) => prefetchMediaUrl(p, 'profile-image').catch(() => {})));
            }
          }

          // 2. Prefetch my_candidates data för /my-candidates (så det känns instant)
          const { data: myCandidates } = await supabase
            .from('my_candidates')
            .select('*')
            .eq('recruiter_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(50);

          if (myCandidates && myCandidates.length > 0) {
            const applicationIds = myCandidates.map(mc => mc.application_id);
            const myCandApplicantIds = [...new Set(myCandidates.map(mc => mc.applicant_id))];

            // Fetch job applications data in background
            await supabase
              .from('job_applications')
              .select(`id, applicant_id, first_name, last_name, email, phone, location, bio,
                cv_url, age, employment_status, work_schedule, availability, custom_answers,
                status, applied_at, viewed_at, job_postings!inner(title)`)
              .in('id', applicationIds);

            // Fetch my_candidates avatars
            const { data: myCandMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
              p_applicant_ids: myCandApplicantIds,
              p_employer_id: user.id,
            });

            const myCandPaths = (myCandMediaData || [])
              .map((row: any) => row.profile_image_url)
              .filter((p: any): p is string => typeof p === 'string' && p.trim() !== '');
            if (myCandPaths.length > 0) {
              await Promise.all(myCandPaths.map((p) => prefetchMediaUrl(p, 'profile-image').catch(() => {})));
            }
          }
        } catch {
          // silent
        }
      })();
    }, 0);
  }, [user, userRole?.role, loading]);

  // Realtime-prenumerationer för räknare med tyst felhantering
  useEffect(() => {
    if (!user) return;

    // Track connection issues for silent error handling
    const connectionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const hasShownConnectionError = { current: false };
    const CONNECTION_ERROR_DELAY = 8000; // 8 seconds before showing error
    let reconnectionPollInterval: ReturnType<typeof setInterval> | null = null;

    // Start polling for reconnection after showing error toast
    const startReconnectionPolling = () => {
      if (reconnectionPollInterval) return; // Already polling
      
      reconnectionPollInterval = setInterval(() => {
        // Check if realtime connection is restored
        if (supabase.realtime.isConnected()) {
          // Connection restored!
        if (hasShownConnectionError.current) {
            hasShownConnectionError.current = false;
            // Silent reconnection - no toast notification
            // Re-sync data after reconnection
            refreshSidebarCounts();
            refreshEmployerStats();
          }
          // Stop polling
          if (reconnectionPollInterval) {
            clearInterval(reconnectionPollInterval);
            reconnectionPollInterval = null;
          }
        }
      }, 1000); // Check every second
    };

    const handleChannelStatus = (channelName: string, status: string) => {
      if (status === 'SUBSCRIBED') {
        // Clear any pending error timeout
        const timeout = connectionTimeouts.get(channelName);
        if (timeout) {
          clearTimeout(timeout);
          connectionTimeouts.delete(channelName);
        }
        
        // If we previously showed an error, show reconnection success
        if (hasShownConnectionError.current) {
          hasShownConnectionError.current = false;
          // Silent reconnection - no toast notification
          // Re-sync data after reconnection
          refreshSidebarCounts();
          refreshEmployerStats();
          // Stop polling since we confirmed reconnection
          if (reconnectionPollInterval) {
            clearInterval(reconnectionPollInterval);
            reconnectionPollInterval = null;
          }
        }
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        // Start a timeout - only show error if issue persists
        if (!connectionTimeouts.has(channelName)) {
          const timeout = setTimeout(() => {
            if (!hasShownConnectionError.current) {
              hasShownConnectionError.current = true;
              // Silent connection error - no toast notification
              // Start polling for reconnection
              startReconnectionPolling();
            }
            connectionTimeouts.delete(channelName);
          }, CONNECTION_ERROR_DELAY);
          connectionTimeouts.set(channelName, timeout);
        }
      }
    };

    const jobChannel = supabase
      .channel('auth-job-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_postings' },
        () => {
          refreshSidebarCounts();
          refreshEmployerStats();
        }
      )
      .subscribe((status) => handleChannelStatus('job', status));

    const savedChannel = supabase
      .channel(`auth-saved-jobs-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_jobs', filter: `user_id=eq.${user.id}` },
        () => {
          refreshSidebarCounts();
        }
      )
      .subscribe((status) => handleChannelStatus('saved', status));

    // Real-time för ansökningar (uppdaterar jobbsökarens räknare)
    const applicationsChannel = supabase
      .channel(`auth-applications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_applications', filter: `applicant_id=eq.${user.id}` },
        () => {
          refreshSidebarCounts();
        }
      )
      .subscribe((status) => handleChannelStatus('applications', status));

    // Real-time för alla job_applications (uppdaterar employer kandidat-badge)
    // Lyssnar på alla INSERT för att fånga nya ansökningar till arbetsgivarens jobb
    const employerApplicationsChannel = supabase
      .channel(`auth-employer-applications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_applications' },
        () => {
          refreshEmployerStats();
        }
      )
      .subscribe((status) => handleChannelStatus('employerApps', status));

    // Real-time för meddelanden (uppdaterar oläst-badge för både employer och jobbsökare)
    const messagesChannel = supabase
      .channel(`auth-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
        () => {
          refreshEmployerStats();
          refreshSidebarCounts();
        }
      )
      .subscribe((status) => handleChannelStatus('messages', status));

    // Real-time för company reviews (uppdaterar recensionsräknare för arbetsgivare)
    const reviewsChannel = supabase
      .channel(`auth-reviews-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'company_reviews', filter: `company_id=eq.${user.id}` },
        () => {
          refreshEmployerStats();
        }
      )
      .subscribe((status) => handleChannelStatus('reviews', status));

    // Real-time för my_candidates (uppdaterar "Mina kandidater" räknare i sidebaren)
    const myCandidatesChannel = supabase
      .channel(`auth-my-candidates-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'my_candidates', filter: `recruiter_id=eq.${user.id}` },
        () => {
          refreshEmployerStats();
        }
      )
      .subscribe((status) => handleChannelStatus('myCandidates', status));

    return () => {
      // Clear all pending timeouts
      connectionTimeouts.forEach((timeout) => clearTimeout(timeout));
      connectionTimeouts.clear();
      
      // Stop reconnection polling
      if (reconnectionPollInterval) {
        clearInterval(reconnectionPollInterval);
        reconnectionPollInterval = null;
      }
      
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(savedChannel);
      supabase.removeChannel(applicationsChannel);
      supabase.removeChannel(employerApplicationsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(myCandidatesChannel);
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
    preloadedEmployerDashboardJobs,
    preloadedEmployerTotalViews,
    preloadedEmployerTotalApplications,
    preloadedEmployerCandidates,
    preloadedUnreadMessages,
    preloadedJobSeekerUnreadMessages,
    preloadedCompanyReviewsCount,
    preloadedMyApplications,
    preloadedMyCandidates,
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

  // Track user activity for 24-hour inactivity timeout
  useInactivityTimeout(!!user);

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
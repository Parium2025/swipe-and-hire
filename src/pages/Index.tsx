import { useEffect, useState, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchSubscriptionPlans } from '@/lib/subscriptionPlansQuery';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import JobView from '@/pages/JobView';
// smartSearchCandidates is applied inside useApplicationsData — not needed here
import JobDetails from '@/pages/JobDetails';
import JobTemplatesOverview from '@/components/JobTemplatesOverview';
import CompanyReviews from '@/components/CompanyReviews';
import { useAuth } from '@/hooks/useAuth';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';
import { useIsPlatformAdmin } from '@/hooks/useIsPlatformAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import EmployerLayout from "@/components/EmployerLayout";
import JobSeekerLayout from "@/components/JobSeekerLayout";
import Dashboard from '@/components/Dashboard';
import EmployerDashboard from '@/components/EmployerDashboard';
import EmployerHome from '@/components/EmployerHome';
import JobSeekerHome from '@/components/JobSeekerHome';
// ProfileSetup removed - employers use EmployerWelcomeTunnel only
import ProfileSelector from '@/components/ProfileSelector';
import WelcomeTunnel from '@/components/WelcomeTunnel';
import { isTunnelReplayAccount, hasCompletedTunnelThisSession, markTunnelCompletedThisSession, isWelcomeCardReplayAccount, isEmployerWelcomeCardReplayAccount } from '@/lib/tunnelTestAccounts';

import ProfilePreview from '@/pages/ProfilePreview';
import EmployerWelcomeTunnel from '@/components/EmployerWelcomeTunnel';
import AppOnboardingTour, { WELCOME_CARD_REPLAY_EVENT } from '@/components/AppOnboardingTour';
import PageIntroCoach, { resetPageCoachMarks } from '@/components/onboarding/PageIntroCoach';
import EmployerOnboardingTour, { EMPLOYER_WELCOME_CARD_REPLAY_EVENT } from '@/components/EmployerOnboardingTour';
import EmployerPageIntroCoach, { resetEmployerPageCoachMarks } from '@/components/onboarding/EmployerPageIntroCoach';

import Profile from '@/pages/Profile';
import SearchJobs from '@/pages/SearchJobs';
import Subscription from '@/pages/Subscription';
import Billing from '@/pages/Billing';
import Support from '@/pages/Support';
import SavedJobs from '@/pages/SavedJobs';
import MyApplications from '@/pages/MyApplications';
import SupportAdmin from '@/pages/SupportAdmin';
import AiUsage from '@/pages/AiUsage';
import EmployerProfile from '@/pages/employer/EmployerProfile';
import CompanyProfile from '@/pages/employer/CompanyProfile';
import EmployerSettings from '@/pages/employer/EmployerSettings';
import DeveloperControls from '@/components/DeveloperControls';
import EmployerAnalytics from '@/components/EmployerAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft, Search } from 'lucide-react';


import KeepAlive from '@/components/KeepAlive';
import { useApplicationsData } from '@/hooks/useApplicationsData';
import { CandidatesTable } from '@/components/CandidatesTable';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TruncatedText } from '@/components/TruncatedText';
import MyCandidates from '@/pages/MyCandidates';
import Messages from '@/pages/Messages';
import RealtimeStatusPage from '@/components/RealtimeStatusPage';
import { QuestionFilter, QuestionFilterValue } from '@/components/QuestionFilter';
import { useDevice } from '@/hooks/use-device';
import { readCachedCount, writeCachedCount, SKELETON_COUNT_KEYS } from '@/lib/skeletonCounts';

// 🔥 Persistent-mount routes — these pages stay alive across navigation so that
// data + DOM is loaded once per session and re-visiting feels instant.
// Pages NOT listed here mount/unmount normally (e.g. JobDetails, ProfilePreview
// which depend on URL params, or rare pages where freshness matters more).
const EMPLOYER_KEEP_KEYS = [
  '/home',
  '/dashboard',
  '/my-jobs',
  '/candidates',
  '/my-candidates',
  '/messages',
  '/profile',
  '/employer-profile',
  '/company-profile',
  '/reviews',
  '/reports',
  '/billing',
  '/settings',
  '/support',
];
const JOB_SEEKER_KEEP_KEYS = [
  '/home',
  '/search-jobs',
  '/saved-jobs',
  '/my-applications',
  '/messages',
  '/profile',
  '/profile-preview',
  '/subscription',
  '/support',
];

const CandidatesContent = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [questionFilters, setQuestionFilters] = useState<QuestionFilterValue[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  // Debounce search: 300ms delay before hitting the database
  // Prevents spamming FTS queries on every keystroke (critical at 500k+ candidates)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sorteringen körs serversidigt så att den gäller hela kandidatlistan,
  // inte bara de sidor som redan hämtats.
  const [sortBy, setSortBy] = useState<'applied_at' | 'oldest' | 'name' | 'name_desc' | 'rating' | 'rating_asc' | 'last_active' | 'last_active_oldest'>('applied_at');

  const { 
    applications, 
    stats, 
    isLoading, 
    isFetching,
    error, 
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    hasReachedLimit,
    continueLoading,
    loadedCount,
    updateRating,
    totalCount,
    totalCountCapped,
  } = useApplicationsData(debouncedSearch, { questionFilters, sortBy });


  // Medan en ny sökning väntar/hämtas visar vi INTE ett nytt tomläge — annars
  // blinkar "Inga kandidater än" förbi när man rensar filter.
  const isSearchPending = searchQuery !== debouncedSearch;
  const isBusy = isSearchPending || (isFetching && !isFetchingNextPage);
  const stableSearchRef = useRef(debouncedSearch);
  if (!isBusy) stableSearchRef.current = debouncedSearch;
  const appliedSearch = stableSearchRef.current;


  
  // Instant render när datan redan finns i cache — fade-in bara vid cold load.
  const dataWasCached = useRef(!isLoading);
  const [showContent, setShowContent] = useState(() => !isLoading);
  useEffect(() => {
    if (!isLoading && !showContent) {
      if (dataWasCached.current) {
        setShowContent(true);
        return;
      }
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, showContent]);

  // Cacha antalet så skeletonen matchar verkligt innehåll nästa cold load.
  // Bara i ofiltrerad vy — annars sparas ett sökresultat som "antal kandidater".
  useEffect(() => {
    if (isLoading) return;
    if (debouncedSearch.trim() || questionFilters.length > 0) return;
    writeCachedCount(SKELETON_COUNT_KEYS.allCandidates, (applications || []).length);
  }, [isLoading, applications, debouncedSearch, questionFilters]);


  // Safety check to prevent null crash
  const safeApplications = applications || [];

  // Sökning, frågefilter, statusfilter och sortering körs numera i databasen
  // (RPC: search_employer_candidates). Ingen klientsidig filtrering här — det är
  // det som gjorde räknarna missvisande så fort listan blev större än laddade sidor.
  const filteredApplications = safeApplications;

  const filteredStats = useMemo(() => ({
    total: totalCount,
    new: stats.new,
    reviewing: stats.reviewing,
    hired: stats.hired,
    rejected: stats.rejected,
  }), [totalCount, stats]);

  // Frys räknaren medan en ny sökning hämtas så siffran inte hoppar till 0.
  const lastTotalRef = useRef(totalCount);
  if (!isBusy) lastTotalRef.current = totalCount;
  const displayTotal = isBusy ? lastTotalRef.current : filteredStats.total;
  // Ärlig räknare: exakt upp till taket, därefter "10 000+".
  const displayTotalLabel = `${displayTotal.toLocaleString('sv-SE')}${totalCountCapped ? '+' : ''}`;





  if (isLoading || !showContent) {
    const skeletonRows = readCachedCount(SKELETON_COUNT_KEYS.allCandidates, 5, 8);
    return (
      <div className="responsive-container-wide">
        <div className="space-y-4">
          <div className="text-center mb-6 space-y-2">
            <Skeleton className="h-7 w-56 mx-auto bg-white/10" />
            <Skeleton className="h-4 w-80 max-w-full mx-auto bg-white/10" />
          </div>
          <div className="mb-6 space-y-3">
            <Skeleton className="h-11 w-full rounded-xl bg-white/10" />
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-9 w-40 rounded-full bg-white/10" />
              <Skeleton className="h-9 w-36 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <Skeleton className="h-12 w-12 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <Skeleton className="h-4 w-40 max-w-full bg-white/10" />
                  <Skeleton className="h-3 w-24 bg-white/10" />
                  <Skeleton className="h-3 w-56 max-w-full bg-white/10" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full bg-white/10 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }


  return (
     <div className="responsive-container-wide animate-fade-in">
      {/* Main Content */}
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
            Alla kandidater ({isLoading ? '...' : displayTotalLabel})
          </h1>
          <p className="text-sm text-white mt-1">
            Hantera och granska kandidater som sökt till dina jobbannonser
          </p>
        </div>

        {/* Search Bar + Question Filter — alltid monterad så fokus aldrig tappas */}
        <div className="mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
              <Input
                type="text"
                placeholder="Sök på namn, email, telefon, plats, jobb..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="dashboard-control-compact pl-11 pr-4 text-base font-medium bg-white/5 border-white/20 hover:border-white/50 text-white placeholder:text-white/90 placeholder:font-normal transition-colors"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <QuestionFilter 
                  value={questionFilters}
                  onChange={setQuestionFilters}
                  hideChips
                />
                <button
                  onClick={() => setSelectionMode(prev => !prev)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`
                    flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
                    border whitespace-nowrap min-w-0 flex-shrink-0 active:scale-[0.97] touch-manipulation outline-none focus:outline-none
                    ${selectionMode 
                      ? 'bg-white/20 border-white/30 text-white' 
                      : 'bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/50'
                    }
                  `}
                >
                  {selectionMode ? (
                    <span>Avsluta urval</span>
                  ) : (
                    <span>Välj kandidater</span>
                  )}
                </button>
              </div>
              {/* Filter chips below */}
              {questionFilters.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <QuestionFilter 
                    value={questionFilters}
                    onChange={setQuestionFilters}
                    chipsOnly
                  />
                </div>
              )}
            </div>

          </div>


        {error ? (
          <div className="text-center py-12 text-destructive">
            Något gick fel vid hämtning av kandidater
          </div>
        ) : safeApplications.length === 0 && isLoading ? (
          <Card className="bg-white/5 border-white/10 hover:border-white/50">
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-8 w-full bg-white/10" />
                <Skeleton className="h-8 w-full bg-white/10" />
                <Skeleton className="h-8 w-full bg-white/10" />
                <Skeleton className="h-8 w-3/4 bg-white/10" />
              </div>
            </CardContent>
          </Card>
        ) : safeApplications.length === 0 && !questionFilters.length && !appliedSearch.trim() && !isBusy ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-white text-center">
              Inga kandidater än.<br />
              När någon söker till dina jobb så kommer deras ansökning att visas här.
            </p>
          </div>
        ) : filteredApplications.length === 0 && isBusy && !appliedSearch.trim() && !questionFilters.length ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <Skeleton className="h-12 w-12 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <Skeleton className="h-4 w-40 max-w-full bg-white/10" />
                  <Skeleton className="h-3 w-24 bg-white/10" />
                  <Skeleton className="h-3 w-56 max-w-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
              <Search className="h-5 w-5 text-white" />
            </div>
            <p className="text-white font-medium text-base">Inga kandidater hittades</p>
            <p className="text-white text-sm mt-1 text-center max-w-xs">
              {appliedSearch.trim() 
                ? 'Försök med ett annat sökord eller kontrollera stavningen'
                : 'Prova att ändra eller ta bort några filter'}
            </p>
            {(searchQuery.trim() || questionFilters.length > 0) && (
              <Button
                variant="glass"

                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setQuestionFilters([]);
                }}
                className="mt-3 text-xs"
              >
                Rensa filter
                <ArrowRightLeft size={14} />
              </Button>
            )}
          </div>
        ) : (
          <CandidatesTable 
            applications={filteredApplications} 
            onUpdate={refetch}
            onLoadMore={fetchNextPage}
            hasMore={hasNextPage}
            isLoadingMore={isFetchingNextPage}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            hasReachedLimit={hasReachedLimit}
            onContinueLoading={continueLoading}
            loadedCount={loadedCount}
            onRatingUpdate={(applicantId, rating) => updateRating.mutate({ applicantId, rating })}
            onServerSortChange={setSortBy}

          />
        )}
      </div>
    </div>
  );
};

// Guiden ("Hjälp & tips") markeras som klar per konto, inte per webbläsare.
const introTourKey = (userId: string) => `parium_intro_tour_done:${userId}`;
const employerIntroTourKey = (userId: string) => `parium_emp_intro_tour_done:${userId}`;

const Index = () => {
  const { user, profile, userRole, signOut, loading, authAction, switchRole } = useAuth();
  const { isAdmin: isOrgAdmin } = useIsOrgAdmin();
  const { isPlatformAdmin, loading: platformAdminLoading } = useIsPlatformAdmin();

  // Förhämta prenumerationsplanerna i bakgrunden så /valj-plan aldrig visar skelett.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user) return;
    prefetchSubscriptionPlans(queryClient);
  }, [user, queryClient]);

  const [switching, setSwitching] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [developerView, setDeveloperView] = useState<string>('dashboard');
  const [showIntroTutorial, setShowIntroTutorial] = useState(false);
  const [showEmployerIntroTutorial, setShowEmployerIntroTutorial] = useState(false);


  // Testkonto: landa alltid på välkomstkortet (profilen sparas helt normalt).
  useEffect(() => {
    if (!user?.email) return;
    if (!isWelcomeCardReplayAccount(user.email)) return;
    if ((profile as any)?.role !== 'job_seeker') return;
    if (!(profile as any)?.onboarding_completed) return;
    resetPageCoachMarks();
    setShowIntroTutorial(true);
  }, [user?.email, (profile as any)?.role, (profile as any)?.onboarding_completed]);


  // Första inloggningen som jobbsökande: välkomstkortet ("Hjälp & tips") ska
  // alltid dyka upp när profilen är klar — oavsett vilken enhet tunneln
  // slutfördes på. Flaggan ligger i molnet (per konto), localStorage används
  // bara som snabb cache så kortet inte blinkar fram två gånger.
  const introTourHandledRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if ((profile as any)?.role !== 'job_seeker') return;
    if ((profile as any)?.onboarding_completed !== true) return;
    if (introTourHandledRef.current) return;
    let cancelled = false;
    try {
      if (localStorage.getItem(introTourKey(user.id))) {
        introTourHandledRef.current = true;
        return;
      }
    } catch { /* ignorera */ }
    import('@/lib/onboardingState').then(async ({ isIntroTourDone }) => {
      const done = await isIntroTourDone().catch(() => false);
      if (cancelled || introTourHandledRef.current) return;
      introTourHandledRef.current = true;
      if (done) {
        try { localStorage.setItem(introTourKey(user.id), '1'); } catch { /* ignorera */ }
        return;
      }
      setShowIntroTutorial(true);
    });
    return () => { cancelled = true; };
  }, [user, (profile as any)?.role, (profile as any)?.onboarding_completed]);


  // Testkonto (arbetsgivare): landa alltid på arbetsgivarens välkomstkort.
  useEffect(() => {
    if (!user?.email) return;
    if (!isEmployerWelcomeCardReplayAccount(user.email)) return;
    if ((profile as any)?.role !== 'employer') return;
    if (!(profile as any)?.onboarding_completed) return;
    resetEmployerPageCoachMarks();
    setShowEmployerIntroTutorial(true);
  }, [user?.email, (profile as any)?.role, (profile as any)?.onboarding_completed]);


  // Första inloggningen som arbetsgivare: samma välkomstkort som på
  // jobbsökarsidan, fast med arbetsgivarinnehåll. Flaggan ligger i molnet.
  const employerIntroTourHandledRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if ((profile as any)?.role !== 'employer') return;
    if ((profile as any)?.onboarding_completed !== true) return;
    if (isEmployerWelcomeCardReplayAccount(user.email)) return;
    if (employerIntroTourHandledRef.current) return;
    let cancelled = false;
    try {
      if (localStorage.getItem(employerIntroTourKey(user.id))) {
        employerIntroTourHandledRef.current = true;
        return;
      }
    } catch { /* ignorera */ }
    import('@/lib/onboardingState').then(async ({ isEmployerIntroTourDone }) => {
      const done = await isEmployerIntroTourDone().catch(() => false);
      if (cancelled || employerIntroTourHandledRef.current) return;
      employerIntroTourHandledRef.current = true;
      if (done) {
        try { localStorage.setItem(employerIntroTourKey(user.id), '1'); } catch { /* ignorera */ }
        return;
      }
      setShowEmployerIntroTutorial(true);
    });
    return () => { cancelled = true; };
  }, [user, (profile as any)?.role, (profile as any)?.onboarding_completed]);


  // Support → "Hjälp & tips" öppnar hela välkomstkortet igen.
  const [introTourStep, setIntroTourStep] = useState<0 | 1>(0);
  useEffect(() => {
    const onReplay = (e: Event) => {
      const step = (e as CustomEvent<{ step?: 0 | 1 }>).detail?.step ?? 0;
      setIntroTourStep(step);
      setShowIntroTutorial(true);
    };
    window.addEventListener(WELCOME_CARD_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(WELCOME_CARD_REPLAY_EVENT, onReplay);
  }, []);

  const [employerIntroTourStep, setEmployerIntroTourStep] = useState<0 | 1>(0);
  useEffect(() => {
    const onReplay = (e: Event) => {
      const step = (e as CustomEvent<{ step?: 0 | 1 }>).detail?.step ?? 0;
      setEmployerIntroTourStep(step);
      setShowEmployerIntroTutorial(true);
    };
    window.addEventListener(EMPLOYER_WELCOME_CARD_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(EMPLOYER_WELCOME_CARD_REPLAY_EVENT, onReplay);
  }, []);


  const [isInitializing, setIsInitializing] = useState(false);
  const [uiReady, setUiReady] = useState(false);
  const [showAuthCTA, setShowAuthCTA] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const device = useDevice();
  const routeEnterDelayMs = device === 'desktop' ? 0 : 140;

  // JobView overlay-stöd: när användaren navigerar till /job-view/:id ska
  // den underliggande KeepAlive-vyn (SearchJobs/SavedJobs/etc) stå kvar
  // monterad och JobView renderas som fixed overlay ovanpå. Vi spårar
  // senaste sidebar-path så KeepAlive får rätt activeKey och inte byter vy.
  const isJobViewOverlay =
    location.pathname.startsWith('/job-view/') ||
    location.pathname.startsWith('/job/');
  const lastJobSeekerPathRef = useRef<string>('/search-jobs');
  const lastEmployerPathRef = useRef<string>('/home');
  
  // Borttagen aggressiv fallback till /auth som skapade loopar
  // Vi navigerar nu endast när auth-loading är klar (se effekten nedan)


  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // User exists but profile not loaded yet -> keep waiting with gradient background
    if (user && !profile) {
      return;
    }

    // Both user AND profile loaded -> redirect based on role when on root path
    if (user && profile && location.pathname === '/') {
      // Alla roller landar på /home
      navigate('/home', { replace: true });
      setIsInitializing(false);
      return;
    }

    // Profilväljaren visas inte längre automatiskt — admins växlar roll via Utvecklarvy-knappen i toppnavigationen
    setIsInitializing(false);
  }, [user, loading, navigate, profile, location.pathname]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setUiReady(true));
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // Vid logout/inloggning hanteras övergången av AuthSplashScreen - visa bara bakgrund
  if (loading && !user && authAction !== 'logout') {
    return <div className="min-h-screen bg-gradient-parium" />;
  }

  // Om ingen användare: redirecta omedelbart till /auth (säkerhetsnät för mobil)
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Vänta på profil men visa bakgrund
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-parium smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }} />
    );
  }

  const ownerOnlyRoutes = ['/admin', '/status', '/ai-usage'];
  if (platformAdminLoading && ownerOnlyRoutes.includes(location.pathname)) {
    return <div className="min-h-screen bg-gradient-parium smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }} />;
  }

  if (location.pathname === '/') {
    if ((userRole?.role as string) === 'employer') {
      return <Navigate to="/home" replace />;
    } else {
      return <Navigate to="/search-jobs" replace />;
    }
  }

  // Show profile selector first (admin only)
  // Show profile selector for admins (database-based check)
  if (showProfileSelector && isPlatformAdmin) {
    return <ProfileSelector onProfileSelected={() => setShowProfileSelector(false)} />;
  }

  // Check if user needs to complete onboarding
  // Testkonton (t.ex. axelanderssonparium@gmail.com) kör tunneln på nytt varje inloggning.
  const tunnelReplay = isTunnelReplayAccount(user?.email);
  const needsOnboarding = tunnelReplay
    ? !hasCompletedTunnelThisSession()
    : !profile?.onboarding_completed;

  
  // Developer overrides for admin users (database-based check)
  if (isPlatformAdmin) {
    // Support "welcome_tunnel:<step>" / "employer_welcome_tunnel:<step>" syntax
    // so admins can jump directly to a specific step from DeveloperControls.
    const [devViewName, devStepRaw] = (developerView || '').split(':');
    const devStep = devStepRaw !== undefined ? parseInt(devStepRaw, 10) : undefined;

    if (devViewName === 'welcome_tunnel') {
      return (
        <WelcomeTunnel
          initialStep={Number.isFinite(devStep) ? devStep : undefined}
          previewMode
          onComplete={() => setDeveloperView('dashboard')}
        />
      );
    }
    if (devViewName === 'employer_welcome_tunnel') {
      return (
        <EmployerWelcomeTunnel
          initialStep={Number.isFinite(devStep) ? devStep : undefined}
          previewMode
          onComplete={() => setDeveloperView('dashboard')}
        />
      );
    }
    if (developerView === 'intro_tutorial') {
      setShowIntroTutorial(true);
      setDeveloperView('dashboard');
    }
  }
  
  // For job seekers, show WelcomeTunnel if onboarding not completed
  if (needsOnboarding && (profile as any)?.role === 'job_seeker') {
    return <WelcomeTunnel onComplete={async () => {
      // WelcomeTunnel persists onboarding_completed before calling onComplete.
      if (tunnelReplay) {
        markTunnelCompletedThisSession();
      }


      // 1) Jobb-intent (kom från /annons/:id som utloggad → "Ansök") går först
      try {
        const { consumePendingJobPath } = await import('@/lib/pendingJobIntent');
        const jobPath = consumePendingJobPath();
        if (jobPath) { navigate(jobPath); return; }
      } catch { /* fortsätt */ }

      // 2) Sök-intent från SEO-sidor (yrke/stad) → skapa saved_search + gå till returnTo
      try {
        const { readIntent, consumeIntent, applyIntentToSearchFilters } = await import('@/lib/savedSearchIntent');
        const intent = readIntent();
        if (intent?.returnTo && intent.returnTo.startsWith('/')) {
          // Applicera filter SYNKRONT så /search-jobs ser dem direkt.
          applyIntentToSearchFilters(intent);
          consumeIntent(user.id).catch(() => {});
          navigate(intent.returnTo);
          return;
        }
      } catch { /* fortsätt */ }

      // 3) Standard: gå till sök + visa introrundturen första gången
      try {
        if (!localStorage.getItem(introTourKey(user.id))) {
          setShowIntroTutorial(true);
        }
      } catch { /* ignorera */ }
      navigate('/search-jobs');
    }} />;
  }


  // For employers, show EmployerWelcomeTunnel if onboarding not completed
  if (needsOnboarding && (profile as any)?.role === 'employer') {
    return <EmployerWelcomeTunnel onComplete={async () => {
      // EmployerWelcomeTunnel persists onboarding_completed before calling onComplete.
      if (tunnelReplay) {
        markTunnelCompletedThisSession();
      }

      // Visa arbetsgivarens välkomstkort direkt efter tunneln (första gången).
      try {
        if (!localStorage.getItem(employerIntroTourKey(user.id))) {
          setShowEmployerIntroTutorial(true);
        }
      } catch { /* ignorera */ }

      // Navigate to home
      navigate('/home');
    }} />;
  }

  // Show app intro tutorial after onboarding
  const showTourOverlay = showIntroTutorial;
  const finishIntroTour = () => {
    try { localStorage.setItem(introTourKey(user.id), '1'); } catch { /* ignorera */ }
    import('@/lib/onboardingState').then(({ markIntroTourDone }) => markIntroTourDone().catch(() => {}));
    setShowIntroTutorial(false);
  };

  const showEmployerTourOverlay = showEmployerIntroTutorial;
  const finishEmployerIntroTour = () => {
    try { localStorage.setItem(employerIntroTourKey(user.id), '1'); } catch { /* ignorera */ }
    import('@/lib/onboardingState').then(({ markEmployerIntroTourDone }) => markEmployerIntroTourDone().catch(() => {}));
    setShowEmployerIntroTutorial(false);
  };


  
  // Resolve role from profile first to avoid flicker
  const role = (profile as any)?.role || (userRole?.role as string) || '';

  // While role is resolving, keep seamless background
  if (user && profile && !role) {
    return <div className="min-h-screen bg-gradient-parium smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }} />;
  }
  
  // Org-admin styr företagsbehörigheter; plattformsadmin styr Parium-ägarytor.

  // Job seekers should never land on employer-only routes. If they do (via a
  // stale link, back-navigation efter rollbyte, eller en tabb som glömt bort
  // rollen), skicka dem till /home istället för att falla igenom till den
  // gamla fallback-vyn längst ner i filen.
  const employerOnlyRoutes = ['/my-jobs', '/dashboard', '/candidates', '/my-candidates', '/company-profile', '/reviews', '/reports', '/employer-profile', '/templates'];
  if (
    role !== 'employer' &&
    employerOnlyRoutes.some((r) => location.pathname === r || location.pathname.startsWith(r + '/'))
  ) {
    return <Navigate to="/home" replace />;
  }

  // Render sidebar layout for profile pages and employer routes
  const sidebarRoutes = ['/home', '/index', '/profile', '/profile-preview', '/search-jobs', '/saved-jobs', '/my-applications', '/messages', '/subscription', '/billing', '/payment', '/support', '/settings', '/admin', '/status', '/ai-usage', '/templates'];
  const isSidebarRoute = sidebarRoutes.some(route => location.pathname.startsWith(route));
  // Behåll senaste sidebar-path så JobView-overlay vet vilken vy som
  // ska visas underst (utan att KeepAlive byter activeKey och fadar).
  // Inkludera även employer-keep-routes (t.ex. /my-jobs, /dashboard, /candidates)
  // så tillbaka från preview-overlay återgår smooth till exakt samma vy.
  const isEmployerKeepRoute = EMPLOYER_KEEP_KEYS.some(
    (r) => location.pathname === r || location.pathname.startsWith(r + '/')
  );
  const isJobSeekerKeepRoute = JOB_SEEKER_KEEP_KEYS.some(
    (r) => location.pathname === r || location.pathname.startsWith(r + '/')
  );
  if (isSidebarRoute || isEmployerKeepRoute || isJobSeekerKeepRoute) {
    if (role === 'employer' && (isSidebarRoute || isEmployerKeepRoute)) {
      lastEmployerPathRef.current = location.pathname;
    } else if (role !== 'employer' && (isSidebarRoute || isJobSeekerKeepRoute)) {
      lastJobSeekerPathRef.current = location.pathname;
    }
  }
  // Behandla /job-view/:id som "fortsatt på senaste sidebar-vy + overlay".
  const treatAsSidebar = isSidebarRoute || isJobViewOverlay;

  if (treatAsSidebar && role !== 'employer') {
    // Redirect job seekers from employer routes
    if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/company-profile')) {
      return <Navigate to="/search-jobs" replace />;
    }
    const activeKeepKey = isJobViewOverlay ? lastJobSeekerPathRef.current : location.pathname;

    const renderSidebarContent = (path: string) => {
      switch (path) {
        case '/home':
          return <JobSeekerHome />;
        case '/index':
          return <SearchJobs />;
        case '/profile':
          return <Profile />;
        case '/profile-preview':
          return <ProfilePreview />;
        case '/search-jobs':
          return <SearchJobs />;
        case '/saved-jobs':
          return <SavedJobs />;
        case '/my-applications':
          return <MyApplications />;
        case '/messages':
          return <Messages />;
        case '/subscription':
          return <Subscription />;
        case '/billing':
          return <Billing />;
        case '/support':
          return <Support />;
        case '/admin':
          // Endast Fredrik kan komma åt admin-sidan
          if (isPlatformAdmin) {
            return <SupportAdmin />;
          } else {
            navigate('/support');
            return <Support />;
          }
        case '/status':
          if (isPlatformAdmin) {
            return <RealtimeStatusPage />;
          } else {
            navigate('/support');
            return <Support />;
          }
        case '/ai-usage':
          if (isPlatformAdmin) {
            return <AiUsage />;
          } else {
            navigate('/support');
            return <Support />;
          }
        default:
          return <JobSeekerHome />;
      }
    };

    return (
      <JobSeekerLayout
        developerView={developerView}
        onViewChange={setDeveloperView}
        overlay={isJobViewOverlay ? <JobView asOverlay /> : undefined}
      >
        <KeepAlive
          activeKey={activeKeepKey}
          render={(key) => renderSidebarContent(key)}
          keepKeys={JOB_SEEKER_KEEP_KEYS}
          enterDelayMs={routeEnterDelayMs}
        />
        {showTourOverlay ? (
          <AppOnboardingTour onComplete={finishIntroTour} firstName={(profile as any)?.first_name} initialStep={introTourStep} />
        ) : (
          <PageIntroCoach />
        )}
      </JobSeekerLayout>
    );
  }

  // Show employer dashboard with sidebar for employers
  if (role === 'employer' || (isJobViewOverlay && role === 'employer')) {
    // Redirect employer from job seeker routes
    if (location.pathname === '/search-jobs') {
      return <Navigate to="/home" replace />;
    }

    const renderEmployerContent = (path: string) => {
      // Handle job details route with dynamic ID
      if (path.startsWith('/job-details/')) {
        return <JobDetails />;
      }
      
      switch (path) {
        case '/home':
          return <EmployerHome />;
        case '/dashboard':
          return <Dashboard />;
        case '/my-jobs':
          return <EmployerDashboard />;
        case '/candidates':
          return <CandidatesContent />;
        case '/my-candidates':
          return <MyCandidates />;
        case '/messages':
          return <Messages />;
        case '/profile':
        case '/employer-profile':
          return <EmployerProfile />;
        case '/company-profile':
          return <CompanyProfile />;
        case '/reviews':
          return <CompanyReviews />;
        case '/templates':
          return <JobTemplatesOverview />;
        case '/settings':
          return <EmployerSettings />;
        case '/reports':
          return <EmployerAnalytics />;
        case '/billing':
          return <Billing />;
        case '/support':
          return <Support />;
        case '/admin':
          if (isPlatformAdmin) {
            return <SupportAdmin />;
          } else {
            navigate('/support');
            return <Support />;
          }
        case '/status':
          if (isPlatformAdmin) {
            return <RealtimeStatusPage />;
          } else {
            navigate('/support');
            return <Support />;
          }
        case '/ai-usage':
          if (isPlatformAdmin) {
            return <AiUsage />;
          } else {
            navigate('/support');
            return <Support />;
          }
        default:
          return <EmployerHome />;
      }
    };

    const employerKeepKey = isJobViewOverlay ? lastEmployerPathRef.current : location.pathname;
    return (
      <EmployerLayout
        developerView={developerView}
        onViewChange={setDeveloperView}
        isOrgAdmin={isOrgAdmin}
        overlay={isJobViewOverlay ? <JobView asOverlay /> : undefined}
      >
        <KeepAlive
          activeKey={employerKeepKey}
          render={(key) => renderEmployerContent(key)}
          keepKeys={EMPLOYER_KEEP_KEYS}
          enterDelayMs={routeEnterDelayMs}
        />
        {showEmployerTourOverlay ? (
          <EmployerOnboardingTour
            onComplete={finishEmployerIntroTour}
            firstName={(profile as any)?.first_name}
            initialStep={employerIntroTourStep}
          />
        ) : (
          <EmployerPageIntroCoach />
        )}
      </EmployerLayout>

    );
  }

  // Safety net: any unmatched route redirects to the role-appropriate home page.
  // This prevents any accidental fall-through between job seeker and employer views.
  return <Navigate to={role === 'employer' ? '/home' : '/search-jobs'} replace />;
};

export default Index;
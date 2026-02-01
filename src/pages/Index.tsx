import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { smartSearchCandidates } from '@/lib/smartSearch';
import JobDetails from '@/pages/JobDetails';
import JobTemplatesOverview from '@/components/JobTemplatesOverview';
import CompanyReviews from '@/components/CompanyReviews';
import { useAuth } from '@/hooks/useAuth';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';
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
import JobSwipe from '@/components/JobSwipe';
// ProfileSetup removed - employers use EmployerWelcomeTunnel only
import ProfileSelector from '@/components/ProfileSelector';
import WelcomeTunnel from '@/components/WelcomeTunnel';
import ProfilePreview from '@/pages/ProfilePreview';
import EmployerWelcomeTunnel from '@/components/EmployerWelcomeTunnel';
import AppOnboardingTour from '@/components/AppOnboardingTour';
import Profile from '@/pages/Profile';
import Consent from '@/pages/Consent';
import SearchJobs from '@/pages/SearchJobs';
import Subscription from '@/pages/Subscription';
import Billing from '@/pages/Billing';
import Support from '@/pages/Support';
import SavedJobs from '@/pages/SavedJobs';
import MyApplications from '@/pages/MyApplications';
import SupportAdmin from '@/pages/SupportAdmin';
import EmployerProfile from '@/pages/employer/EmployerProfile';
import CompanyProfile from '@/pages/employer/CompanyProfile';
import EmployerSettings from '@/pages/employer/EmployerSettings';
import DeveloperControls from '@/components/DeveloperControls';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft, Search, Loader2, CheckSquare, X } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import KeepAlive from '@/components/KeepAlive';
import { useApplicationsData } from '@/hooks/useApplicationsData';
import { CandidatesTable } from '@/components/CandidatesTable';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TruncatedText } from '@/components/TruncatedText';
import MyCandidates from '@/pages/MyCandidates';
import Messages from '@/pages/Messages';
import JobSeekerMessages from '@/pages/JobSeekerMessages';
import { QuestionFilter, QuestionFilterValue } from '@/components/QuestionFilter';
import { showAuthSplash } from '@/lib/authSplashEvents';

const CandidatesContent = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [questionFilters, setQuestionFilters] = useState<QuestionFilterValue[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const { 
    applications, 
    stats, 
    isLoading, 
    error, 
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    hasReachedLimit,
    continueLoading,
    loadedCount,
  } = useApplicationsData(searchQuery);
  
  // Minimum delay for smooth fade-in animation (prevents jarring instant appearance when cached)
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Safety check to prevent null crash
  const safeApplications = applications || [];

  // Filter applications by question filters AND smart search (client-side)
  const filteredApplications = useMemo(() => {
    let result = safeApplications;
    
    // Apply smart search filter first (strict client-side filtering)
    // This ensures gibberish queries show 0 results even if server returns cached data
    if (searchQuery && searchQuery.trim().length >= 2) {
      result = smartSearchCandidates(result, searchQuery);
    }
    
    // Then apply question filters
    if (questionFilters.length === 0) return result;

    return result.filter(app => {
      const customAnswers = app.custom_answers || {};
      
      // All filters must match
      return questionFilters.every(filter => {
        // Check if any key in custom_answers contains the question text (partial match)
        const matchingKey = Object.keys(customAnswers).find(key => 
          key.toLowerCase().includes(filter.question.toLowerCase()) ||
          filter.question.toLowerCase().includes(key.toLowerCase())
        );

        if (!matchingKey) return false;

        const answer = customAnswers[matchingKey];

        // If filter.answers is empty, just check that they answered the question (Alla)
        if (filter.answers.length === 0) {
          return answer !== undefined && answer !== null && answer !== '';
        }

        // Match any of the selected answers (multi-select OR logic)
        const normalizedAnswer = typeof answer === 'string' 
          ? answer.toLowerCase() 
          : typeof answer === 'boolean'
            ? (answer ? 'ja' : 'nej')
            : String(answer).toLowerCase();

        return filter.answers.some(selectedAnswer => 
          normalizedAnswer === selectedAnswer.toLowerCase() ||
          (typeof answer === 'boolean' && (
            (answer && selectedAnswer.toLowerCase() === 'ja') ||
            (!answer && selectedAnswer.toLowerCase() === 'nej')
          ))
        );
      });
    });
  }, [safeApplications, questionFilters, searchQuery]);

  // Recalculate stats based on filtered results
  const filteredStats = useMemo(() => ({
    total: filteredApplications.length,
    new: filteredApplications.filter(app => app.status === 'pending').length,
    reviewing: filteredApplications.filter(app => app.status === 'reviewing').length,
    hired: filteredApplications.filter(app => app.status === 'hired').length,
    rejected: filteredApplications.filter(app => app.status === 'rejected').length,
  }), [filteredApplications]);

  if (isLoading || !showContent) {
    return (
      <div className="max-w-6xl mx-auto px-3 md:px-12 opacity-0">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-12 animate-fade-in">
      {/* Main Content */}
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
            Alla kandidater ({isLoading ? '...' : filteredStats.total})
          </h1>
          <p className="text-sm text-white mt-1">
            Hantera och granska kandidater som sökt till dina jobbannonser
          </p>
        </div>

        {/* Search Bar + Question Filter */}
        {!isLoading && (
          <div className="mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
              <Input
                type="text"
                placeholder="Sök på namn, email, telefon, plats, jobb..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/20 hover:border-white/50 text-white placeholder:text-white transition-colors"
              />
            </div>
            <div className="flex items-center gap-1">
              <QuestionFilter 
                value={questionFilters}
                onChange={setQuestionFilters}
              />
              <button
                onClick={() => setSelectionMode(prev => !prev)}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${selectionMode 
                    ? 'bg-white/20 text-white' 
                    : 'text-white hover:bg-white/10'
                  }
                `}
              >
                {selectionMode ? (
                  <>
                    <X className="h-4 w-4" />
                    <span>Avsluta urval</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    <span>Välj kandidater</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

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
        ) : safeApplications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-white text-center">
              Inga kandidater än.<br />
              När någon söker till dina jobb så kommer deras ansökning att visas här.
            </p>
          </div>
        ) : filteredApplications.length === 0 && (questionFilters.length > 0 || searchQuery.trim()) ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
              <Search className="h-5 w-5 text-white" />
            </div>
            <p className="text-white font-medium text-base">Inga kandidater hittades</p>
            <p className="text-white text-sm mt-1 text-center max-w-xs">
              {searchQuery.trim() 
                ? 'Försök med ett annat sökord eller kontrollera stavningen'
                : 'Prova att ändra eller ta bort några filter'}
            </p>
            {(searchQuery.trim() || questionFilters.length > 0) && (
              <Button
                variant="glass"
                onClick={() => {
                  setSearchQuery('');
                  setQuestionFilters([]);
                }}
                className="mt-4"
              >
                Rensa filter
                <ArrowRightLeft size={16} />
              </Button>
            )}
          </div>
        ) : (
          <CandidatesTable 
            applications={filteredApplications} 
            onUpdate={refetch}
            onLoadMore={fetchNextPage}
            hasMore={hasNextPage && questionFilters.length === 0}
            isLoadingMore={isFetchingNextPage}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            hasReachedLimit={hasReachedLimit}
            onContinueLoading={continueLoading}
            loadedCount={loadedCount}
          />
        )}
      </div>
    </div>
  );
};

const Index = () => {
  const { user, profile, userRole, signOut, loading, authAction, switchRole } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsOrgAdmin();
  const [switching, setSwitching] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [developerView, setDeveloperView] = useState<string>('dashboard');
  const [showIntroTutorial, setShowIntroTutorial] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [uiReady, setUiReady] = useState(false);
  const [showAuthCTA, setShowAuthCTA] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
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

    // Show profile selector only for admin
    if (user && profile &&
        !location.pathname.startsWith('/profile') && 
        !location.pathname.startsWith('/search-jobs') && 
        !location.pathname.startsWith('/dashboard') && 
        !location.pathname.startsWith('/company-profile') && 
        !location.pathname.startsWith('/subscription') && 
        !location.pathname.startsWith('/support') && 
        !location.pathname.startsWith('/settings') && 
        !location.pathname.startsWith('/billing') && 
        !location.pathname.startsWith('/payment') && 
        !location.pathname.startsWith('/consent')) {
      if (user.email === 'fredrikandits@hotmail.com') {
        setShowProfileSelector(true);
      }
    }
    
    setIsInitializing(false);
  }, [user, loading, navigate, profile, location.pathname]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setUiReady(true));
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // If the user loses session while inside the app, show the branded shell BEFORE redirecting to /auth.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      showAuthSplash();
      requestAnimationFrame(() => navigate('/auth', { replace: true }));
    }
  }, [loading, user, navigate]);

  if ((loading && !user) || (authAction === 'logout' && loading)) {
    return (
      <div className="min-h-screen bg-gradient-parium flex items-center justify-center animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-white text-sm">
            {authAction === 'logout' ? 'Loggar ut...' : 'Loggar in...'}
          </p>
        </div>
      </div>
    );
  }

  // Om ingen användare: redirecta omedelbart till /auth (säkerhetsnät för mobil)
  if (!user) {
    // Keep a stable background while the splash + navigation takes over
    return <div className="min-h-screen bg-gradient-parium" aria-hidden="true" />;
  }

  // Vänta på profil men visa bakgrund
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-parium smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }} />
    );
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
  if (showProfileSelector && isAdmin) {
    return <ProfileSelector onProfileSelected={() => setShowProfileSelector(false)} />;
  }

  // Check if user needs to complete onboarding
  const needsOnboarding = !profile?.onboarding_completed;
  
  // Developer overrides for admin users (database-based check)
  if (isAdmin) {
    if (developerView === 'welcome_tunnel') {
      return <WelcomeTunnel onComplete={() => setDeveloperView('dashboard')} />;
    }
    if (developerView === 'employer_welcome_tunnel') {
      return <EmployerWelcomeTunnel onComplete={() => setDeveloperView('dashboard')} />;
    }
    if (developerView === 'intro_tutorial') {
      setShowIntroTutorial(true);
      setDeveloperView('dashboard');
    }
  }
  
  // For job seekers, show WelcomeTunnel if onboarding not completed
  if (needsOnboarding && (profile as any)?.role === 'job_seeker') {
    return <WelcomeTunnel onComplete={async () => {
      // Mark onboarding as completed in background
      supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      
      // Navigate to search jobs page
      navigate('/search-jobs');
    }} />;
  }

  // For employers, show EmployerWelcomeTunnel if onboarding not completed
  if (needsOnboarding && (profile as any)?.role === 'employer') {
    return <EmployerWelcomeTunnel onComplete={async () => {
      // Mark onboarding as completed in background
      supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      
      // Navigate to home
      navigate('/home');
    }} />;
  }

  // Show app intro tutorial after onboarding
  const showTourOverlay = showIntroTutorial;
  
  // Resolve role from profile first to avoid flicker
  const role = (profile as any)?.role || (userRole?.role as string) || '';

  // While role is resolving, keep seamless background
  if (user && profile && !role) {
    return <div className="min-h-screen bg-gradient-parium smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }} />;
  }
  
  // isAdmin is now from database via useIsOrgAdmin hook

  // Render sidebar layout for profile pages and employer routes
  const sidebarRoutes = ['/home', '/profile', '/profile-preview', '/search-jobs', '/saved-jobs', '/my-applications', '/messages', '/subscription', '/billing', '/payment', '/support', '/settings', '/admin', '/consent', '/templates'];
  const isSidebarRoute = sidebarRoutes.some(route => location.pathname.startsWith(route));

  if (isSidebarRoute && role !== 'employer') {
    // Redirect job seekers from employer routes
    if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/company-profile')) {
      return <Navigate to="/search-jobs" replace />;
    }

    const renderSidebarContent = (path: string) => {
      switch (path) {
        case '/home':
          return <JobSeekerHome />;
        case '/profile':
          return <Profile />;
        case '/profile-preview':
          return <ProfilePreview />;
        case '/consent':
          return <Consent />;
        case '/search-jobs':
          return <SearchJobs />;
        case '/saved-jobs':
          return <SavedJobs />;
        case '/my-applications':
          return <MyApplications />;
        case '/messages':
          return <JobSeekerMessages />;
        case '/subscription':
          return <Subscription />;
        case '/billing':
          return <Billing />;
        case '/support':
          return <Support />;
        case '/admin':
          // Endast Fredrik kan komma åt admin-sidan
          if (user.email === 'fredrikandits@hotmail.com') {
            return <SupportAdmin />;
          } else {
            navigate('/support');
            return <Support />;
          }
        default:
          return <JobSeekerHome />;
      }
    };

    return (
      <JobSeekerLayout developerView={developerView} onViewChange={setDeveloperView}>
        <KeepAlive activeKey={location.pathname} render={(key) => renderSidebarContent(key)} />
        {showTourOverlay && (
          <AppOnboardingTour onComplete={() => setShowIntroTutorial(false)} />
        )}
      </JobSeekerLayout>
    );
  }

  // Show employer dashboard with sidebar for employers
  if (role === 'employer') {
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
          return <EmployerProfile />;
        case '/company-profile':
          return <CompanyProfile />;
        case '/reviews':
          return <CompanyReviews />;
        case '/templates':
          return <JobTemplatesOverview />;
        case '/settings':
          return <EmployerSettings />;
        case '/billing':
          return <Billing />;
        case '/support':
          return <Support />;
        case '/admin':
          if (user.email === 'fredrikandits@hotmail.com') {
            return <SupportAdmin />;
          } else {
            navigate('/support');
            return <Support />;
          }
        default:
          return <EmployerHome />;
      }
    };

    return (
      <EmployerLayout developerView={developerView} onViewChange={setDeveloperView}>
        <KeepAlive activeKey={location.pathname} render={(key) => renderEmployerContent(key)} />
        {showTourOverlay && (
          <AppOnboardingTour onComplete={() => setShowIntroTutorial(false)} />
        )}
      </EmployerLayout>
    );
  }

  // Show job seeker swipe view for job seekers
  return (
    <div className="min-h-screen smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
      <header className="border-b border-white/20 bg-white/10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex-1 min-w-0 mr-3">
            <h1 className="text-2xl font-bold text-white">Parium</h1>
            <TruncatedText
              text={`Jobbsökare: ${profile.first_name} ${profile.last_name}`}
              className="text-sm text-white truncate block"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => navigate('/profile')}
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/20"
            >
              Min Profil
            </Button>
            {isAdmin && (
              <DeveloperControls 
                onViewChange={setDeveloperView}
                currentView={developerView}
              />
            )}
            <Button onClick={signOut} variant="outline" className="border-white/20 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50">
              Logga ut
            </Button>
          </div>
        </div>
      </header>
      
      <main className="py-8">
        <JobSwipe />
      </main>
    </div>
  );
};

export default Index;
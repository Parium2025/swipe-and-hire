import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import JobDetails from '@/pages/JobDetails';
import JobTemplatesOverview from '@/components/JobTemplatesOverview';
import CompanyReviews from '@/components/CompanyReviews';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import EmployerLayout from "@/components/EmployerLayout";
import JobSeekerLayout from "@/components/JobSeekerLayout";
import Dashboard from '@/components/Dashboard';
import EmployerDashboard from '@/components/EmployerDashboard';
import JobSwipe from '@/components/JobSwipe';
import ProfileSetup from '@/components/ProfileSetup';
import ProfileSelector from '@/components/ProfileSelector';
import WelcomeTunnel from '@/components/WelcomeTunnel';
import EmployerWelcomeTunnel from '@/components/EmployerWelcomeTunnel';
import AppOnboardingTour from '@/components/AppOnboardingTour';
import Profile from '@/pages/Profile';
import Consent from '@/pages/Consent';
import SearchJobs from '@/pages/SearchJobs';
import Subscription from '@/pages/Subscription';
import Billing from '@/pages/Billing';
import Support from '@/pages/Support';
import SupportAdmin from '@/pages/SupportAdmin';
import EmployerProfile from '@/pages/employer/EmployerProfile';
import CompanyProfile from '@/pages/employer/CompanyProfile';
import EmployerSettings from '@/pages/employer/EmployerSettings';
import DeveloperControls from '@/components/DeveloperControls';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft, Search } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useApplicationsData } from '@/hooks/useApplicationsData';
import { CandidatesTable } from '@/components/CandidatesTable';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const CandidatesContent = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const { 
    applications, 
    stats, 
    isLoading, 
    error, 
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage 
  } = useApplicationsData(searchQuery);

  // Safety check to prevent null crash
  const safeApplications = applications || [];

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-12">
      {/* Main Content */}
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-semibold text-white mb-2">
            Alla kandidater ({isLoading ? '...' : stats.total})
          </h1>
          <p className="text-white">
            Hantera och granska kandidater som sökt till dina jobbannonser
          </p>
        </div>

        {/* Search Bar - hide during initial loading */}
        {!isLoading && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
              <Input
                type="text"
                placeholder="Sök på namn, email, telefon, plats, jobb..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/60"
              />
            </div>
          </div>
        )}

        {/* Candidates Table */}
        {error ? (
          <div className="text-center py-12 text-destructive">
            Något gick fel vid hämtning av kandidater
          </div>
        ) : safeApplications.length === 0 && isLoading ? (
          <Card className="bg-white/5 border-white/10">
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
        ) : (
          <CandidatesTable 
            applications={safeApplications} 
            onUpdate={refetch}
            onLoadMore={fetchNextPage}
            hasMore={hasNextPage}
            isLoadingMore={isFetchingNextPage}
          />
        )}
      </div>
    </div>
  );
};

const Index = () => {
  const { user, profile, userRole, signOut, loading, switchRole } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [developerView, setDeveloperView] = useState<string>('dashboard');
  const [showIntroTutorial, setShowIntroTutorial] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [uiReady, setUiReady] = useState(false);
  const [showAuthCTA, setShowAuthCTA] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Borttagen aggressiv fallback till /auth som skapade loopar
  // Vi navigerar nu endast när auth-loading är klar (se effekten nedan)


  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // No user -> redirect to auth
    if (!user) {
      navigate('/auth');
      setIsInitializing(false);
      return;
    }

    // User exists but profile not loaded yet -> keep waiting with gradient background
    if (!profile) {
      return;
    }

    // Both user AND profile loaded -> redirect based on role
    const role = (profile as any)?.role;
    if (location.pathname === '/') {
      if (role === 'employer') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/search-jobs', { replace: true });
      }
      setIsInitializing(false);
      return;
    }

    // Show profile selector only for admin
    if (!location.pathname.startsWith('/profile') && 
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

  if (loading || isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-parium smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }} />
    );
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

  if (location.pathname === '/') {
    if ((userRole?.role as string) === 'employer') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/search-jobs" replace />;
    }
  }

  // Show profile selector first (admin only)
  if (showProfileSelector && user.email === 'fredrikandits@hotmail.com') {
    return <ProfileSelector onProfileSelected={() => setShowProfileSelector(false)} />;
  }

  // Check if user needs to complete onboarding
  const needsOnboarding = !profile?.onboarding_completed;
  
  // Developer overrides for admin user
  if (user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') {
    if (developerView === 'welcome_tunnel') {
      return <WelcomeTunnel onComplete={() => setDeveloperView('dashboard')} />;
    }
    if (developerView === 'employer_welcome_tunnel') {
      return <EmployerWelcomeTunnel onComplete={() => setDeveloperView('dashboard')} />;
    }
    if (developerView === 'profile_setup') {
      return <ProfileSetup />;
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
      
      // Navigate to dashboard
      navigate('/dashboard');
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
  
  // For employers, check if profile needs setup (basic info missing) - except for admin emails
  const needsProfileSetup = !profile.bio && !profile.location && !profile.profile_image_url;
  const isAdminEmail = user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com';
  if (needsProfileSetup && role === 'employer' && !isAdminEmail) {
    return <ProfileSetup />;
  }

  // Render sidebar layout for profile pages and employer routes
  const sidebarRoutes = ['/profile', '/search-jobs', '/subscription', '/billing', '/payment', '/support', '/settings', '/admin', '/consent', '/templates'];
  const isSidebarRoute = sidebarRoutes.some(route => location.pathname.startsWith(route));

  if (isSidebarRoute && role !== 'employer') {
    // Redirect job seekers from employer routes
    if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/company-profile')) {
      return <Navigate to="/search-jobs" replace />;
    }

    const renderSidebarContent = () => {
      switch (location.pathname) {
        case '/profile':
          return <Profile />;
        case '/consent':
          return <Consent />;
        case '/search-jobs':
          return <SearchJobs />;
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
          return <Profile />;
      }
    };

    return (
      <JobSeekerLayout developerView={developerView} onViewChange={setDeveloperView}>
        {renderSidebarContent()}
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
      return <Navigate to="/dashboard" replace />;
    }

    const renderEmployerContent = () => {
      // Handle job details route with dynamic ID
      if (location.pathname.startsWith('/job-details/')) {
        return <JobDetails />;
      }
      
      switch (location.pathname) {
        case '/dashboard':
          return <Dashboard />;
        case '/my-jobs':
          return <EmployerDashboard />;
        case '/candidates':
          return <CandidatesContent />;
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
          return <Dashboard />;
      }
    };

    return (
      <EmployerLayout developerView={developerView} onViewChange={setDeveloperView}>
        {renderEmployerContent()}
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
          <div>
            <h1 className="text-2xl font-bold text-white">Parium</h1>
            <p className="text-sm text-white/70">
              Jobbsökare: {profile.first_name} {profile.last_name}
            </p>
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
            {(user.email === 'fredrik.andits@icloud.com' || user.email === 'fredrikandits@hotmail.com') && (
              <DeveloperControls 
                onViewChange={setDeveloperView}
                currentView={developerView}
              />
            )}
            <Button onClick={signOut} variant="outline" className="border-white/20 text-white hover:bg-white/20">
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
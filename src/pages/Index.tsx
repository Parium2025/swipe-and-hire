import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';
import { Button } from '@/components/ui/button';
import JobSwipe from '@/components/JobSwipe';
import ProfileSelector from '@/components/ProfileSelector';
import WelcomeTunnel from '@/components/WelcomeTunnel';
import EmployerWelcomeTunnel from '@/components/EmployerWelcomeTunnel';
import AppOnboardingTour from '@/components/AppOnboardingTour';
import DeveloperControls from '@/components/DeveloperControls';
import { supabase } from '@/integrations/supabase/client';
import KeepAlive from '@/components/KeepAlive';
import { TruncatedText } from '@/components/TruncatedText';
import RouteFallback from '@/pages/index/RouteFallback';

const JobDetails = lazy(() => import('@/pages/JobDetails'));
const JobTemplatesOverview = lazy(() => import('@/components/JobTemplatesOverview'));
const CompanyReviews = lazy(() => import('@/components/CompanyReviews'));
const EmployerLayout = lazy(() => import('@/components/EmployerLayout'));
const JobSeekerLayout = lazy(() => import('@/components/JobSeekerLayout'));
const Dashboard = lazy(() => import('@/components/Dashboard'));
const EmployerDashboard = lazy(() => import('@/components/EmployerDashboard'));
const EmployerHome = lazy(() => import('@/components/EmployerHome'));
const JobSeekerHome = lazy(() => import('@/components/JobSeekerHome'));
const ProfilePreview = lazy(() => import('@/pages/ProfilePreview'));
const Profile = lazy(() => import('@/pages/Profile'));
const Consent = lazy(() => import('@/pages/Consent'));
const SearchJobs = lazy(() => import('@/pages/SearchJobs'));
const Subscription = lazy(() => import('@/pages/Subscription'));
const Billing = lazy(() => import('@/pages/Billing'));
const Support = lazy(() => import('@/pages/Support'));
const SavedJobs = lazy(() => import('@/pages/SavedJobs'));
const MyApplications = lazy(() => import('@/pages/MyApplications'));
const SupportAdmin = lazy(() => import('@/pages/SupportAdmin'));
const EmployerProfile = lazy(() => import('@/pages/employer/EmployerProfile'));
const CompanyProfile = lazy(() => import('@/pages/employer/CompanyProfile'));
const EmployerSettings = lazy(() => import('@/pages/employer/EmployerSettings'));
const EmployerAnalytics = lazy(() => import('@/components/EmployerAnalytics'));
const MyCandidates = lazy(() => import('@/pages/MyCandidates'));
const Messages = lazy(() => import('@/pages/Messages'));
const CandidatesContent = lazy(() => import('@/pages/index/CandidatesContent'));

const renderDeferredRoute = (element: ReactNode) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

const Index = () => {
  const { user, profile, userRole, signOut, loading, authAction, switchRole } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsOrgAdmin();
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [developerView, setDeveloperView] = useState<string>('dashboard');
  const [showIntroTutorial, setShowIntroTutorial] = useState(false);
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
      if (isAdmin) {
        setShowProfileSelector(true);
      }
    }
  }, [user, loading, navigate, profile, location.pathname, isAdmin]);

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
    return <RouteFallback />;
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
    return <RouteFallback />;
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
          return renderDeferredRoute(<JobSeekerHome />);
        case '/profile':
          return renderDeferredRoute(<Profile />);
        case '/profile-preview':
          return renderDeferredRoute(<ProfilePreview />);
        case '/consent':
          return renderDeferredRoute(<Consent />);
        case '/search-jobs':
          return renderDeferredRoute(<SearchJobs />);
        case '/saved-jobs':
          return renderDeferredRoute(<SavedJobs />);
        case '/my-applications':
          return renderDeferredRoute(<MyApplications />);
        case '/messages':
          return renderDeferredRoute(<Messages />);
        case '/subscription':
          return renderDeferredRoute(<Subscription />);
        case '/billing':
          return renderDeferredRoute(<Billing />);
        case '/support':
          return renderDeferredRoute(<Support />);
        case '/admin':
          // Endast Fredrik kan komma åt admin-sidan
          if (isAdmin) {
            return renderDeferredRoute(<SupportAdmin />);
          } else {
            navigate('/support');
            return renderDeferredRoute(<Support />);
          }
        default:
          return renderDeferredRoute(<JobSeekerHome />);
      }
    };

    return (
      <Suspense fallback={<RouteFallback />}>
        <JobSeekerLayout developerView={developerView} onViewChange={setDeveloperView}>
          <KeepAlive activeKey={location.pathname} render={(key) => renderSidebarContent(key)} />
          {showTourOverlay && (
            <AppOnboardingTour onComplete={() => setShowIntroTutorial(false)} />
          )}
        </JobSeekerLayout>
      </Suspense>
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
        return renderDeferredRoute(<JobDetails />);
      }
      
      switch (path) {
        case '/home':
          return renderDeferredRoute(<EmployerHome />);
        case '/dashboard':
          return renderDeferredRoute(<Dashboard />);
        case '/my-jobs':
          return renderDeferredRoute(<EmployerDashboard />);
        case '/candidates':
          return renderDeferredRoute(<CandidatesContent />);
        case '/my-candidates':
          return renderDeferredRoute(<MyCandidates />);
        case '/messages':
          return renderDeferredRoute(<Messages />);
        case '/profile':
        case '/employer-profile':
          return renderDeferredRoute(<EmployerProfile />);
        case '/company-profile':
          return renderDeferredRoute(<CompanyProfile />);
        case '/reviews':
          return renderDeferredRoute(<CompanyReviews />);
        case '/templates':
          return renderDeferredRoute(<JobTemplatesOverview />);
        case '/settings':
          return renderDeferredRoute(<EmployerSettings />);
        case '/reports':
          return renderDeferredRoute(<EmployerAnalytics />);
        case '/billing':
          return renderDeferredRoute(<Billing />);
        case '/support':
          return renderDeferredRoute(<Support />);
        case '/admin':
          if (isAdmin) {
            return renderDeferredRoute(<SupportAdmin />);
          } else {
            navigate('/support');
            return renderDeferredRoute(<Support />);
          }
        default:
          return renderDeferredRoute(<EmployerHome />);
      }
    };

    return (
      <Suspense fallback={<RouteFallback />}>
        <EmployerLayout developerView={developerView} onViewChange={setDeveloperView}>
          <KeepAlive activeKey={location.pathname} render={(key) => renderEmployerContent(key)} />
          {showTourOverlay && (
            <AppOnboardingTour onComplete={() => setShowIntroTutorial(false)} />
          )}
        </EmployerLayout>
      </Suspense>
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
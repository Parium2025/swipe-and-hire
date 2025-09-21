import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import EmployerSidebar from "@/components/EmployerSidebar";
import EmployerDashboard from '@/components/EmployerDashboard';
import JobSwipe from '@/components/JobSwipe';
import ProfileSetup from '@/components/ProfileSetup';
import ProfileSelector from '@/components/ProfileSelector';
import WelcomeTunnel from '@/components/WelcomeTunnel';
import AppOnboardingTour from '@/components/AppOnboardingTour';
import Profile from '@/pages/Profile';
import Consent from '@/pages/Consent';
import SearchJobs from '@/pages/SearchJobs';
import Subscription from '@/pages/Subscription';
import Billing from '@/pages/Billing';
import Support from '@/pages/Support';
import SupportAdmin from '@/pages/SupportAdmin';
import DeveloperControls from '@/components/DeveloperControls';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft } from 'lucide-react';

const Index = () => {
  const { user, profile, userRole, signOut, loading, switchRole } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [developerView, setDeveloperView] = useState<string>('dashboard');
  const [showIntroTutorial, setShowIntroTutorial] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [uiReady, setUiReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      setIsInitializing(false);
    } else if (user && profile && location.pathname === '/') {
      // Small delay to prevent flicker during navigation
      setTimeout(() => {
        navigate('/search-jobs');
        setIsInitializing(false);
      }, 50);
    } else if (user && profile && !location.pathname.startsWith('/profile') && !location.pathname.startsWith('/search-jobs') && !location.pathname.startsWith('/subscription') && !location.pathname.startsWith('/support') && !location.pathname.startsWith('/settings') && !location.pathname.startsWith('/billing') && !location.pathname.startsWith('/payment') && !location.pathname.startsWith('/consent')) {
      // Show profile selector only for admin (fredrikandits@hotmail.com)
      if (user.email === 'fredrikandits@hotmail.com') {
        setShowProfileSelector(true);
      }
      setIsInitializing(false);
    } else if (user && profile) {
      setIsInitializing(false);
    }
  }, [user, loading, navigate, profile, location.pathname]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setUiReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (loading || isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl text-white">Laddar...</h2>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  if (location.pathname === '/') {
    return <Navigate to="/search-jobs" replace />;
  }

  // Show profile selector first (admin only)
  if (showProfileSelector && user.email === 'fredrikandits@hotmail.com') {
    return <ProfileSelector onProfileSelected={() => setShowProfileSelector(false)} />;
  }

  // Check if user needs to complete onboarding
  const needsOnboarding = !profile?.onboarding_completed;
  
  // Debug logging
  console.log('=== ONBOARDING DEBUG ===');
  console.log('User email:', user?.email);
  console.log('User ID:', user?.id);
  console.log('User role:', userRole?.role);
  console.log('Profile object:', profile);
  console.log('Profile onboarding_completed (raw):', profile?.onboarding_completed);
  console.log('Profile onboarding_completed (type):', typeof profile?.onboarding_completed);
  console.log('!profile?.onboarding_completed:', !profile?.onboarding_completed);
  console.log('Needs onboarding:', needsOnboarding);
  console.log('Should show WelcomeTunnel:', needsOnboarding && (profile as any)?.role === 'job_seeker');
  console.log('Developer view:', developerView);
  console.log('========================');
  
  // Developer overrides for admin user
  if (user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') {
    if (developerView === 'welcome_tunnel') {
      return <WelcomeTunnel onComplete={() => setDeveloperView('dashboard')} />;
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

  // Show app intro tutorial after onboarding
  const showTourOverlay = showIntroTutorial;
  
  // For employers, check if profile needs setup (basic info missing) - except for admin emails
  const needsProfileSetup = !profile.bio && !profile.location && !profile.profile_image_url;
  const isAdminEmail = user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com';
  if (needsProfileSetup && userRole?.role === 'employer' && !isAdminEmail) {
    console.log('Showing ProfileSetup for employer');
    return <ProfileSetup />;
  }

  // Render sidebar layout for profile pages
  const sidebarRoutes = ['/profile', '/search-jobs', '/subscription', '/billing', '/payment', '/support', '/settings', '/admin', '/consent'];
  const isSidebarRoute = sidebarRoutes.some(route => location.pathname.startsWith(route));

  if (isSidebarRoute) {
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
      <SidebarProvider>
        <div className="min-h-screen flex w-full overflow-x-hidden">
          {uiReady ? <AppSidebar /> : null}
          <div className="flex-1 flex flex-col overflow-x-hidden">
            <header className="sticky top-0 z-40 h-16 flex items-center justify-between border-b bg-white/10 backdrop-blur-sm px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-white hover:bg-white/20" />
                <div>
                  <h1 className="text-xl font-bold text-white">Parium</h1>
                  <p className="text-sm text-white/70">
                    {userRole?.role === 'employer' ? 'Arbetsgivare' : 'Jobbsökare'}: {profile.first_name} {profile.last_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(user.email === 'fredrik.andits@icloud.com' || user.email === 'fredrikandits@hotmail.com' || user.email === 'pariumab2025@hotmail.com') && (
                  <DeveloperControls 
                    onViewChange={setDeveloperView}
                    currentView={developerView}
                  />
                )}
              </div>
            </header>
            
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
              {renderSidebarContent()}
              {showTourOverlay && (
                <AppOnboardingTour onComplete={() => setShowIntroTutorial(false)} />
              )}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Show employer dashboard with sidebar for employers
  if (userRole?.role === 'employer') {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full overflow-x-hidden">
          {uiReady ? <EmployerSidebar /> : null}
          <div className="flex-1 flex flex-col overflow-x-hidden">
            <header className="sticky top-0 z-40 h-16 flex items-center justify-between border-b bg-white/10 backdrop-blur-sm px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-white hover:bg-white/20" />
                <div>
                  <h1 className="text-xl font-bold text-white">Parium</h1>
                  <p className="text-sm text-white/70">
                    Arbetsgivare: {profile.first_name} {profile.last_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(user.email === 'fredrik.andits@icloud.com' || user.email === 'fredrikandits@hotmail.com' || user.email === 'pariumab2025@hotmail.com') && (
                  <DeveloperControls 
                    onViewChange={setDeveloperView}
                    currentView={developerView}
                  />
                )}
              </div>
            </header>
            
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
              <EmployerDashboard />
              {showTourOverlay && (
                <AppOnboardingTour onComplete={() => setShowIntroTutorial(false)} />
              )}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Show job seeker swipe view for job seekers
  return (
    <div className="min-h-screen">
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
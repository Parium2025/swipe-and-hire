import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import EmployerDashboard from '@/components/EmployerDashboard';
import JobSwipe from '@/components/JobSwipe';
import ProfileSetup from '@/components/ProfileSetup';
import ProfileSelector from '@/components/ProfileSelector';
import WelcomeTunnel from '@/components/WelcomeTunnel';
import Profile from '@/pages/Profile';
import SearchJobs from '@/pages/SearchJobs';
import Subscription from '@/pages/Subscription';
import Billing from '@/pages/Billing';
import Support from '@/pages/Support';
import SupportAdmin from '@/pages/SupportAdmin';
import DeveloperControls from '@/components/DeveloperControls';
import { ArrowRightLeft } from 'lucide-react';

const Index = () => {
  const { user, profile, userRole, signOut, loading, switchRole } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [developerView, setDeveloperView] = useState<string>('dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (user && profile && location.pathname === '/') {
      // Redirect to search-jobs as the default landing page for logged in users
      navigate('/search-jobs');
    } else if (user && profile && !location.pathname.startsWith('/profile') && !location.pathname.startsWith('/search-jobs') && !location.pathname.startsWith('/subscription') && !location.pathname.startsWith('/support') && !location.pathname.startsWith('/settings') && !location.pathname.startsWith('/billing') && !location.pathname.startsWith('/payment')) {
      // Show profile selector only for admin (fredrikandits@hotmail.com)
      if (user.email === 'fredrikandits@hotmail.com') {
        setShowProfileSelector(true);
      }
    }
  }, [user, loading, navigate, profile, location.pathname]);

  if (loading) {
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
  if (user?.email === 'fredrikandits@hotmail.com') {
    if (developerView === 'welcome_tunnel') {
      return <WelcomeTunnel onComplete={() => setDeveloperView('dashboard')} />;
    }
    if (developerView === 'profile_setup') {
      return <ProfileSetup />;
    }
  }
  
  // For job seekers, show WelcomeTunnel if onboarding not completed
  if (needsOnboarding && (profile as any)?.role === 'job_seeker') {
    return <WelcomeTunnel onComplete={() => window.location.reload()} />;
  }
  
  // For employers, check if profile needs setup (basic info missing)
  const needsProfileSetup = !profile.bio && !profile.location && !profile.profile_image_url;
  if (needsProfileSetup && userRole?.role === 'employer') {
    console.log('Showing ProfileSetup for employer');
    return <ProfileSetup />;
  }

  // Render sidebar layout for profile pages
  const sidebarRoutes = ['/profile', '/search-jobs', '/subscription', '/billing', '/payment', '/support', '/settings', '/admin'];
  const isSidebarRoute = sidebarRoutes.some(route => location.pathname.startsWith(route));

  if (isSidebarRoute) {
    const renderSidebarContent = () => {
      switch (location.pathname) {
        case '/profile':
          return <Profile />;
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
          <AppSidebar />
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
                {user.email === 'fredrikandits@hotmail.com' && (
                  <DeveloperControls 
                    onViewChange={setDeveloperView}
                    currentView={developerView}
                  />
                )}
              </div>
            </header>
            
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
              {renderSidebarContent()}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Show employer dashboard for employers
  if (userRole?.role === 'employer') {
    return (
      <div className="min-h-screen">
        <header className="border-b border-white/20 bg-white/10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Parium</h1>
              <p className="text-sm text-white/70">
                Arbetsgivare: {profile.first_name} {profile.last_name}
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
              {user.email === 'fredrikandits@hotmail.com' && (
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
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          <EmployerDashboard />
        </main>
      </div>
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
            {user.email === 'fredrikandits@hotmail.com' && (
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

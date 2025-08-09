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
import Support from '@/pages/Support';
import { ArrowRightLeft } from 'lucide-react';

const Index = () => {
  const { user, profile, userRole, signOut, loading, switchRole } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (user && profile && !location.pathname.startsWith('/profile') && !location.pathname.startsWith('/search-jobs') && !location.pathname.startsWith('/subscription') && !location.pathname.startsWith('/support') && !location.pathname.startsWith('/settings') && !location.pathname.startsWith('/billing') && !location.pathname.startsWith('/payment')) {
      // Show profile selector only for admin (fredrikandits@hotmail.com)
      if (user.email === 'fredrikandits@hotmail.com') {
        setShowProfileSelector(true);
      }
    }
  }, [user, loading, navigate, profile, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl">Laddar...</h2>
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

  // Check if profile needs setup (basic info missing)
  const needsProfileSetup = !profile.bio && !profile.location && !profile.profile_image_url;
  
  // For job seekers, show WelcomeTunnel instead of ProfileSetup
  if (needsProfileSetup && userRole?.role === 'job_seeker') {
    return <WelcomeTunnel onComplete={() => window.location.reload()} />;
  }
  
  // For employers, show old ProfileSetup
  if (needsProfileSetup && userRole?.role === 'employer') {
    return <ProfileSetup />;
  }

  // Render sidebar layout for profile pages
  const sidebarRoutes = ['/profile', '/search-jobs', '/subscription', '/billing', '/payment', '/support', '/settings'];
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
        case '/support':
          return <Support />;
        default:
          return <Profile />;
      }
    };

    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1">
            <header className="h-16 flex items-center justify-between border-b bg-background px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-xl font-bold">Parium</h1>
                  <p className="text-sm text-muted-foreground">
                    {userRole?.role === 'employer' ? 'Arbetsgivare' : 'Jobbsökare'}: {profile.first_name} {profile.last_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {user.email === 'fredrikandits@hotmail.com' && (
                  <Button 
                    onClick={async () => {
                      setSwitching(true);
                      await switchRole(userRole?.role === 'employer' ? 'job_seeker' : 'employer');
                      setSwitching(false);
                      navigate('/');
                    }}
                    disabled={switching}
                    variant="outline"
                    size="sm"
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {switching ? 'Byter...' : `Byt till ${userRole?.role === 'employer' ? 'jobbsökare' : 'arbetsgivare'}`}
                  </Button>
                )}
              </div>
            </header>
            
            <main className="p-6">
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
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Parium</h1>
              <p className="text-sm text-muted-foreground">
                Arbetsgivare: {profile.first_name} {profile.last_name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => navigate('/profile')}
                variant="outline"
                size="sm"
              >
                Min Profil
              </Button>
              {user.email === 'fredrikandits@hotmail.com' && (
                <Button 
                  onClick={async () => {
                    setSwitching(true);
                    await switchRole('job_seeker');
                    setSwitching(false);
                  }}
                  disabled={switching}
                  variant="outline"
                  size="sm"
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  {switching ? 'Byter...' : 'Byt till jobbsökare'}
                </Button>
              )}
              <Button onClick={signOut} variant="outline">
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Parium</h1>
            <p className="text-sm text-muted-foreground">
              Jobbsökare: {profile.first_name} {profile.last_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => navigate('/profile')}
              variant="outline"
              size="sm"
            >
              Min Profil
            </Button>
            {user.email === 'fredrikandits@hotmail.com' && (
              <Button 
                onClick={async () => {
                  setSwitching(true);
                  await switchRole('employer');
                  setSwitching(false);
                }}
                disabled={switching}
                variant="outline"
                size="sm"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                {switching ? 'Byter...' : 'Byt till arbetsgivare'}
              </Button>
            )}
            <Button onClick={signOut} variant="outline">
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

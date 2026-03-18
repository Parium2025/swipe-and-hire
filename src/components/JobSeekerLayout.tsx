import { ReactNode, memo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';
import JobSeekerTopNav from '@/components/JobSeekerTopNav';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Bell } from 'lucide-react';
import pariumLogoRings from '@/assets/parium-logo-rings.png';
import NotificationCenter from '@/components/NotificationCenter';

import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useJobSeekerDocumentTitle } from '@/hooks/useDocumentTitle';
import { useJobSeekerBackgroundSync } from '@/hooks/useJobSeekerBackgroundSync';
import { useDevice } from '@/hooks/use-device';


interface JobSeekerLayoutProps {
  children: ReactNode;
  developerView?: string;
  onViewChange?: (view: string) => void;
}

// Logo that acts as sidebar trigger — same visual as desktop PariumLogoButton
const LogoSidebarTrigger = () => {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center hover:opacity-80 active:scale-[0.97] transition-opacity shrink-0 touch-manipulation"
      aria-label="Öppna meny"
    >
      <div
        role="img"
        aria-label="Parium"
        className="h-10 w-40 bg-contain bg-left bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${pariumLogoRings})` }}
      />
    </button>
  );
};

// Mobile profile avatar - navigates to /profile on tap
const MobileProfileAvatar = () => {
  const { profile, preloadedAvatarUrl, preloadedCoverUrl } = useAuth();
  const navigate = useNavigate();
  const fallbackUrl = useMediaUrl(
    (!preloadedAvatarUrl && !preloadedCoverUrl) ? profile?.profile_image_url : null,
    'profile-image'
  );
  const avatarUrl = preloadedAvatarUrl || preloadedCoverUrl || fallbackUrl || null;
  
  const initials = (() => {
    const f = profile?.first_name || '';
    const l = profile?.last_name || '';
    if (f && l) return (f[0] + l[0]).toUpperCase();
    if (f) return f.substring(0, 2).toUpperCase();
    return 'JS';
  })();

  return (
    <button
      onClick={() => navigate('/profile')}
      className="flex items-center justify-center"
      aria-label="Min profil"
    >
      {avatarUrl ? (
        <Avatar className="h-8 w-8 ring-2 ring-white/20">
          <AvatarImage src={avatarUrl} alt="Profil" />
          <AvatarFallback className="bg-white/20 text-white text-xs font-semibold" delayMs={150}>
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white/20">
          {initials}
        </div>
      )}
    </button>
  );
};

const JobSeekerLayout = memo(({ children, developerView, onViewChange }: JobSeekerLayoutProps) => {
  const { user, profile, preloadedAvatarUrl, preloadedCoverUrl } = useAuth();
  const { isAdmin: isOrgAdmin } = useIsOrgAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const device = useDevice();
  
  // Desktop uses top nav, mobile/tablet uses sidebar
  const isDesktop = device === 'desktop';
  
  // Track user activity for "last seen" feature
  useActivityTracker();
  
  // Update browser tab title with unread message count
  useJobSeekerDocumentTitle();
  
  // 🚀 Background Sync Engine - håller ALL data färsk 24/7
  useJobSeekerBackgroundSync();
  

  // Desktop layout with top navigation
  if (isDesktop) {
    return (
      <>
        {/* Fixed gradient background */}
        <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />
        
        <div className="h-[100dvh] flex flex-col w-full overflow-hidden relative">
          <AnimatedBackground showBubbles={false} />
          
          {/* Top Navigation for Desktop */}
          <header className="sticky top-0 z-40">
            <JobSeekerTopNav />
            {/* Developer controls */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
              {isOrgAdmin && onViewChange && (
                <DeveloperControls 
                  onViewChange={onViewChange}
                  currentView={developerView || 'dashboard'}
                />
              )}
            </div>
          </header>
          
          {/* Bubbles - GPU-promoted layer to avoid scroll repaint */}
          <div className="fixed left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)', contain: 'strict', willChange: 'transform' }}>
            <div className="absolute top-12 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2s', animationDelay: '-0.3s', willChange: 'transform' }}></div>
            <div className="absolute top-24 left-16 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s', willChange: 'transform' }}></div>
            <div className="absolute top-16 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s', willChange: 'transform' }}></div>
            <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s', willChange: 'transform' }}></div>
            <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s', willChange: 'transform' }}></div>
            <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s', willChange: 'transform' }}></div>
            <div className="absolute top-4 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s', willChange: 'opacity' }}></div>
            <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s', willChange: 'opacity' }}></div>
            <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s', willChange: 'opacity' }}></div>
          </div>
          
          <main className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-3 relative z-10 flex flex-col" style={{ contain: 'layout style', WebkitOverflowScrolling: 'touch', willChange: 'scroll-position', overscrollBehavior: 'contain' }}>
            {children}
          </main>
        </div>
      </>
    );
  }

  // Mobile/Tablet layout with sidebar
  return (
    <SidebarProvider defaultOpen={true} className="bg-gradient-parium">
      {/* Fixed gradient background - covers viewport */}
      <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />
      
      <div className="h-[100dvh] flex w-full overflow-hidden relative bg-gradient-parium" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatedBackground showBubbles={false} />
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
          <header className="shrink-0 z-40 h-14 flex items-center justify-between border-b border-white/20 bg-transparent px-3" style={{ contain: 'layout style', transform: 'translateZ(0)' }}>
            <div className="flex items-center">
              <LogoSidebarTrigger />
            </div>
            {/* Centered brand name */}
            <span className="absolute left-1/2 -translate-x-1/2 text-white text-base font-semibold tracking-tight select-none pointer-events-none">
              Parium
            </span>
            <div className="flex items-center gap-2">
              {/* Search button - hidden on /search-jobs */}
              {location.pathname !== '/search-jobs' && (
                <button
                  onClick={() => navigate('/search-jobs')}
                  className="flex items-center justify-center h-9 w-9 rounded-lg text-white hover:bg-white/10 transition-colors"
                  aria-label="Sök jobb"
                >
                  <Search className="h-[18px] w-[18px]" />
                </button>
              )}
              {/* Notification Bell */}
              <NotificationCenter />
              {/* Profile Avatar */}
              <MobileProfileAvatar />
              {isOrgAdmin && onViewChange && (
                <div className="hidden md:block">
                  <DeveloperControls 
                    onViewChange={onViewChange}
                    currentView={developerView || 'dashboard'}
                  />
                </div>
              )}
            </div>
          </header>
          
          {/* Static decorative dots — no animations to avoid GPU contention with sidebar transition */}
          <div className="absolute left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
            <div className="absolute top-12 left-10 w-4 h-4 bg-secondary/30 rounded-full"></div>
            <div className="absolute top-24 left-16 w-2 h-2 bg-accent/40 rounded-full"></div>
            <div className="absolute top-16 left-20 w-3 h-3 bg-secondary/20 rounded-full"></div>
            <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full"></div>
            <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full"></div>
            <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full"></div>
            <div className="absolute top-4 left-8 w-3 h-3 bg-accent/40 rounded-full"></div>
            <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full"></div>
            <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full"></div>
            <div className="absolute top-32 left-1/4 w-1 h-1 bg-accent/60 rounded-full"></div>
            <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full"></div>
          </div>
          
          <main className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-3 pb-8 flex flex-col" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
});

JobSeekerLayout.displayName = 'JobSeekerLayout';

export default JobSeekerLayout;
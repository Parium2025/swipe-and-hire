import { ReactNode, memo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';
import JobSeekerTopNav from '@/components/JobSeekerTopNav';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TruncatedText } from '@/components/TruncatedText';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useJobSeekerDocumentTitle } from '@/hooks/useDocumentTitle';
import { useJobSeekerBackgroundSync } from '@/hooks/useJobSeekerBackgroundSync';
import { useDevice } from '@/hooks/use-device';
import { DevOfflineToggle } from '@/components/DevOfflineToggle';
import { useMessagesPreload } from '@/hooks/useMessages';
import { useMessagesBackgroundSync } from '@/hooks/useMessagesBackgroundSync';

interface JobSeekerLayoutProps {
  children: ReactNode;
  developerView?: string;
  onViewChange?: (view: string) => void;
}

const JobSeekerLayout = memo(({ children, developerView, onViewChange }: JobSeekerLayoutProps) => {
  const { user, profile } = useAuth();
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
  
  // 📨 Preload messages in background for instant navigation
  useMessagesPreload();
  
  // 🚀 Messages Background Sync - triggers on login, tab focus, and user interaction
  useMessagesBackgroundSync();

  // Prefetch public jobs in background so they're ready instantly when navigating to /search-jobs
  useEffect(() => {
    // Prefetch with empty filters (default view)
    queryClient.prefetchQuery({
      queryKey: ['public-jobs', [], 'all-categories', [], []],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('job_postings')
          .select(`
            *,
            profiles!job_postings_employer_id_fkey(company_name)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        
        return (data || []).map(job => ({
          ...job,
          company_name: job.profiles?.company_name || 'Okänt företag',
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
        }));
      },
      staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });
  }, [queryClient]);

  // Desktop layout with top navigation
  if (isDesktop) {
    return (
      <>
        {/* Fixed gradient background */}
        <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />
        
        <div className="min-h-screen flex flex-col w-full overflow-x-hidden relative">
          <AnimatedBackground showBubbles={false} />
          
          {/* Top Navigation for Desktop */}
          <header className="sticky top-0 z-40">
            <JobSeekerTopNav />
            {/* Developer controls */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
              {(user?.email === 'fredrik.andits@icloud.com' || user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') && onViewChange && (
                <DeveloperControls 
                  onViewChange={onViewChange}
                  currentView={developerView || 'dashboard'}
                />
              )}
            </div>
          </header>
          
          {/* Bubbles - positioned below header */}
          <div className="fixed left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
            <div className="absolute top-12 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2s', animationDelay: '-0.3s' }}></div>
            <div className="absolute top-24 left-16 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s' }}></div>
            <div className="absolute top-16 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s' }}></div>
            <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s' }}></div>
            <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s' }}></div>
            <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s' }}></div>
            <div className="absolute top-4 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s' }}></div>
            <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s' }}></div>
            <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s' }}></div>
          </div>
          
          <main className="flex-1 overflow-hidden p-3 relative z-10">
            {children}
          </main>
          
          {/* Floating dev offline toggle */}
          <DevOfflineToggle />
        </div>
      </>
    );
  }

  // Mobile/Tablet layout with sidebar
  return (
    <SidebarProvider defaultOpen={true}>
      {/* Fixed gradient background - covers viewport */}
      <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />
      
      <div className="min-h-screen flex w-full overflow-x-hidden smooth-scroll touch-pan relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatedBackground showBubbles={false} />
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-x-hidden relative z-10">
          <header className="sticky top-0 z-40 h-14 flex items-center justify-between border-b border-white/20 bg-transparent px-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-white hover:bg-white/20" />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-white">Parium</h1>
                <TruncatedText
                  text={`Jobbsökare: ${profile?.first_name} ${profile?.last_name}`}
                  className="text-sm text-white truncate block"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(user?.email === 'fredrik.andits@icloud.com' || user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') && onViewChange && (
                <div className="hidden md:block">
                  <DeveloperControls 
                    onViewChange={onViewChange}
                    currentView={developerView || 'dashboard'}
                  />
                </div>
              )}
            </div>
          </header>
          
          {/* Bubbles positioned below header - same as EmployerLayout */}
          <div className="absolute left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
            {/* Left-side bubbles (top corner) - more spread out like auth page */}
            <div className="absolute top-12 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2s', animationDelay: '-0.3s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-24 left-16 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-16 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s', animationFillMode: 'backwards' }}></div>
            
            {/* Right-side bubbles (bottom corner) */}
            <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s', animationFillMode: 'backwards' }}></div>
            <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s', animationFillMode: 'backwards' }}></div>
            <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s', animationFillMode: 'backwards' }}></div>
            
            {/* Pulsing lights (left) - moved higher up for more spacing */}
            <div className="absolute top-4 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s', animationFillMode: 'backwards' }}></div>
            
            {/* Pulsing lights (right) */}
            <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s', animationFillMode: 'backwards' }}></div>
            <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s', animationFillMode: 'backwards' }}></div>
            
            {/* Small star (left area) */}
            <div className="absolute top-32 left-1/4 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards' }}>
              <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards' }}></div>
            </div>
            
            {/* Small star (right area) */}
            <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards' }}>
              <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards' }}></div>
            </div>
          </div>
          
          <main className="flex-1 overflow-hidden p-3">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
});

JobSeekerLayout.displayName = 'JobSeekerLayout';

export default JobSeekerLayout;

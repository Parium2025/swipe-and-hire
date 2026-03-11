import { ReactNode, useState, useEffect, memo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider } from "@/components/ui/sidebar";
import EmployerSidebar from '@/components/EmployerSidebar';
import EmployerTopNav from '@/components/EmployerTopNav';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { useJobsData } from '@/hooks/useJobsData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { KanbanLayoutProvider, useKanbanLayout } from '@/hooks/useKanbanLayout';
import { useDevice } from '@/hooks/use-device';
import { useEmployerDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCandidateBackgroundSync } from '@/hooks/useCandidateBackgroundSync';
import { useEagerRatingsPreload } from '@/hooks/useEagerRatingsPreload';
import { useEmployerBackgroundSync } from '@/hooks/useEmployerBackgroundSync';
import { DevOfflineToggle } from '@/components/DevOfflineToggle';
import { FloatingBubbles } from '@/components/FloatingBubbles';
import { Plus } from 'lucide-react';
import { EmployerLogoSidebarTrigger, EmployerMobileProfileAvatar } from '@/components/employer/EmployerMobileHeader';
import NotificationCenter from '@/components/NotificationCenter';

interface EmployerLayoutProps {
  children: ReactNode;
  developerView: string;
  onViewChange: (view: string) => void;
}

// Inner component that uses the KanbanLayout context
const EmployerLayoutInner = memo(({ children, developerView, onViewChange }: EmployerLayoutProps) => {
  const { user, profile } = useAuth();
  const { invalidateJobs } = useJobsData();
  const queryClient = useQueryClient();
  const createJobButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { shouldCollapseSidebar, stageCount } = useKanbanLayout();
  const device = useDevice();
  const mainScrollRef = useRef<HTMLElement>(null);
  
  // Desktop uses top nav, mobile/tablet uses sidebar
  const isDesktop = device === 'desktop';
  
  // 🔥 Background sync för att hålla all arbetsgivardata färsk
  useEmployerBackgroundSync();
  
  // Auto-collapse sidebar on pages that need more horizontal space (Kanban views)
  const isKanbanPage = location.pathname.startsWith('/job-details/') || location.pathname === '/my-candidates';
  
  // Sidebar state: collapse based on stage count when on Kanban pages
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (!isKanbanPage) return true;
    return !shouldCollapseSidebar;
  });
  
  // Update sidebar state when route changes or stage count changes
  useEffect(() => {
    if (isKanbanPage) {
      setSidebarOpen(!shouldCollapseSidebar);
    } else {
      setSidebarOpen(true);
    }
  }, [isKanbanPage, shouldCollapseSidebar]);
  
  // Scroll to top on route change — window.scrollTo doesn't work since
  // content scrolls inside our internal <main> container, not window.
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  // Track user activity for "last seen" feature
  useActivityTracker();
  
  // Update browser tab title with unread message count
  useEmployerDocumentTitle();
  
  // EAGER: Förladda ratings vid FÖRSTA aktivitet (tab-focus, musrörelse)
  // Detta körs INNAN useCandidateBackgroundSync så ratings är redo direkt
  useEagerRatingsPreload();
  
  // Kontinuerlig bakgrundssynk av kandidatdata (30s intervall)
  // Gör att /candidates och /my-candidates alltid har färsk data utan laddningstid
  useCandidateBackgroundSync();

  // Keyboard shortcut: Cmd+N / Ctrl+N to open "Create New Job" dialog
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check for Cmd+N (Mac) or Ctrl+N (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      // Trigger click on the create job button
      createJobButtonRef.current?.click();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Applications prefetch is handled by usePrefetchApplications (used in sidebar/topnav on hover)
  // and useEmployerBackgroundSync (on mount/tab-focus). No need to duplicate here.

  // Prefetch job templates for instant "Skapa ny annons" dialog load
  useEffect(() => {
    if (!user) return;

    const prefetchTemplates = async () => {
      try {
        const { data } = await supabase
          .from('job_templates')
          .select('*')
          .eq('employer_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });
        
        // Cache in queryClient for instant access
        if (data) {
          queryClient.setQueryData(['job-templates', user.id], data);
        }
      } catch (error) {
        console.error('Failed to prefetch templates:', error);
      }
    };

    prefetchTemplates();
  }, [user, queryClient]);

  // Prefetch company profile for instant /reviews load
  useEffect(() => {
    if (!user) return;

    queryClient.prefetchQuery({
      queryKey: ['company-profile', user.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
    });
  }, [user, queryClient]);

  // Prefetch company reviews for instant /reviews load
  useEffect(() => {
    if (!user) return;

    queryClient.prefetchQuery({
      queryKey: ['company-reviews', user.id],
      queryFn: async () => {
        // Fetch reviews first
        const { data: reviews, error } = await supabase
          .from('company_reviews')
          .select('*')
          .eq('company_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!reviews || reviews.length === 0) return [];

        // Fetch profiles for non-anonymous reviews
        const userIds = reviews
          .filter(r => !r.is_anonymous)
          .map(r => r.user_id);

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds);

          if (profiles) {
            const profileMap = new Map(profiles.map(p => [p.user_id, p]));
            return reviews.map(r => ({
              ...r,
              profiles: profileMap.get(r.user_id) || undefined,
            }));
          }
        }

        return reviews;
      },
    });
  }, [user, queryClient]);

  // Conversations prefetch is handled by useEmployerBackgroundSync (preloadConversations)

  // Desktop layout with top navigation
  if (isDesktop) {
    return (
      <>
        {/* Fixed gradient background */}
        <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />
        
         <div className="h-screen flex flex-col w-full overflow-hidden relative">
          <AnimatedBackground showBubbles={false} />
          
           {/* Top Navigation for Desktop */}
          <header className="sticky top-0 z-40">
            <EmployerTopNav
              extraRight={
                <div className="flex items-center gap-3">
                  {(user?.email === 'fredrik.andits@icloud.com' || user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') && (
                    <DeveloperControls 
                      onViewChange={onViewChange}
                      currentView={developerView}
                    />
                  )}
                  <CreateJobSimpleDialog
                    onJobCreated={() => {
                      invalidateJobs();
                    }}
                    triggerRef={createJobButtonRef}
                  />
                </div>
              }
            />
          </header>
          
          {/* Bubbles - positioned below header */}
          <div className="fixed left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
            <FloatingBubbles />
          </div>
          
           <main ref={mainScrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 relative z-10" style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
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
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      {/* Fixed gradient background - covers viewport */}
      <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />
      
      <div className="h-[100dvh] flex w-full overflow-hidden relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatedBackground showBubbles={false} />
        <EmployerSidebar />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
          <header className="shrink-0 z-40 h-14 flex items-center justify-between border-b border-white/20 bg-transparent px-3" style={{ contain: 'layout style', transform: 'translateZ(0)' }}>
            <div className="flex items-center">
              <EmployerLogoSidebarTrigger />
            </div>
            {/* Centered brand name */}
            <span className="absolute left-1/2 -translate-x-1/2 text-white text-base font-semibold tracking-tight select-none pointer-events-none">
              Parium
            </span>
            <div className="flex items-center gap-2">
              {/* Create job - plus icon only */}
              <button
                onClick={() => createJobButtonRef.current?.click()}
                className="flex items-center justify-center h-9 w-9 rounded-lg text-white hover:bg-white/10 transition-colors"
                aria-label="Skapa ny annons"
              >
                <Plus className="h-[18px] w-[18px]" />
              </button>
              {/* Notification Bell */}
              <NotificationCenter />
              {/* Profile Avatar */}
              <EmployerMobileProfileAvatar />
              {(user?.email === 'fredrik.andits@icloud.com' || user?.email === 'fredrikandits@hotmail.com' || user?.email === 'pariumab2025@hotmail.com') && (
                <div className="hidden md:block">
                  <DeveloperControls 
                    onViewChange={onViewChange}
                    currentView={developerView}
                  />
                </div>
              )}
            </div>
          </header>
          {/* Hidden trigger for CreateJobSimpleDialog */}
          <div className="hidden">
            <CreateJobSimpleDialog
              onJobCreated={() => { invalidateJobs(); }}
              triggerRef={createJobButtonRef}
            />
          </div>
          
          {/* Bubbles positioned below header */}
          <div className="absolute left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
            <FloatingBubbles />
          </div>
          
          <main ref={mainScrollRef} className="flex-1 overflow-x-hidden overflow-y-auto p-3 pb-8" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            {children}
          </main>
          
          {/* Floating dev offline toggle */}
          <DevOfflineToggle />
        </div>
      </div>
    </SidebarProvider>
  );
});

EmployerLayoutInner.displayName = 'EmployerLayoutInner';

// Wrapper component that provides the KanbanLayout context
const EmployerLayout = memo(({ children, developerView, onViewChange }: EmployerLayoutProps) => {
  return (
    <KanbanLayoutProvider>
      <EmployerLayoutInner developerView={developerView} onViewChange={onViewChange}>
        {children}
      </EmployerLayoutInner>
    </KanbanLayoutProvider>
  );
});

EmployerLayout.displayName = 'EmployerLayout';

export default EmployerLayout;

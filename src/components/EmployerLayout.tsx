import { ReactNode, useState, useEffect, memo, useRef, useCallback } from 'react';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider } from "@/components/ui/sidebar";
import EmployerSidebar from '@/components/EmployerSidebar';
import EmployerTopNav from '@/components/EmployerTopNav';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { useJobsData } from '@/hooks/useJobsData';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { KanbanLayoutProvider, useKanbanLayout } from '@/hooks/useKanbanLayout';
import { useDevice } from '@/hooks/use-device';
import { useEmployerDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCandidateBackgroundSync } from '@/hooks/useCandidateBackgroundSync';
import { useEagerRatingsPreload } from '@/hooks/useEagerRatingsPreload';
import { useEmployerBackgroundSync } from '@/hooks/useEmployerBackgroundSync';
import { useEmployerPrefetch } from '@/hooks/useEmployerPrefetch';

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
  const { user } = useAuth();
  const { isAdmin: isOrgAdmin } = useIsOrgAdmin();
  const { invalidateJobs } = useJobsData();
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

  // Prefetch templates, company profile, reviews
  useEmployerPrefetch();

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
                  {isOrgAdmin && (
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
          
           <main ref={mainScrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 relative z-10 flex flex-col" style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {children}
          </main>
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
                className="flex items-center justify-center h-9 w-9 rounded-full text-white hover:bg-white/10 transition-colors"
                aria-label="Skapa ny annons"
              >
                <Plus className="h-[18px] w-[18px]" />
              </button>
              {/* Notification Bell */}
              <NotificationCenter />
              {/* Profile Avatar */}
              <EmployerMobileProfileAvatar />
              {isOrgAdmin && (
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
          
          <main ref={mainScrollRef} className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-3 pb-8 flex flex-col" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            {children}
          </main>
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

import { ReactNode, useState, useEffect, memo, useRef, useCallback } from 'react';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';
import { useLocation } from 'react-router-dom';
import { useJobsData } from '@/hooks/useJobsData';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { KanbanLayoutProvider, useKanbanLayout } from '@/hooks/useKanbanLayout';
import { useDevice } from '@/hooks/use-device';
import { useEmployerDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCandidateBackgroundSync } from '@/hooks/useCandidateBackgroundSync';
import { useEagerRatingsPreload } from '@/hooks/useEagerRatingsPreload';
import { useEmployerBackgroundSync } from '@/hooks/useEmployerBackgroundSync';
import { useEmployerPrefetch } from '@/hooks/useEmployerPrefetch';
import { useEmployerWarmupOrchestrator } from '@/hooks/useEmployerWarmupOrchestrator';
import EmployerDesktopShell from '@/components/employer/EmployerDesktopShell';
import EmployerMobileShell from '@/components/employer/EmployerMobileShell';

interface EmployerLayoutProps {
  children: ReactNode;
  developerView: string;
  onViewChange: (view: string) => void;
  isOrgAdmin?: boolean;
}

// Inner component that uses the KanbanLayout context
const EmployerLayoutInner = memo(({ children, developerView, onViewChange, isOrgAdmin: isOrgAdminProp }: EmployerLayoutProps) => {
  const { isAdmin: isOrgAdminFromHook } = useIsOrgAdmin();
  const isOrgAdmin = isOrgAdminProp ?? isOrgAdminFromHook;
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

  // 🚀 SPOTIFY-NIVÅ: Trappa-prefetch (sida 2-5) + mediawarmup för profilbilder
  // Ger "warm app"-känsla — inga laddspinners eller popping bilder vid flikbyten
  useEmployerWarmupOrchestrator();

  // Desktop layout with top navigation
  if (isDesktop) {
    return (
      <EmployerDesktopShell
        isOrgAdmin={isOrgAdmin}
        developerView={developerView}
        onViewChange={onViewChange}
        createJobButtonRef={createJobButtonRef}
        mainScrollRef={mainScrollRef}
        onJobCreated={invalidateJobs}
      >
        {children}
      </EmployerDesktopShell>
    );
  }

  return (
    <EmployerMobileShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isOrgAdmin={isOrgAdmin}
      developerView={developerView}
      onViewChange={onViewChange}
      createJobButtonRef={createJobButtonRef}
      mainScrollRef={mainScrollRef}
      onJobCreated={invalidateJobs}
    >
      {children}
    </EmployerMobileShell>
  );
});

EmployerLayoutInner.displayName = 'EmployerLayoutInner';

// Wrapper component that provides the KanbanLayout context
const EmployerLayout = memo(({ children, developerView, onViewChange, isOrgAdmin }: EmployerLayoutProps) => {
  return (
    <KanbanLayoutProvider>
      <EmployerLayoutInner developerView={developerView} onViewChange={onViewChange} isOrgAdmin={isOrgAdmin}>
        {children}
      </EmployerLayoutInner>
    </KanbanLayoutProvider>
  );
});

EmployerLayout.displayName = 'EmployerLayout';

export default EmployerLayout;

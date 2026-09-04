import { ReactNode, useState, useEffect, memo, useRef, useCallback } from 'react';
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
import { useSecondaryPagesPrewarm } from '@/hooks/useSecondaryPagesPrewarm';
import EmployerDesktopShell from '@/components/employer/EmployerDesktopShell';
import EmployerMobileShell from '@/components/employer/EmployerMobileShell';
import { NoPlanBanner } from '@/components/NoPlanBanner';

interface EmployerLayoutProps {
  children: ReactNode;
  overlay?: ReactNode;
}

// Inner component that uses the KanbanLayout context
const EmployerLayoutInner = memo(({ children, overlay }: EmployerLayoutProps) => {
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
  
  // Scrollen ägs numera av KeepAlive: den byter position i exakt samma
  // bildruta som vyn byts. Tidigare nollställdes den här redan vid
  // route-ändringen, alltså medan föregående sida fortfarande syntes — det
  // var hoppet/blixten användaren såg innan annonsvyn tonade in.

  // Track user activity for "last seen" feature
  useActivityTracker();
  
  // Update browser tab title with unread message count
  useEmployerDocumentTitle();
  
  const isCandidateRoute = location.pathname === '/candidates' || location.pathname === '/my-candidates';

  // Kandidatpreload och dess realtime-kanal behövs endast i kandidatverktygen.
  // Hookarna är alltid anropade men gör inget på övriga arbetsgivarsidor.
  useEagerRatingsPreload(isCandidateRoute);
  useCandidateBackgroundSync(isCandidateRoute);

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

  // 🔥 Sekundärsidor (Support, Inställningar, Statistik) — cachas i idle
  useSecondaryPagesPrewarm();

  // Desktop layout with top navigation
  if (isDesktop) {
    return (
      <>
        <EmployerDesktopShell
          createJobButtonRef={createJobButtonRef}
          mainScrollRef={mainScrollRef}
          onJobCreated={invalidateJobs}
        >
          <NoPlanBanner />
          {children}
        </EmployerDesktopShell>
        {overlay}
      </>
    );
  }

  return (
    <>
      <EmployerMobileShell
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        createJobButtonRef={createJobButtonRef}
        mainScrollRef={mainScrollRef}
        onJobCreated={invalidateJobs}
      >
        <NoPlanBanner />
        {children}
      </EmployerMobileShell>
      {overlay}
    </>
  );
});

EmployerLayoutInner.displayName = 'EmployerLayoutInner';

// Wrapper component that provides the KanbanLayout context
const EmployerLayout = memo(({ children, overlay }: EmployerLayoutProps) => {
  return (
    <KanbanLayoutProvider>
      <EmployerLayoutInner overlay={overlay}>
        {children}
      </EmployerLayoutInner>
    </KanbanLayoutProvider>
  );
});

EmployerLayout.displayName = 'EmployerLayout';

export default EmployerLayout;

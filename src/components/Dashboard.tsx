import { memo, useMemo, useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, Users, Eye, TrendingUp } from 'lucide-react';
import { useJobsData } from '@/hooks/useJobsData';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { isEmployerJobActive, isEmployerJobExpired } from '@/lib/jobStatus';
import { StatsGrid } from '@/components/StatsGrid';
import { JobSearchBar } from '@/components/JobSearchBar';
import { useJobFiltering } from '@/hooks/useJobFiltering';
import { JobStatusTabs } from '@/components/ui/job-status-tabs';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { EmployerJobCard } from '@/components/dashboard/EmployerJobCard';

type JobStatusTab = 'active' | 'expired' | 'draft';

/** Shared empty state message for both desktop and mobile */
const getEmptyMessage = (searchTerm: string, activeTab: JobStatusTab): string => {
  if (searchTerm) return 'Inga annonser matchar din sökning';
  return activeTab === 'active'
    ? 'Inga aktiva jobbannonser. Skapa din första annons!'
    : 'Inga utgångna jobbannonser.';
};

const Dashboard = memo(() => {
  const { jobs: allJobs, stats, recruiters, isLoading } = useJobsData({ 
    scope: 'organization',
    enableRealtime: true 
  });
  const { profile, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications } = useAuth();
  const navigate = useNavigate();
  
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as JobStatusTab | null;
  const urlTab: JobStatusTab = tabParam === 'expired' ? 'expired' : 'active';
  // Optimistisk lokal tab — uppdateras direkt så indikatorn animerar utan att vänta på listan
  const [optimisticTab, setOptimisticTab] = useState<JobStatusTab>(urlTab);
  const [, startTransition] = useTransition();

  // Synka om URL ändras externt (t.ex. browser back/forward)
  useEffect(() => {
    setOptimisticTab(urlTab);
  }, [urlTab]);

  const activeTab = optimisticTab;
  const setActiveTab = useCallback((tab: JobStatusTab) => {
    setOptimisticTab(tab); // sync → animerar tab-indikatorn omedelbart
    startTransition(() => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (tab === 'active') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      }, { replace: true });
    });
  }, [setSearchParams]);

  // Swipe between tabs on mobile
  const tabOrder: JobStatusTab[] = ['active', 'expired'];
  const swipeToNextTab = useCallback(() => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx < tabOrder.length - 1) setActiveTab(tabOrder[idx + 1]);
  }, [activeTab, setActiveTab]);
  const swipeToPrevTab = useCallback(() => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx > 0) setActiveTab(tabOrder[idx - 1]);
  }, [activeTab, setActiveTab]);
  const tabSwipeHandlers = useSwipeGesture({ onSwipeLeft: swipeToNextTab, onSwipeRight: swipeToPrevTab, threshold: 50 });

  const activeJobs = useMemo(() => allJobs.filter(job => 
    isEmployerJobActive(job)
  ), [allJobs]);

  const expiredJobs = useMemo(() => allJobs.filter(job => 
    isEmployerJobExpired(job)
  ), [allJobs]);

  const jobs = activeTab === 'active' ? activeJobs : expiredJobs;

  const filteredStats = useMemo(() => ({
    totalJobs: activeJobs.length + expiredJobs.length,
    activeJobs: activeJobs.length,
    totalViews: activeJobs.reduce((sum, job) => sum + (job.views_count || 0), 0),
    totalApplications: activeJobs.reduce((sum, job) => sum + (job.applications_count || 0), 0),
  }), [activeJobs, expiredJobs]);

  const {
    searchInput,
    setSearchInput,
    searchTerm,
    sortBy,
    setSortBy,
    selectedRecruiterId,
    setSelectedRecruiterId,
    filteredAndSortedJobs,
  } = useJobFiltering(jobs);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const listTopRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedJobs.length / pageSize));
  const pageJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedJobs.slice(start, start + pageSize);
  }, [filteredAndSortedJobs, page]);

  // Reset page when tab or filters change
  useEffect(() => { setPage(1); }, [activeTab]);
  useEffect(() => { setPage(1); }, [searchTerm, sortBy, selectedRecruiterId]);

  // Scroll to top when page changes (but not on initial mount)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page]);

  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Annonser', value: isLoading ? preloadedEmployerActiveJobs : filteredStats.totalJobs, loading: false },
    { 
      icon: TrendingUp, 
      title: 'Aktiva', 
      value: isLoading ? preloadedEmployerActiveJobs : filteredStats.activeJobs, 
      loading: false,
      subItems: [
        { label: 'Utgångna', value: expiredJobs.length },
      ]
    },
    { icon: Eye, title: 'Visningar', value: isLoading ? preloadedEmployerTotalViews : filteredStats.totalViews, loading: false },
    { icon: Users, title: 'Ansökningar', value: isLoading ? preloadedEmployerTotalApplications : filteredStats.totalApplications, loading: false },
  ], [filteredStats, expiredJobs.length, isLoading, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications]);

  if (isLoading || !showContent) {
    return (
      <div className="dashboard-page-stack responsive-container-wide opacity-0">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  

  return (
    <div className="dashboard-page-stack responsive-container-wide animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-page-title font-semibold tracking-tight">Dashboard</h1>
      </div>

      <StatsGrid stats={statsCards} />

      <JobSearchBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        sortBy={sortBy}
        onSortChange={setSortBy}
        recruiters={recruiters}
        selectedRecruiterId={selectedRecruiterId}
        onRecruiterChange={setSelectedRecruiterId}
        placeholder="Sök efter titel, plats, anställningstyp, rekryterare..."
        companyName={profile?.company_name}
        hasDrafts={false}
      />

      {searchTerm && (
        <div className="text-body-sm">
          Visar {filteredAndSortedJobs.length} av {jobs.length} annonser
        </div>
      )}

      {/* Status tabs */}
      <div className="flex justify-center">
        <JobStatusTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeCount={activeJobs.length}
          expiredCount={expiredJobs.length}
        />
      </div>

      {/* Desktop: Card grid */}
      <div className="hidden md:block">
        <div ref={listTopRef} />
        {filteredAndSortedJobs.length === 0 ? (
          <div className="text-center text-white py-12 font-medium text-sm">
            {getEmptyMessage(searchTerm, activeTab)}
          </div>
        ) : (
          <>
            <div className={`job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4${pageJobs.length === 1 ? ' job-card-grid-single' : pageJobs.length === 2 ? ' job-card-grid-double' : ''}`}>
              {visibleJobs.map((job) => (
                <EmployerJobCard
                  key={job.id}
                  job={job as any}
                  activeTab={activeTab as 'active' | 'expired'}
                  onClick={(jobId) => navigate(`/job-details/${jobId}`, { state: { fromRoute: '/dashboard', fromTab: activeTab } })}
                />
              ))}
            </div>
            <DashboardPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Mobile: Card list view */}
      <div className="block md:hidden touch-pan-y" onTouchStart={tabSwipeHandlers.onTouchStart} onTouchMove={tabSwipeHandlers.onTouchMove} onTouchEnd={tabSwipeHandlers.onTouchEnd}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-white/10" />
                    <Skeleton className="h-3 w-1/2 bg-white/10" />
                    <div className="flex gap-2 mt-2">
                      <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
                      <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedJobs.length === 0 ? (
          <div className="text-center text-white py-8 font-medium text-sm min-h-[40vh] flex items-center justify-center">
            <span>{getEmptyMessage(searchTerm, activeTab)}</span>
          </div>
        ) : (
          <div className={`job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4${pageJobs.length === 1 ? ' job-card-grid-single' : pageJobs.length === 2 ? ' job-card-grid-double' : ''}`}>
            {visibleJobs.map((job) => (
              <ReadOnlyMobileJobCard
                key={job.id}
                job={job as any}
                hideSaveButton
                onCardClick={(jobId) => navigate(`/job-details/${jobId}`, { state: { fromRoute: '/dashboard', fromTab: activeTab } })}
              />
            ))}

            <DashboardPagination page={page} totalPages={totalPages} onPageChange={setPage} compact />
          </div>
        )}
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;
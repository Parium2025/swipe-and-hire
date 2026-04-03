import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, Users, Eye, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { useJobsData } from '@/hooks/useJobsData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { formatDateShortSv, isJobExpiredCheck, getTimeRemaining, formatExpirationDateTime } from '@/lib/date';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  const activeTab: JobStatusTab = tabParam === 'expired' ? 'expired' : 'active';
  const setActiveTab = useCallback((tab: JobStatusTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'active') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
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
    job.is_active && !isJobExpiredCheck(job.created_at, job.expires_at)
  ), [allJobs]);

  const expiredJobs = useMemo(() => allJobs.filter(job => 
    isJobExpiredCheck(job.created_at, job.expires_at)
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

  const tabTitle = `${activeTab === 'active' ? 'Aktiva jobb' : 'Utgångna jobb'} av ${profile?.company_name || 'ditt företag'}`;

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

      {/* Desktop: Card-wrapped table */}
      <Card className="hidden md:block bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm text-white text-left">{tabTitle}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="hidden md:block w-full">
            <div ref={listTopRef} />
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="border-white/20 hover:bg-transparent">
                  <TableHead className="text-white font-semibold text-sm text-center px-2 w-[26%]">Titel</TableHead>
                  <TableHead className="text-white font-semibold text-sm text-center px-2 w-[10%]">Status</TableHead>
                  <TableHead className="text-white font-semibold text-sm text-center px-1 w-[9%]">Visningar</TableHead>
                  <TableHead className="text-white font-semibold text-sm text-center px-1 w-[11%]">Ansökningar</TableHead>
                  <TableHead className="text-white font-semibold text-sm text-center px-2 w-[15%]">Plats</TableHead>
                  <TableHead className="text-white font-semibold text-sm text-center px-2 w-[16%]">Rekryterare</TableHead>
                  <TableHead className="text-white font-semibold text-sm text-center px-2 w-[13%]">Skapad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="border-white/10">
                        <TableCell className="text-center px-2 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <Skeleton className="h-4 w-3/4 bg-white/10" />
                            <Skeleton className="h-3 w-16 bg-white/10" />
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Skeleton className="h-5 w-16 mx-auto rounded-full bg-white/10" />
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Skeleton className="h-5 w-10 mx-auto rounded-full bg-white/10" />
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Skeleton className="h-5 w-10 mx-auto rounded-full bg-white/10" />
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Skeleton className="h-4 w-20 mx-auto bg-white/10" />
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Skeleton className="h-4 w-24 mx-auto bg-white/10" />
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Skeleton className="h-4 w-16 mx-auto bg-white/10" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : filteredAndSortedJobs.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="text-center !text-white py-8 font-medium text-sm">
                      {getEmptyMessage(searchTerm, activeTab)}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageJobs.map((job) => {
                    const timeInfo = getTimeRemaining(job.created_at, job.expires_at);
                    return (
                      <TableRow 
                        key={job.id}
                        className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => navigate(`/job-details/${job.id}`, { state: { fromRoute: '/dashboard', fromTab: activeTab } })}
                      >
                        <TableCell className="font-medium text-white text-center px-2 py-3">
                          <JobTitleCell title={job.title} employmentType={job.employment_type} />
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <div className="flex justify-center">
                            <Badge 
                              variant={activeTab === 'expired' ? 'glassDestructive' : undefined}
                              className={`text-xs whitespace-nowrap transition-colors ${
                                activeTab === 'expired' 
                                  ? ""
                                  : job.is_active 
                                    ? "bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30" 
                                    : "bg-gray-500/20 text-gray-300 border-gray-500/30 hover:bg-gray-500/30"
                              }`}
                            >
                              {activeTab === 'expired' ? 'Utgången' : job.is_active ? 'Aktiv' : 'Inaktiv'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs hover:bg-purple-500/30 transition-colors">
                            {job.views_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs hover:bg-blue-500/30 transition-colors">
                            {job.applications_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white text-center px-2 py-3">
                          <div className="flex items-center justify-center gap-1.5 text-sm">
                            <MapPin size={14} className="flex-shrink-0" />
                            <TruncatedText text={job.location} className="truncate max-w-[120px]" />
                          </div>
                        </TableCell>
                        <TableCell className="text-white text-center px-2 py-3">
                          <TruncatedText 
                            text={job.employer_profile?.first_name && job.employer_profile?.last_name
                              ? `${job.employer_profile.first_name} ${job.employer_profile.last_name}`
                              : '-'}
                            className="text-sm truncate max-w-[130px] block"
                          />
                        </TableCell>
                        <TableCell className="text-white text-center px-2 py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center justify-center gap-1.5 text-sm whitespace-nowrap">
                              <Calendar size={14} />
                              {formatDateShortSv(job.created_at)}
                            </div>
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`text-xs cursor-pointer ${timeInfo.isExpired ? 'text-red-400' : 'text-white'}`}>
                                    {timeInfo.isExpired ? 'Utgången' : `Utgår om: ${timeInfo.text}`}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-slate-900/95 border-white/20 text-white">
                                  <p className="text-xs">{formatExpirationDateTime(job.created_at, job.expires_at)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            
            <DashboardPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

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
          <div className="job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageJobs.map((job) => (
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
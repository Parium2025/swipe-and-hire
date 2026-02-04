import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, Users, Eye, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { useJobsData } from '@/hooks/useJobsData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { formatDateShortSv, isJobExpiredCheck, getTimeRemaining, formatExpirationDateTime } from '@/lib/date';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatsGrid } from '@/components/StatsGrid';
import { JobSearchBar } from '@/components/JobSearchBar';
import { useJobFiltering } from '@/hooks/useJobFiltering';
import { JobStatusTabs } from '@/components/ui/job-status-tabs';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type JobStatusTab = 'active' | 'expired';

const Dashboard = memo(() => {
  // Dashboard shows organization-wide data (all colleagues' published jobs)
  // Enable realtime updates so new jobs from colleagues appear automatically
  const { jobs: allJobs, stats, recruiters, isLoading } = useJobsData({ 
    scope: 'organization',
    enableRealtime: true 
  });
  const { profile, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications } = useAuth();
  const navigate = useNavigate();
  
  // Minimum delay for smooth fade-in animation (prevents jarring instant appearance when cached)
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Tab state for switching between active and expired jobs
  const [activeTab, setActiveTab] = useState<JobStatusTab>('active');

  // Separate active and expired jobs
  const activeJobs = useMemo(() => allJobs.filter(job => 
    job.is_active && !isJobExpiredCheck(job.created_at, job.expires_at)
  ), [allJobs]);

  const expiredJobs = useMemo(() => allJobs.filter(job => 
    job.is_active && isJobExpiredCheck(job.created_at, job.expires_at)
  ), [allJobs]);

  // Current jobs based on selected tab
  const jobs = activeTab === 'active' ? activeJobs : expiredJobs;

  // Calculate stats - totalJobs includes BOTH active and expired, activeJobs shows only active
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

  // Reset page when tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

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

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, sortBy, selectedRecruiterId]);

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

  // Use filtered stats (excluding expired jobs) for accurate representation
  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Totalt annonser', value: isLoading ? preloadedEmployerActiveJobs : filteredStats.totalJobs, loading: false },
    { 
      icon: TrendingUp, 
      title: 'Aktiva', 
      value: isLoading ? preloadedEmployerActiveJobs : filteredStats.activeJobs, 
      loading: false,
      subItems: [
        { label: 'Utgångna', value: expiredJobs.length },
      ]
    },
    { icon: Eye, title: 'Totala visningar', value: isLoading ? preloadedEmployerTotalViews : filteredStats.totalViews, loading: false },
    { icon: Users, title: 'Ansökningar', value: isLoading ? preloadedEmployerTotalApplications : filteredStats.totalApplications, loading: false },
  ], [filteredStats, expiredJobs.length, isLoading, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications]);

  // Wait for data AND minimum delay before showing content with fade
  if (isLoading || !showContent) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12 opacity-0">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12 animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Dashboard</h1>
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
        <div className="text-sm text-white">
          Visar {filteredAndSortedJobs.length} av {jobs.length} annonser
        </div>
      )}

      <Card className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg">
        <CardHeader className="p-6 md:p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-sm text-white text-center md:text-left">
              {activeTab === 'active' ? 'Aktiva jobb' : 'Utgångna jobb'} av {profile?.company_name || 'ditt företag'}
            </CardTitle>
            <JobStatusTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              activeCount={activeJobs.length}
              expiredCount={expiredJobs.length}
            />
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
          
          {/* Desktop: Table view */}
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
                      {searchTerm 
                        ? 'Inga annonser matchar din sökning' 
                        : activeTab === 'active' 
                          ? 'Inga aktiva jobbannonser. Skapa din första annons!' 
                          : 'Inga utgångna jobbannonser.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageJobs.map((job) => (
                    <TableRow 
                      key={job.id}
                      className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => navigate(`/job-details/${job.id}`)}
                    >
                      <TableCell className="font-medium text-white text-center px-2 py-3">
                        <JobTitleCell title={job.title} employmentType={job.employment_type} />
                      </TableCell>
                      <TableCell className="text-center px-2 py-3">
                        <div className="flex justify-center">
                          <Badge 
                            variant={activeTab === 'expired' ? 'glassDestructive' : undefined}
                            className={`text-sm whitespace-nowrap transition-colors ${
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
                          {(() => {
                            const typedJob = job as any;
                            const timeInfo = getTimeRemaining(job.created_at, typedJob.expires_at);
                            return (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`text-xs cursor-pointer ${timeInfo.isExpired ? 'text-red-400' : 'text-white'}`}>
                                      {timeInfo.isExpired ? 'Utgången' : `Utgår om: ${timeInfo.text}`}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="bg-slate-900/95 border-white/20 text-white">
                                    <p className="text-xs">{formatExpirationDateTime(job.created_at, typedJob.expires_at)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Desktop Pagination */}
            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(p => Math.max(1, p - 1));
                      }}
                      className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {page > 2 && (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(1);
                          }}
                          className="cursor-pointer"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      {page > 3 && <PaginationEllipsis />}
                    </>
                  )}

                  {page > 1 && (
                    <PaginationItem>
                      <PaginationLink
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(page - 1);
                        }}
                        className="cursor-pointer"
                      >
                        {page - 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationLink isActive>
                      {page}
                    </PaginationLink>
                  </PaginationItem>

                  {page < totalPages && (
                    <PaginationItem>
                      <PaginationLink
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(page + 1);
                        }}
                        className="cursor-pointer"
                      >
                        {page + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  {page < totalPages - 1 && (
                    <>
                      {page < totalPages - 2 && <PaginationEllipsis />}
                      <PaginationItem>
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(totalPages);
                          }}
                          className="cursor-pointer"
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(p => Math.min(totalPages, p + 1));
                      }}
                      className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
                <span className="ml-4 text-sm text-white">Sida {page} av {totalPages}</span>
              </Pagination>
            )}
          </div>

          {/* Mobile: Card list view */}
          <div className="block md:hidden">
            {isLoading ? (
              <div className="space-y-3 px-2">
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
              <div className="text-center text-white py-8 font-medium text-sm">
                {searchTerm 
                  ? 'Inga annonser matchar din sökning' 
                  : activeTab === 'active' 
                    ? 'Inga aktiva jobbannonser. Skapa din första annons!' 
                    : 'Inga utgångna jobbannonser.'}
              </div>
            ) : (
              <>
                <div className="rounded-none bg-transparent ring-0 shadow-none">
                  <ScrollArea className="h-[calc(100vh-280px)] min-h-[320px]">
                    <div className="space-y-2 px-2 py-2 pb-24">
                      {pageJobs.map((job) => (
                        <ReadOnlyMobileJobCard
                          key={job.id}
                          job={job as any}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Mobile Pagination */}
                {totalPages > 1 && (
                  <Pagination className="mt-3">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p => Math.max(1, p - 1));
                          }}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>

                      {page > 2 && (
                        <>
                          <PaginationItem>
                            <PaginationLink
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(1);
                              }}
                              className="cursor-pointer"
                            >
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {page > 3 && <PaginationEllipsis />}
                        </>
                      )}

                      {page > 1 && (
                        <PaginationItem>
                          <PaginationLink
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(page - 1);
                            }}
                            className="cursor-pointer"
                          >
                            {page - 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      <PaginationItem>
                        <PaginationLink isActive>
                          {page}
                        </PaginationLink>
                      </PaginationItem>

                      {page < totalPages && (
                        <PaginationItem>
                          <PaginationLink
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(page + 1);
                            }}
                            className="cursor-pointer"
                          >
                            {page + 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      {page < totalPages - 1 && (
                        <>
                          {page < totalPages - 2 && <PaginationEllipsis />}
                          <PaginationItem>
                            <PaginationLink
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(totalPages);
                              }}
                              className="cursor-pointer"
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}

                      <PaginationItem>
                        <PaginationNext
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p => Math.min(totalPages, p + 1));
                          }}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                    <span className="ml-4 text-sm text-white">Sida {page} av {totalPages}</span>
                  </Pagination>
                )}
              </>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;

import { useState, memo, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Eye, MapPin, Calendar, Edit, Trash2, AlertTriangle, Briefcase, TrendingUp, Users, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EditJobDialog from '@/components/EditJobDialog';
import { useJobsData, type JobPosting } from '@/hooks/useJobsData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import { MobileJobCard } from '@/components/MobileJobCard';
import { formatDateShortSv, isJobExpiredCheck, getTimeRemaining, formatExpirationDateTime } from '@/lib/date';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertDialogContentNoFocus } from "@/components/ui/alert-dialog-no-focus";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { StatsGrid } from '@/components/StatsGrid';
import { JobSearchBar } from '@/components/JobSearchBar';
import { useJobFiltering } from '@/hooks/useJobFiltering';
import MobileJobWizard from '@/components/MobileJobWizard';
import { useJobPrefetch } from '@/hooks/useJobPrefetch';

const EmployerDashboard = memo(() => {
  const navigate = useNavigate();
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user, profile, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications } = useAuth();
  const { toast } = useToast();
  
  // Prefetch job details on hover for instant navigation
  const { handleMouseEnter: prefetchJob, handleMouseLeave: cancelPrefetch } = useJobPrefetch();
  
  // State for editing drafts in wizard
  const [draftToEdit, setDraftToEdit] = useState<JobPosting | null>(null);
  const [draftWizardOpen, setDraftWizardOpen] = useState(false);
  
  // Skip fade-in animation when data is already cached (instant render on re-navigation)
  // Only show fade-in on first load when we actually waited for data
  const dataWasCached = useRef(!loading);
  const [showContent, setShowContent] = useState(() => !loading);
  useEffect(() => {
    if (!loading && !showContent) {
      if (dataWasCached.current) {
        setShowContent(true); // Instant — data was cached
      } else {
        const timer = setTimeout(() => setShowContent(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, showContent]);
  
  const {
    searchInput,
    setSearchInput,
    searchTerm,
    sortBy,
    setSortBy,
    filteredAndSortedJobs,
  } = useJobFiltering(jobs);
  
  // Pagination state for mobile
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const listTopRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  
  // Check if there are any drafts
  const hasDrafts = useMemo(() => jobs.some(job => !job.is_active), [jobs]);
  
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedJobs.length / pageSize));
  const pageJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedJobs.slice(start, start + pageSize);
  }, [filteredAndSortedJobs, page]);
  
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

  // Check if job has expired (using effective expiration date)
  const isJobExpired = (job: JobPosting): boolean => {
    return isJobExpiredCheck(job.created_at, job.expires_at);
  };

  const handleDeleteClick = (job: JobPosting) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;
    
    // Check if online before deleting
    if (!navigator.onLine) {
      toast({
        title: 'Offline',
        description: 'Du måste vara online för att ta bort annonser',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Soft delete: mark as deleted instead of actually deleting
      const { error } = await supabase
        .from('job_postings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', jobToDelete.id);

      if (error) {
        toast({
          title: "Fel vid borttagning",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Annons borttagen",
        description: "Jobbannonsen har tagits bort."
      });

      setDeleteDialogOpen(false);
      setJobToDelete(null);
      invalidateJobs();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte ta bort annonsen.",
        variant: "destructive"
      });
    }
  };

  const handleEditJob = (job: JobPosting) => {
    setEditingJob(job);
    setEditDialogOpen(true);
  };

  // Handle editing draft jobs - open wizard instead of job-details
  const handleEditDraft = (job: JobPosting) => {
    setDraftToEdit(job);
    setDraftWizardOpen(true);
  };

  // Handle row click - drafts open wizard, active jobs go to details
  const handleJobRowClick = (job: JobPosting) => {
    if (!job.is_active) {
      handleEditDraft(job);
    } else {
      navigate(`/job-details/${job.id}`);
    }
  };

  // Count active jobs for stats - exclude expired jobs from "Aktiva annonser" count
  // "Mina annonser" shows all jobs (including drafts)
  const activeJobs = useMemo(() => 
    jobs.filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at)), 
    [jobs]
  );
  
  // Count expired jobs
  const expiredJobsCount = useMemo(() => 
    jobs.filter(j => j.is_active && isJobExpiredCheck(j.created_at, j.expires_at)).length, 
    [jobs]
  );
  
  // Count draft jobs
  const draftJobsCount = useMemo(() => 
    jobs.filter(j => !j.is_active).length, 
    [jobs]
  );
  
  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Mina annonser', value: loading ? preloadedEmployerMyJobs : jobs.length, loading: false },
    { 
      icon: TrendingUp, 
      title: 'Aktiva', 
      value: loading ? preloadedEmployerActiveJobs : activeJobs.length, 
      loading: false,
      subItems: [
        { label: 'Utgångna', value: expiredJobsCount },
        { label: 'Utkast', value: draftJobsCount },
      ]
    },
    { icon: Eye, title: 'Totala visningar', value: loading ? preloadedEmployerTotalViews : activeJobs.reduce((s, j) => s + j.views_count, 0), loading: false },
    { icon: Users, title: 'Ansökningar', value: loading ? preloadedEmployerTotalApplications : activeJobs.reduce((s, j) => s + j.applications_count, 0), loading: false },
  ], [jobs, activeJobs, expiredJobsCount, draftJobsCount, loading, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications]);

  // Wait for data AND minimum delay before showing content with fade
  if (loading || !showContent) {
    return (
       <div className="space-y-4 responsive-container-wide opacity-0" aria-hidden="true">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  // Use animate-fade-in only on first real load, not on cached re-navigations
  const fadeClass = dataWasCached.current ? '' : 'animate-fade-in';

  return (
     <div className={`space-y-4 responsive-container-wide ${fadeClass}`}>
      <div className="flex justify-center items-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Mina jobbannonser</h1>
      </div>

      <StatsGrid stats={statsCards} />

      <JobSearchBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        sortBy={sortBy}
        onSortChange={setSortBy}
        companyName={profile?.company_name || 'företaget'}
        hasDrafts={hasDrafts}
      />

      {/* Result indicator */}
      {searchTerm && (
        <div className="text-sm text-white mb-4">
          {filteredAndSortedJobs.length === 0 ? (
            <span>Inga annonser matchar din sökning</span>
          ) : (
            <span>
              Visar {filteredAndSortedJobs.length} av {jobs.length} annonser
            </span>
          )}
        </div>
      )}

      {/* Jobs Table */}
      <Card className="bg-white/5 backdrop-blur-sm border-0">
        <CardHeader className="hidden md:block md:p-4">
              <CardTitle className="text-sm text-white md:text-left">
                Mina jobbannonser
              </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
          {/* Desktop: Table view */}
          <div className="hidden md:block">
            <div className="w-full">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="border-white/20 hover:bg-transparent">
                    <TableHead className="text-white font-semibold text-sm text-center px-2 w-[22%]">Titel</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-2 w-[9%]">Status</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-1 w-[8%]">Visningar</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-1 w-[10%]">Ansökningar</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-2 w-[12%]">Plats</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-2 w-[13%]">Rekryterare</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-2 w-[12%]">Skapad</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-2 w-[14%]">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
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
                          <TableCell className="text-center px-2 py-3">
                            <Skeleton className="h-6 w-6 mx-auto rounded bg-white/10" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ) : filteredAndSortedJobs.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="text-center !text-white py-8 font-medium text-sm">
                        {searchTerm.trim() 
                          ? 'Inga annonser matchar din sökning' 
                          : 'Inga jobbannonser än. Skapa din första annons!'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageJobs.map((job) => {
                      const isExpired = job.is_active && isJobExpiredCheck(job.created_at, job.expires_at);
                      const isDraft = !job.is_active;
                      
                      return (
                      <TableRow 
                        key={job.id}
                        className={`group border-white/10 cursor-pointer transition-colors ${
                          isExpired 
                            ? "hover:bg-red-500/10" 
                            : isDraft 
                              ? "hover:bg-amber-500/10"
                              : "hover:bg-green-500/10"
                        }`}
                        onClick={() => handleJobRowClick(job as JobPosting)}
                        onMouseEnter={() => job.is_active && prefetchJob(job.id)}
                        onMouseLeave={cancelPrefetch}
                      >
                        <TableCell className="font-medium text-white text-center px-2 py-3 overflow-hidden">
                          <JobTitleCell title={job.title} employmentType={job.employment_type} />
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            {job.is_active ? (
                              isJobExpiredCheck(job.created_at, job.expires_at) ? (
                               <Badge variant="glass" className="whitespace-nowrap text-xs transition-all duration-300 bg-red-500/60 border-red-400/60 text-white group-hover:backdrop-brightness-90 hover:bg-red-500/70 hover:backdrop-brightness-110">
                                  Utgången
                                </Badge>
                              ) : (
                                <Badge variant="glass" className="text-xs transition-all duration-300 bg-green-500/60 border-green-500/60 text-white group-hover:backdrop-brightness-90 hover:bg-green-500/70 hover:backdrop-brightness-110">
                                  Aktiv
                                </Badge>
                              )
                            ) : (
                              <Badge variant="glass" className="text-xs transition-all duration-300 bg-yellow-500/60 border-yellow-500/60 text-white group-hover:backdrop-brightness-90 hover:bg-yellow-500/70 hover:backdrop-brightness-110">
                                Utkast
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Badge variant="glass" className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-purple-500/30 hover:border-purple-500/50 hover:backdrop-brightness-110 hover:scale-[1.03]">
                            {job.views_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Badge variant="glass" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-blue-500/30 hover:border-blue-500/50 hover:backdrop-brightness-110 hover:scale-[1.03]">
                            {job.applications_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white text-center px-2 py-3">
                          <div className="flex items-center justify-center gap-1 text-sm">
                            <MapPin size={12} className="flex-shrink-0" />
                            <TruncatedText text={job.location} className="truncate max-w-[90px]" />
                          </div>
                        </TableCell>
                        <TableCell className="text-white text-center px-2 py-3">
                          <TruncatedText 
                            text={job.employer_profile?.first_name && job.employer_profile?.last_name
                              ? `${job.employer_profile.first_name} ${job.employer_profile.last_name}`
                              : '-'}
                            className="text-sm truncate max-w-[100px] block mx-auto"
                          />
                        </TableCell>
                        <TableCell className="text-white text-center px-2 py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center justify-center gap-1.5 text-sm whitespace-nowrap">
                              <Calendar size={14} />
                              {formatDateShortSv(job.created_at)}
                            </div>
                            {/* Only show expiration info for active (published) jobs, not drafts */}
                            {job.is_active && (() => {
                              const timeInfo = getTimeRemaining(job.created_at, (job as JobPosting).expires_at);
                              return (
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`text-xs cursor-pointer ${timeInfo.isExpired ? 'text-red-400' : 'text-white'}`}>
                                        {timeInfo.isExpired ? 'Utgången' : `Utgår om: ${timeInfo.text}`}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-slate-900/95 border-white/20 text-white">
                                      <p className="text-xs">{formatExpirationDateTime(job.created_at, (job as JobPosting).expires_at)}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Hide edit button for expired active jobs, but always show for drafts */}
                            {(!job.is_active || !isJobExpiredCheck(job.created_at, (job as JobPosting).expires_at)) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // For drafts, use handleEditDraft to open the wizard
                                  if (!job.is_active) {
                                    handleEditDraft(job as JobPosting);
                                  } else {
                                    handleEditJob(job as any);
                                  }
                                }}
                                className="inline-flex items-center justify-center rounded-full border h-7 w-7 bg-white/5 backdrop-blur-[2px] border-white/20 text-white transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-brightness-110 active:scale-95"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(job as any);
                              }}
                              className="inline-flex items-center justify-center rounded-full border h-7 w-7 bg-white/5 backdrop-blur-[2px] border-white/20 text-white transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 hover:backdrop-brightness-110 active:scale-95"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );})

                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Desktop Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`flex items-center gap-1.5 text-white transition-colors ${page === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-70'}`}
                >
                  <span className="text-lg leading-none">‹</span>
                  <span>Föreg</span>
                </button>
                
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`px-1 text-white transition-colors ${page === n ? 'font-medium' : 'opacity-60 hover:opacity-100 cursor-pointer'}`}
                  >
                    {n}
                  </button>
                ))}
                
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`flex items-center gap-1.5 text-white transition-colors ${page === totalPages ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-70'}`}
                >
                  <span>Nästa</span>
                  <span className="text-lg leading-none">›</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile: Card view */}
          <div className="md:hidden">
            {loading ? (
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
                {searchTerm.trim() 
                  ? 'Inga annonser matchar din sökning' 
                  : 'Inga jobbannonser än. Skapa din första annons!'}
              </div>
            ) : (
              <>
                <div ref={listTopRef} />
                <div className="rounded-none bg-transparent ring-0 shadow-none">
                  <ScrollArea className="h-[calc(100vh-280px)] min-h-[320px]">
                    <div className="space-y-2 px-2 py-2 pb-24">
                      {pageJobs.map((job) => (
                        <MobileJobCard
                          key={job.id}
                          job={job as any}
                          onEdit={handleEditJob}
                          onDelete={handleDeleteClick}
                          onEditDraft={(j) => handleEditDraft(j as JobPosting)}
                          onPrefetch={prefetchJob}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-6 mt-3 text-xs">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`flex items-center gap-1.5 text-white transition-colors ${page === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-70'}`}
                    >
                      <span className="text-lg leading-none">‹</span>
                      <span>Föreg</span>
                    </button>
                    
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`px-1 text-white transition-colors ${page === n ? 'font-medium' : 'opacity-60 hover:opacity-100 cursor-pointer'}`}
                      >
                        {n}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className={`flex items-center gap-1.5 text-white transition-colors ${page === totalPages ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-70'}`}
                    >
                      <span>Nästa</span>
                      <span className="text-lg leading-none">›</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0 max-h-[90dvh] flex flex-col"
        >
          <AlertDialogHeader className="space-y-4 text-center flex-shrink-0">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort jobbannons
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <div className="overflow-y-auto flex-1 my-4">
            <AlertDialogDescription className="text-white text-sm leading-relaxed text-center">
              {jobToDelete && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">"{jobToDelete.title}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center flex-shrink-0">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setJobToDelete(null);
              }}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteJob}
              variant="destructiveSoft"
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

      <EditJobDialog
        job={editingJob}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onJobUpdated={invalidateJobs}
      />

      {/* Draft editing wizard */}
      {draftToEdit && (
        <MobileJobWizard
          open={draftWizardOpen}
          onOpenChange={(open) => {
            setDraftWizardOpen(open);
            if (!open) {
              setDraftToEdit(null);
            }
          }}
          jobTitle={draftToEdit.title}
          selectedTemplate={null}
          onJobCreated={() => {
            invalidateJobs();
            setDraftWizardOpen(false);
            setDraftToEdit(null);
          }}
          existingJob={draftToEdit}
        />
      )}
    </div>
  );
});

EmployerDashboard.displayName = 'EmployerDashboard';

export default EmployerDashboard;
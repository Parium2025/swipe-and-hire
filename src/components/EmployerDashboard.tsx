import { useState, memo, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Eye, MapPin, Calendar, Edit, Trash2, AlertTriangle, Briefcase, TrendingUp, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EditJobDialog from '@/components/EditJobDialog';
import { useJobsData, type JobPosting } from '@/hooks/useJobsData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';

import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
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
import { StatsGrid } from '@/components/StatsGrid';
import { JobSearchBar } from '@/components/JobSearchBar';
import { useJobFiltering } from '@/hooks/useJobFiltering';
import MobileJobWizard from '@/components/MobileJobWizard';
import { useJobPrefetch } from '@/hooks/useJobPrefetch';
import { JobStatusTabs } from '@/components/ui/job-status-tabs';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

type JobStatusTab = 'active' | 'expired' | 'draft';

/** Lightweight inline pagination — no external dependency, identical visual to previous inline version */
const SimplePagination = memo(({ page, totalPages, onPageChange, className = '' }: { page: number; totalPages: number; onPageChange: (p: number) => void; className?: string }) => (
  <div className={`flex items-center justify-center gap-6 text-xs ${className}`}>
    <button
      onClick={() => onPageChange(Math.max(1, page - 1))}
      disabled={page === 1}
      className={`flex items-center gap-1.5 text-white transition-colors ${page === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-70'}`}
    >
      <span className="text-lg leading-none">‹</span>
      <span>Föreg</span>
    </button>
    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(n => (
      <button
        key={n}
        onClick={() => onPageChange(n)}
        className={`px-1 text-white transition-colors ${page === n ? 'font-medium' : 'opacity-60 hover:opacity-100 cursor-pointer'}`}
      >
        {n}
      </button>
    ))}
    <button
      onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      disabled={page === totalPages}
      className={`flex items-center gap-1.5 text-white transition-colors ${page === totalPages ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-70'}`}
    >
      <span>Nästa</span>
      <span className="text-lg leading-none">›</span>
    </button>
  </div>
));
SimplePagination.displayName = 'SimplePagination';

const EmployerDashboard = memo(() => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingEditJobId, setPendingEditJobId] = useState<string | null>(null);
  const { user, profile, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications } = useAuth();
  const { toast } = useToast();
  
  // Prefetch job details on hover for instant navigation
  const { handleMouseEnter: prefetchJob, handleMouseLeave: cancelPrefetch } = useJobPrefetch();
  
  // State for editing drafts in wizard
  const [draftToEdit, setDraftToEdit] = useState<JobPosting | null>(null);
  const [draftWizardOpen, setDraftWizardOpen] = useState(false);
  const hasAutoRestoredEdit = useRef(false);

  // Auto-restore: if there was an active edit session, re-open the edit dialog
  useEffect(() => {
    if (hasAutoRestoredEdit.current || !jobs || jobs.length === 0) return;
    hasAutoRestoredEdit.current = true;
    
    try {
      const editSession = sessionStorage.getItem('parium-editing-job');
      if (editSession) {
        const parsed = JSON.parse(editSession);
        if (parsed.jobId) {
          const job = jobs.find(j => j.id === parsed.jobId);
          if (job) {
            console.log('🔄 Auto-restoring edit job dialog');
            // Don't remove session marker here — EditJobDialog will manage it
            setEditingJob(job);
            setEditDialogOpen(true);
          } else {
            sessionStorage.removeItem('parium-editing-job');
          }
        }
      }
    } catch (e) {
      console.warn('Failed to check for editing job session');
    }
  }, [jobs]);
  
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
  
  // Tab state synkad med URL (?tab=active|expired|draft)
  const tabParam = searchParams.get('tab') as JobStatusTab | null;
  const activeTab: JobStatusTab = tabParam === 'expired' || tabParam === 'draft' ? tabParam : 'active';
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
  
  // Pagination state for mobile
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const listTopRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  const editLaunchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (editLaunchTimeoutRef.current) {
        window.clearTimeout(editLaunchTimeoutRef.current);
      }
    };
  }, []);
  
  // Check if there are any drafts
  const hasDrafts = useMemo(() => jobs.some(job => !job.is_active), [jobs]);
  
  // Filter jobs by active tab BEFORE pagination
  const tabFilteredJobs = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return filteredAndSortedJobs.filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at));
      case 'expired':
        return filteredAndSortedJobs.filter(j => j.is_active && isJobExpiredCheck(j.created_at, j.expires_at));
      case 'draft':
        return filteredAndSortedJobs.filter(j => !j.is_active);
      default:
        return filteredAndSortedJobs;
    }
  }, [filteredAndSortedJobs, activeTab]);

  // Ordered tabs for swipe navigation
  const tabOrder: JobStatusTab[] = useMemo(() => hasDrafts ? ['active', 'expired', 'draft'] : ['active', 'expired'], [hasDrafts]);
  
  const swipeToNextTab = useCallback(() => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx < tabOrder.length - 1) setActiveTab(tabOrder[idx + 1]);
  }, [activeTab, tabOrder, setActiveTab]);
  
  const swipeToPrevTab = useCallback(() => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx > 0) setActiveTab(tabOrder[idx - 1]);
  }, [activeTab, tabOrder, setActiveTab]);
  
  const tabSwipeHandlers = useSwipeGesture({ onSwipeLeft: swipeToNextTab, onSwipeRight: swipeToPrevTab, threshold: 50 });
  
  // Reset page when tab changes
  useEffect(() => { setPage(1); }, [activeTab]);
  
  const totalPages = Math.max(1, Math.ceil(tabFilteredJobs.length / pageSize));
  const pageJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return tabFilteredJobs.slice(start, start + pageSize);
  }, [tabFilteredJobs, page]);
  
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


  const handleDeleteClick = (job: JobPosting) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;
    
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

  const handlePremiumEditOpen = useCallback((job: JobPosting, mode: 'draft' | 'published') => {
    if (pendingEditJobId) return;

    setPendingEditJobId(job.id);

    if (editLaunchTimeoutRef.current) {
      window.clearTimeout(editLaunchTimeoutRef.current);
    }

    editLaunchTimeoutRef.current = window.setTimeout(() => {
      if (mode === 'draft') {
        handleEditDraft(job);
      } else {
        handleEditJob(job);
      }

      setPendingEditJobId(null);
      editLaunchTimeoutRef.current = null;
    }, 150);
  }, [pendingEditJobId]);

  // Handle row click - drafts open wizard, active jobs go to details
  const handleJobRowClick = (job: JobPosting) => {
    if (!job.is_active) {
      handleEditDraft(job);
    } else {
      navigate(`/job-details/${job.id}`, { state: { fromRoute: '/my-jobs', fromTab: activeTab } });
    }
  };

  // Count active jobs for stats - exclude expired jobs from "Aktiva annonser" count
  // A job is "expired" if its expires_at has passed, regardless of is_active flag
  const activeJobs = useMemo(() => 
    jobs.filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at)), 
    [jobs]
  );
  
  // Count expired jobs — is_active AND expires_at passed (only published jobs that expired)
  const expiredJobsCount = useMemo(() => 
    jobs.filter(j => j.is_active && isJobExpiredCheck(j.created_at, j.expires_at)).length, 
    [jobs]
  );
  
  // Count draft jobs — is_active=false (all drafts, regardless of expiration)
  const draftJobsCount = useMemo(() => 
    jobs.filter(j => !j.is_active).length, 
    [jobs]
  );
  
  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Annonser', value: loading ? preloadedEmployerMyJobs : jobs.length, loading: false },
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
    { icon: Eye, title: 'Visningar', value: loading ? preloadedEmployerTotalViews : activeJobs.reduce((s, j) => s + j.views_count, 0), loading: false },
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

  // Always fade in on mount — symmetric with dashboard
  const fadeClass = 'animate-fade-in';

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

      {/* Status tabs: Aktiva / Utgångna / Utkast */}
      <div className="flex justify-center">
        <JobStatusTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeCount={activeJobs.length}
          expiredCount={expiredJobsCount}
          draftCount={draftJobsCount}
          showDrafts
        />
      </div>

      {/* Result indicator */}
      {searchTerm && (
        <div className="text-sm text-white mb-4">
          {tabFilteredJobs.length === 0 ? (
            <span>Inga annonser matchar din sökning</span>
          ) : (
            <span>
              Visar {tabFilteredJobs.length} av {jobs.length} annonser
            </span>
          )}
        </div>
      )}

      {/* Jobs Table */}
      {/* Desktop: Jobs Table inside Card */}
      <Card className="bg-white/5 border-0 hidden md:block" style={{ contain: 'layout style' }}>
        <CardHeader className="md:p-4">
          <CardTitle className="text-sm text-white md:text-left">
            Mina jobbannonser
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Desktop: Table view */}
          <div className="hidden md:block">
            <div className="w-full" style={{ contain: 'layout style' }}>
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
                {tabFilteredJobs.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="text-center !text-white py-8 font-medium text-sm">
                        {searchTerm.trim() 
                          ? 'Inga annonser matchar din sökning' 
                          : activeTab === 'active' ? 'Inga aktiva jobbannonser. Skapa din första annons!'
                          : activeTab === 'expired' ? 'Inga utgångna jobbannonser.'
                          : 'Inga utkast.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageJobs.map((job) => {
                      const isExpired = isJobExpiredCheck(job.created_at, job.expires_at);
                      const isDraft = !job.is_active && !isExpired;
                      
                      return (
                      <TableRow 
                        key={job.id}
                        className={`group border-white/10 cursor-pointer transition-[background-color] duration-150 ${
                          isExpired 
                            ? "hover:bg-red-500/10" 
                            : isDraft 
                              ? "hover:bg-amber-500/10"
                              : "hover:bg-green-500/10"
                        }`}
                        style={{ contain: 'layout style paint' }}
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
                                <Badge variant="glass" className="whitespace-nowrap text-xs bg-red-500/60 border-red-400/60 text-white">
                                   Utgången
                                 </Badge>
                               ) : (
                                 <Badge variant="glass" className="text-xs bg-green-500/60 border-green-500/60 text-white">
                                   Aktiv
                                 </Badge>
                               )
                             ) : (
                               <Badge variant="glass" className="text-xs bg-yellow-500/60 border-yellow-500/60 text-white">
                                 Utkast
                               </Badge>
                             )}
                           </div>
                         </TableCell>
                         <TableCell className="text-center px-2 py-3">
                           <Badge variant="glass" className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                             {job.views_count || 0}
                           </Badge>
                         </TableCell>
                         <TableCell className="text-center px-2 py-3">
                           <Badge variant="glass" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
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
                                  if (!job.is_active) {
                                    handleEditDraft(job as JobPosting);
                                  } else {
                                    handleEditJob(job as JobPosting);
                                  }
                                }}
                                className="inline-flex items-center justify-center rounded-full border h-7 w-7 bg-white/5 border-white/20 text-white transition-[background-color,border-color] duration-150 hover:bg-white/15 hover:border-white/50 active:scale-95"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(job as JobPosting);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-destructive/40 bg-destructive/20 text-white transition-[background-color,border-color,color] duration-150 md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white active:scale-95"
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
              <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mobile: Card view — outside Card wrapper for edge-to-edge layout */}
      <div className="md:hidden touch-pan-y" onTouchStart={tabSwipeHandlers.onTouchStart} onTouchMove={tabSwipeHandlers.onTouchMove} onTouchEnd={tabSwipeHandlers.onTouchEnd}>
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
            ) : tabFilteredJobs.length === 0 ? (
              <div className="text-center text-white py-8 font-medium text-sm min-h-[40vh]  flex items-center justify-center">
                <span>
                {searchTerm.trim() 
                  ? 'Inga annonser matchar din sökning' 
                  : activeTab === 'active' ? 'Inga aktiva jobbannonser. Skapa din första annons!'
                  : activeTab === 'expired' ? 'Inga utgångna jobbannonser.'
                  : 'Inga utkast.'}
                </span>
              </div>
            ) : (
              <>
                <div ref={listTopRef} />
                    <div className="job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
                      {pageJobs.map((job) => {
                        const jobPosting = job as JobPosting;
                        const isExpired = isJobExpiredCheck(job.created_at, jobPosting.expires_at);
                        const isDraft = !job.is_active && !isExpired;
                        return (
                          <ReadOnlyMobileJobCard
                            key={job.id}
                            job={job as JobPosting & { company_name?: string }}
                            hideSaveButton
                            onCardClick={(jobId) => {
                              if (isDraft) {
                                handleEditDraft(jobPosting);
                              } else {
                                navigate(`/job-details/${jobId}`, { state: { fromRoute: '/my-jobs', fromTab: activeTab } });
                              }
                            }}
                            footer={
                              <div className={`flex items-center gap-2 pt-0.5 ${isExpired && !isDraft ? 'justify-center' : ''}`}>
                                {(!isExpired || isDraft) && (
                                  <button
                                    className={`flex-1 inline-flex min-h-[var(--control-height-sm)] items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 text-sm font-medium text-white transition-[transform,opacity,background-color] duration-200 active:scale-[0.97] md:hover:bg-white/10 ${pendingEditJobId === job.id ? 'pointer-events-none opacity-70' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePremiumEditOpen(jobPosting, isDraft ? 'draft' : 'published');
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                    {pendingEditJobId === job.id ? 'Öppnar...' : 'Redigera'}
                                  </button>
                                )}
                                <button
                                  className={`${isExpired && !isDraft ? 'px-8' : 'flex-1 px-4'} inline-flex min-h-[var(--control-height-sm)] items-center justify-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/20 text-sm font-medium text-white transition-colors duration-150 active:scale-[0.97] md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(jobPosting);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Ta bort
                                </button>
                              </div>
                            }
                          />
                        );
                      })}
                    </div>

                {totalPages > 1 && (
                  <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-3" />
                )}
              </>
            )}
          </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0 max-h-[90dvh] flex flex-col"
        >
          <AlertDialogHeader className="space-y-4 text-center flex-shrink-0">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
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
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteJob}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
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
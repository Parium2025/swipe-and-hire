import { useState, memo, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { formatDateShortSv } from '@/lib/date';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const EmployerDashboard = memo(() => {
  const navigate = useNavigate();
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  // State for editing drafts in wizard
  const [draftToEdit, setDraftToEdit] = useState<JobPosting | null>(null);
  const [draftWizardOpen, setDraftWizardOpen] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);
  
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

  // Validate if a job has all required fields to be activated
  const isJobComplete = (job: JobPosting): boolean => {
    const requiredFields = [
      job.title,
      job.description,
      job.salary_type,
      job.salary_transparency,
      job.work_start_time,
      job.work_end_time,
      job.positions_count,
      job.location || job.workplace_city,
    ];
    
    return requiredFields.every(field => field !== null && field !== undefined && field !== '');
  };

  // Get missing fields for tooltip
  const getMissingFields = (job: JobPosting): string[] => {
    const missing: string[] = [];
    if (!job.title) missing.push('Jobbtitel');
    if (!job.description) missing.push('Jobbeskrivning');
    if (!job.salary_type) missing.push('Lönetyp');
    if (!job.salary_transparency) missing.push('Lönetransparens');
    if (!job.work_start_time || !job.work_end_time) missing.push('Arbetstider');
    if (!job.positions_count) missing.push('Antal tjänster');
    if (!job.location && !job.workplace_city) missing.push('Plats');
    return missing;
  };

  const toggleJobStatus = async (jobId: string, currentStatus: boolean, job: JobPosting) => {
    // If trying to activate, check if job is complete
    if (!currentStatus && !isJobComplete(job)) {
      const missing = getMissingFields(job);
      toast({
        title: "Kan inte aktivera annons",
        description: `Följande fält saknas: ${missing.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('job_postings')
        .update({ is_active: !currentStatus })
        .eq('id', jobId);

      if (error) {
        toast({
          title: "Fel vid uppdatering",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Status uppdaterad",
        description: `Annonsen är nu ${!currentStatus ? 'aktiv' : 'inaktiv'}.`
      });

      invalidateJobs();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte uppdatera annonsens status.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (job: JobPosting) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      const { error } = await supabase
        .from('job_postings')
        .delete()
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
    // First reset wizard state completely by unmounting
    setDraftToEdit(null);
    setDraftWizardOpen(false);
    
    // Then open with fresh state in next frame
    requestAnimationFrame(() => {
      setWizardKey(prev => prev + 1);
      setDraftToEdit(job);
      setDraftWizardOpen(true);
    });
  };

  // Handle row click - drafts open wizard, active jobs go to details
  const handleJobRowClick = (job: JobPosting) => {
    if (!job.is_active) {
      handleEditDraft(job);
    } else {
      navigate(`/job-details/${job.id}`);
    }
  };

  // Count active jobs for stats, but "Mina annonser" shows all jobs (including drafts)
  const activeJobs = useMemo(() => jobs.filter(j => j.is_active), [jobs]);
  
  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Mina annonser', value: jobs.length, loading: false },
    { icon: TrendingUp, title: 'Aktiva annonser', value: activeJobs.length, loading: false },
    { icon: Eye, title: 'Totala visningar', value: activeJobs.reduce((s, j) => s + j.views_count, 0), loading: false },
    { icon: Users, title: 'Ansökningar', value: activeJobs.reduce((s, j) => s + j.applications_count, 0), loading: false },
  ], [jobs, activeJobs]);

  // Wait for data before showing content with fade
  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12 opacity-0">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12 animate-fade-in">
      <div className="flex justify-center items-center mb-4">
        <h1 className="text-xl md:text-2xl font-semibold text-white">Mina jobbannonser</h1>
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
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-white/60 py-8 text-sm">
                        Laddar...
                      </TableCell>
                    </TableRow>
                  ) : filteredAndSortedJobs.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="text-center !text-white py-8 font-medium text-sm">
                        {searchTerm.trim() 
                          ? 'Inga annonser matchar din sökning' 
                          : sortBy === 'drafts-only' 
                            ? 'Inga utkast finns.' 
                            : 'Inga jobbannonser än. Skapa din första annons!'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageJobs.map((job) => (
                      <TableRow 
                        key={job.id}
                        className={`border-white/10 cursor-pointer transition-colors ${
                          job.is_active 
                            ? "hover:bg-white/5" 
                            : "hover:bg-amber-500/10"
                        }`}
                        onClick={() => handleJobRowClick(job as JobPosting)}
                      >
                        <TableCell className="font-medium text-white text-center px-2 py-3 overflow-hidden">
                          <JobTitleCell title={job.title} employmentType={job.employment_type} />
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge
                              variant={job.is_active ? "default" : "secondary"}
                              className={`text-sm whitespace-nowrap ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30"}`}
                            >
                              {job.is_active ? 'Aktiv' : 'Utkast'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-sm">
                            {job.views_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-sm">
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
                          <div className="flex items-center justify-center gap-1.5 text-sm whitespace-nowrap">
                            <Calendar size={14} />
                            {formatDateShortSv(job.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {!job.is_active && !isJobComplete(job as JobPosting) ? (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <Switch
                                        checked={job.is_active}
                                        disabled
                                        className="scale-[0.8] cursor-pointer [&>span]:bg-amber-500 opacity-100"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs bg-slate-900/95 border-white/20 text-white">
                                    <p className="text-xs font-medium mb-1">Saknade fält:</p>
                                    <p className="text-xs text-white/80">{getMissingFields(job as JobPosting).join(', ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Switch
                                checked={job.is_active}
                                onCheckedChange={() => toggleJobStatus(job.id, job.is_active, job as JobPosting)}
                                onClick={(e) => e.stopPropagation()}
                                className="scale-[0.8]"
                              />
                            )}
                            <Button 
                              variant="outlineNeutral" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // For drafts, use handleEditDraft to open the wizard
                                if (!job.is_active) {
                                  handleEditDraft(job as JobPosting);
                                } else {
                                  handleEditJob(job as any);
                                }
                              }}
                              className="h-7 w-7 p-0 bg-transparent border-white/20 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/40 [&_svg]:text-white md:hover:[&_svg]:text-white"
                            >
                              <Edit size={14} />
                            </Button>
                            <Button 
                              variant="outlineNeutral" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(job as any);
                              }}
                              className="h-7 w-7 p-0 bg-transparent border-white/20 text-white !hover:bg-red-500/20 md:hover:!bg-red-500/20 !hover:border-red-500/40 md:hover:!border-red-500/40 hover:!text-white md:hover:!text-white"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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
              <div className="text-center text-white/60 py-8 text-sm">
                Laddar...
              </div>
            ) : filteredAndSortedJobs.length === 0 ? (
              <div className="text-center text-white py-8 font-medium text-sm">
                {searchTerm.trim() 
                  ? 'Inga annonser matchar din sökning' 
                  : sortBy === 'drafts-only' 
                    ? 'Inga utkast finns.' 
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
                          onToggleStatus={toggleJobStatus}
                          onEdit={handleEditJob}
                          onDelete={handleDeleteClick}
                          onEditDraft={(j) => handleEditDraft(j as JobPosting)}
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
        <AlertDialogContent className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0">
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort jobbannons
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed break-words">
              {jobToDelete && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white break-words">"{jobToDelete.title}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setJobToDelete(null);
              }}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-[0.6] mt-0 flex items-center justify-center bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteJob}
              variant="destructiveSoft"
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-[0.4] text-sm flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
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
          key={`wizard-${wizardKey}`}
          open={draftWizardOpen}
          onOpenChange={(open) => {
            setDraftWizardOpen(open);
            if (!open) {
              // Increment key immediately when closing to force fresh component on next open
              setWizardKey(prev => prev + 1);
              setDraftToEdit(null);
            }
          }}
          jobTitle={draftToEdit.title}
          selectedTemplate={null}
          onJobCreated={() => {
            invalidateJobs();
            setDraftWizardOpen(false);
            setWizardKey(prev => prev + 1);
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
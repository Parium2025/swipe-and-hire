import { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { Eye, MessageCircle, MapPin, Calendar, Edit, Trash2, AlertTriangle } from 'lucide-react';
import EditJobDialog from '@/components/EditJobDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobsData, type JobPosting } from '@/hooks/useJobsData';
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

const EmployerDashboard = memo(() => {
  const navigate = useNavigate();
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
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
    console.log('[MyJobs] Open edit for job:', { id: job.id, title: job.title });
    setEditingJob(job);
    setEditDialogOpen(true);
  };


  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return '';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return '';
  };


  return (
    <div className="space-y-4 sm:space-y-6 pb-safe min-h-screen smooth-scroll touch-pan no-overscroll" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="text-center px-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Mina jobbannonser</h1>
        <p className="text-white mt-1 text-xs sm:text-sm md:text-base">
          Hantera dina publicerade tjänster
        </p>
      </div>

      {/* Stats Overview - med skeleton när loading */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardDescription className="text-white text-xs sm:text-sm">Totalt annonser</CardDescription>
            {loading ? (
              <Skeleton className="h-6 sm:h-8 w-12 sm:w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-xl sm:text-2xl text-white">{jobs.length}</CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardDescription className="text-white text-xs sm:text-sm">Aktiva annonser</CardDescription>
            {loading ? (
              <Skeleton className="h-6 sm:h-8 w-12 sm:w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-xl sm:text-2xl text-white">
                {jobs.filter(job => job.is_active).length}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 sm:col-span-2 md:col-span-1">
          <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardDescription className="text-white text-xs sm:text-sm">Totala visningar</CardDescription>
            {loading ? (
              <Skeleton className="h-6 sm:h-8 w-12 sm:w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-xl sm:text-2xl text-white">
                {jobs.reduce((sum, job) => sum + job.views_count, 0)}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Job Listings - med skeleton när loading */}
      <div className="space-y-3 sm:space-y-4">
        {loading ? (
          // Loading skeleton - 3 placeholder cards
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-1/3 bg-white/20" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-20 bg-white/20" />
                      <Skeleton className="h-4 w-20 bg-white/20" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-12 bg-white/20" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full bg-white/20 mb-2" />
                <Skeleton className="h-4 w-2/3 bg-white/20 mb-4" />
                <div className="flex justify-between">
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-16 bg-white/20" />
                    <Skeleton className="h-4 w-16 bg-white/20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 bg-white/20" />
                    <Skeleton className="h-8 w-20 bg-white/20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : jobs.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2 text-white">Inga annonser än</h3>
              <p className="text-white mb-4">
                Skapa din första jobbannons för att komma igång med rekrytering
              </p>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card 
              key={job.id} 
              className="bg-white/10 backdrop-blur-sm border-white/20 cursor-pointer hover:bg-white/15 transition-colors"
              onClick={() => navigate(`/job-details/${job.id}`)}
            >
              <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="flex-1 w-full">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base sm:text-lg md:text-xl text-white leading-tight flex-1">{job.title}</CardTitle>
                        <Badge variant={job.is_active ? "default" : "secondary"} className="text-xs whitespace-nowrap">
                          {job.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white">
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="sm:w-3.5 sm:h-3.5" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{job.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="sm:w-3.5 sm:h-3.5" />
                          {new Date(job.created_at).toLocaleDateString('sv-SE')}
                        </div>
                        {job.employment_type && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs bg-white/10 text-white border-white px-1.5 py-0">
                            {getEmploymentTypeLabel(job.employment_type)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <Switch
                      checked={job.is_active}
                      onCheckedChange={() => toggleJobStatus(job.id, job.is_active)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 pt-0">
                <p className="text-xs sm:text-sm text-white mb-3 sm:mb-4 line-clamp-2">
                  {job.description}
                </p>
                
                {formatSalary(job.salary_min, job.salary_max) && (
                  <p className="text-xs sm:text-sm font-medium mb-3 sm:mb-4 text-white">
                    {formatSalary(job.salary_min, job.salary_max)}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-white">
                    <div className="flex items-center gap-1">
                      <Eye size={12} className="sm:w-3.5 sm:h-3.5" />
                      <span className="whitespace-nowrap">{job.views_count} visningar</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle size={12} className="sm:w-3.5 sm:h-3.5" />
                      <span className="whitespace-nowrap">{job.applications_count} intresserade</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditJob(job);
                      }}
                      className="flex-1 sm:flex-none bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-150 active:scale-95 min-h-[44px] text-xs sm:text-sm"
                    >
                      <Edit size={14} className="mr-1" />
                      Redigera
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(job);
                      }}
                      className="flex-1 sm:flex-none bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-100 transition-all duration-150 active:scale-95 min-h-[44px] text-xs sm:text-sm"
                    >
                      <Trash2 size={14} className="mr-1" />
                      Ta bort
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-white/20 text-white max-w-md w-[28rem] p-6 bg-gradient-to-br from-[hsl(215,100%,12%)] to-[hsl(215,90%,15%)] backdrop-blur-md rounded-xl shadow-2xl">
          <AlertDialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base font-semibold">
                Ta bort jobbannons
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {jobToDelete && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white">"{jobToDelete.title}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setJobToDelete(null);
              }}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteJob}
              className="bg-red-500 hover:bg-red-600 text-white border-0 text-sm"
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
    </div>
  );
});

EmployerDashboard.displayName = 'EmployerDashboard';

export default EmployerDashboard;
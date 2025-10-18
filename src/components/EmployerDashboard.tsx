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
    <div className="space-y-3 pb-safe min-h-screen smooth-scroll touch-pan no-overscroll" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="text-center px-2">
        <h1 className="text-xl font-bold text-white">Mina jobbannonser</h1>
        <p className="text-white mt-1 text-xs">
          Hantera dina publicerade tjänster
        </p>
      </div>

      {/* Stats Overview - med skeleton när loading */}
      <div className="grid gap-2 grid-cols-1">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-1 px-2.5 pt-2.5">
            <CardDescription className="text-white text-[11px]">Totalt annonser</CardDescription>
            {loading ? (
              <Skeleton className="h-5 w-10 bg-white/20" />
            ) : (
              <CardTitle className="text-lg text-white">{jobs.length}</CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-1 px-2.5 pt-2.5">
            <CardDescription className="text-white text-[11px]">Aktiva annonser</CardDescription>
            {loading ? (
              <Skeleton className="h-5 w-10 bg-white/20" />
            ) : (
              <CardTitle className="text-lg text-white">
                {jobs.filter(job => job.is_active).length}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-1 px-2.5 pt-2.5">
            <CardDescription className="text-white text-[11px]">Totala visningar</CardDescription>
            {loading ? (
              <Skeleton className="h-5 w-10 bg-white/20" />
            ) : (
              <CardTitle className="text-lg text-white">
                {jobs.reduce((sum, job) => sum + job.views_count, 0)}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Job Listings - med skeleton när loading */}
      <div className="space-y-2.5">
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
              <CardHeader className="px-2.5 py-2.5">
                <div className="flex flex-col justify-between items-start gap-2">
                  <div className="flex-1 w-full">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base text-white leading-tight flex-1">{job.title}</CardTitle>
                        <Badge variant={job.is_active ? "default" : "secondary"} className="text-xs whitespace-nowrap">
                          {job.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-white">
                        <div className="flex items-center gap-1">
                          <MapPin size={12} />
                          <span className="truncate max-w-[120px]">{job.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(job.created_at).toLocaleDateString('sv-SE')}
                        </div>
                        {job.employment_type && (
                          <Badge variant="outline" className="text-[10px] bg-white/10 text-white border-white px-1.5 py-0">
                            {getEmploymentTypeLabel(job.employment_type)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={job.is_active}
                      onCheckedChange={() => toggleJobStatus(job.id, job.is_active)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-2.5 py-2.5 pt-0">
                <p className="text-xs text-white mb-2 line-clamp-2">
                  {job.description}
                </p>
                
                {formatSalary(job.salary_min, job.salary_max) && (
                  <p className="text-xs font-medium mb-2 text-white">
                    {formatSalary(job.salary_min, job.salary_max)}
                  </p>
                )}

                <div className="flex flex-col items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-xs text-white">
                    <div className="flex items-center gap-1">
                      <Eye size={12} />
                      <span className="whitespace-nowrap">{job.views_count} visningar</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle size={12} />
                      <span className="whitespace-nowrap">{job.applications_count} intresserade</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditJob(job);
                      }}
                      className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-150 active:scale-95 min-h-[44px] text-xs"
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
                      className="flex-1 bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-100 transition-all duration-150 active:scale-95 min-h-[44px] text-xs"
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
          <AlertDialogFooter className="gap-2 mt-4">
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
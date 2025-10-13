import { useState, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { Eye, MessageCircle, MapPin, Calendar, Edit, Trash2 } from 'lucide-react';
import EditJobDialog from '@/components/EditJobDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobsData, type JobPosting } from '@/hooks/useJobsData';

const EmployerDashboard = memo(() => {
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
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

  const deleteJob = async (jobId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna annons?')) return;

    try {
      const { error } = await supabase
        .from('job_postings')
        .delete()
        .eq('id', jobId);

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
    <div className="space-y-6 px-4 py-6 sm:px-6 pb-safe min-h-screen smooth-scroll touch-pan no-overscroll" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Mina jobbannonser</h1>
        <p className="text-white mt-1 text-sm sm:text-base">
          Hantera dina publicerade tjänster
        </p>
      </div>

      {/* Stats Overview - med skeleton när loading */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-white">Totalt annonser</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-2xl text-white">{jobs.length}</CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-white">Aktiva annonser</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-2xl text-white">
                {jobs.filter(job => job.is_active).length}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-white">Totala visningar</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/20" />
            ) : (
              <CardTitle className="text-2xl text-white">
                {jobs.reduce((sum, job) => sum + job.views_count, 0)}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Job Listings - med skeleton när loading */}
      <div className="space-y-4">
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
            <Card key={job.id} className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl text-white">{job.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-white">
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(job.created_at).toLocaleDateString('sv-SE')}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Badge variant={job.is_active ? "default" : "secondary"}>
                      {job.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                    {job.employment_type && (
                      <Badge variant="outline" className="text-xs bg-white/10 text-white border-white/20">
                        {getEmploymentTypeLabel(job.employment_type)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={job.is_active}
                      onCheckedChange={() => toggleJobStatus(job.id, job.is_active)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white mb-4 line-clamp-2">
                  {job.description}
                </p>
                
                {formatSalary(job.salary_min, job.salary_max) && (
                  <p className="text-sm font-medium mb-4 text-white">
                    {formatSalary(job.salary_min, job.salary_max)}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-white">
                    <div className="flex items-center gap-1">
                      <Eye size={14} />
                      {job.views_count} visningar
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle size={14} />
                      {job.applications_count} intresserade
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditJob(job)}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-150 active:scale-95"
                    >
                      <Edit size={14} className="mr-1" />
                      Redigera
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteJob(job.id)}
                      className="bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-100 transition-all duration-150 active:scale-95"
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
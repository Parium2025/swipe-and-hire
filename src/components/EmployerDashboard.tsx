import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { Eye, MessageCircle, MapPin, Calendar, Edit, Trash2 } from 'lucide-react';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import EditJobDialog from '@/components/EditJobDialog';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  employment_type?: string;
  work_schedule?: string;
  contact_email?: string;
  application_instructions?: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
}

const EmployerDashboard = () => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const fetchJobs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('job_postings')
        .select('*')
        .eq('employer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Fel vid hämtning av annonser",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      setJobs(data || []);
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte hämta jobbannonser.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

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

      fetchJobs();
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

      fetchJobs();
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


  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return '';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl">Laddar dina annonser...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Mina jobbannonser</h1>
        <p className="text-white/90 mt-1">
          Hantera dina publicerade tjänster
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/70">Totalt annonser</CardDescription>
            <CardTitle className="text-2xl text-white">{jobs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/70">Aktiva annonser</CardDescription>
            <CardTitle className="text-2xl text-white">
              {jobs.filter(job => job.is_active).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/70">Totala visningar</CardDescription>
            <CardTitle className="text-2xl text-white">
              {jobs.reduce((sum, job) => sum + job.views_count, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Job Listings */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2 text-white">Inga annonser än</h3>
              <p className="text-white/70 mb-4">
                Skapa din första jobbannons för att komma igång med rekrytering.
              </p>
              <div className="flex justify-center">
                <CreateJobSimpleDialog onJobCreated={fetchJobs} />
              </div>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-xl text-white">{job.title}</CardTitle>
                      <Badge variant={job.is_active ? "default" : "secondary"}>
                        {job.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-white/70">
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(job.created_at).toLocaleDateString('sv-SE')}
                      </div>
                      {job.employment_type && (
                        <Badge variant="outline" className="text-xs bg-white/10 text-white border-white/20">
                          {getEmploymentTypeLabel(job.employment_type)}
                        </Badge>
                      )}
                    </div>
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
                <p className="text-sm text-white/80 mb-4 line-clamp-2">
                  {job.description}
                </p>
                
                {formatSalary(job.salary_min, job.salary_max) && (
                  <p className="text-sm font-medium mb-4 text-white">
                    {formatSalary(job.salary_min, job.salary_max)}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-white/70">
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
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <Edit size={14} className="mr-1" />
                      Redigera
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteJob(job.id)}
                      className="bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-100"
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
        onJobUpdated={fetchJobs}
      />
    </div>
  );
};

export default EmployerDashboard;
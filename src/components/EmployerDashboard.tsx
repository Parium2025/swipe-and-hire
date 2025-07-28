import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Eye, MessageCircle, MapPin, Calendar, Edit, Trash2 } from 'lucide-react';
import CreateJobDialog from '@/components/CreateJobDialog';

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
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
}

const EmployerDashboard = () => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
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

  const getEmploymentTypeLabel = (type?: string) => {
    const types: Record<string, string> = {
      full_time: 'Heltid',
      part_time: 'Deltid',
      contract: 'Konsult',
      temporary: 'Tillfällig',
      internship: 'Praktik'
    };
    return type ? types[type] || type : '';
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Mina jobbannonser</h1>
          <p className="text-muted-foreground mt-1">
            Hantera dina publicerade tjänster
          </p>
        </div>
        <CreateJobDialog onJobCreated={fetchJobs} />
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totalt annonser</CardDescription>
            <CardTitle className="text-2xl">{jobs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktiva annonser</CardDescription>
            <CardTitle className="text-2xl">
              {jobs.filter(job => job.is_active).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totala visningar</CardDescription>
            <CardTitle className="text-2xl">
              {jobs.reduce((sum, job) => sum + job.views_count, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Job Listings */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Inga annonser än</h3>
              <p className="text-muted-foreground mb-4">
                Skapa din första jobbannons för att komma igång med rekrytering.
              </p>
              <CreateJobDialog onJobCreated={fetchJobs} />
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-xl">{job.title}</CardTitle>
                      <Badge variant={job.is_active ? "default" : "secondary"}>
                        {job.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(job.created_at).toLocaleDateString('sv-SE')}
                      </div>
                      {job.employment_type && (
                        <Badge variant="outline" className="text-xs">
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
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {job.description}
                </p>
                
                {formatSalary(job.salary_min, job.salary_max) && (
                  <p className="text-sm font-medium mb-4">
                    {formatSalary(job.salary_min, job.salary_max)}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                    <Button variant="outline" size="sm">
                      <Edit size={14} className="mr-1" />
                      Redigera
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteJob(job.id)}
                      className="text-destructive hover:text-destructive"
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
    </div>
  );
};

export default EmployerDashboard;
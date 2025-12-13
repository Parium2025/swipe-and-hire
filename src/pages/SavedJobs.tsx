import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, MapPin, Building2, Briefcase, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SavedJob {
  id: string;
  job_id: string;
  created_at: string;
  job_postings: {
    id: string;
    title: string;
    location: string | null;
    workplace_city: string | null;
    workplace_county: string | null;
    employment_type: string | null;
    job_image_url: string | null;
    is_active: boolean;
    created_at: string;
    profiles: {
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
}

const getEmploymentTypeLabel = (type: string | null): string => {
  const labels: Record<string, string> = {
    fulltime: 'Heltid',
    parttime: 'Deltid',
    temporary: 'Visstid',
    internship: 'Praktik',
    freelance: 'Frilans',
  };
  return type ? labels[type] || type : '';
};

const SavedJobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchSavedJobs();
    }
  }, [user]);

  const fetchSavedJobs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_jobs')
        .select(`
          id,
          job_id,
          created_at,
          job_postings (
            id,
            title,
            location,
            workplace_city,
            workplace_county,
            employment_type,
            job_image_url,
            is_active,
            created_at,
            profiles (
              company_name,
              first_name,
              last_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedJobs((data as unknown as SavedJob[]) || []);
    } catch (err) {
      console.error('Error fetching saved jobs:', err);
      toast.error('Kunde inte hämta sparade jobb');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSavedJob = async (savedJobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setRemovingIds(prev => new Set(prev).add(savedJobId));
    
    try {
      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('id', savedJobId);

      if (error) throw error;

      setSavedJobs(prev => prev.filter(job => job.id !== savedJobId));
      toast.success('Jobb borttaget från sparade');
    } catch (err) {
      console.error('Error removing saved job:', err);
      toast.error('Kunde inte ta bort jobbet');
    } finally {
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(savedJobId);
        return next;
      });
    }
  };

  const handleJobClick = (jobId: string) => {
    navigate(`/job-view/${jobId}`);
  };

  const getLocation = (job: SavedJob['job_postings']) => {
    if (!job) return '';
    if (job.workplace_city && job.workplace_county) {
      return `${job.workplace_city}, ${job.workplace_county}`;
    }
    return job.workplace_city || job.location || '';
  };

  const getCompanyName = (job: SavedJob['job_postings']) => {
    if (!job?.profiles) return 'Företag';
    return job.profiles.company_name || 
           `${job.profiles.first_name || ''} ${job.profiles.last_name || ''}`.trim() || 
           'Företag';
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-3 md:px-6 py-6 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-white mb-2">Sparade Jobb</h1>
          <p className="text-white">Dina favorit-jobb samlade på ett ställe</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 bg-white/10 mb-2" />
                <Skeleton className="h-4 w-1/2 bg-white/10 mb-2" />
                <Skeleton className="h-4 w-1/3 bg-white/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-6 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-xl md:text-2xl font-semibold text-white mb-2">Sparade Jobb</h1>
        <p className="text-white">Dina favorit-jobb samlade på ett ställe</p>
      </div>

      {savedJobs.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center">
            <Heart className="h-12 w-12 text-white/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Inga sparade jobb än</h3>
            <p className="text-white/70 mb-4">
              När du hittar intressanta jobb kan du spara dem här för enkel åtkomst
            </p>
            <Button
              onClick={() => navigate('/search-jobs')}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              Sök jobb
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {savedJobs.map((savedJob) => {
            const job = savedJob.job_postings;
            if (!job) return null;

            const isRemoving = removingIds.has(savedJob.id);

            return (
              <Card
                key={savedJob.id}
                className={`bg-white/5 border-white/10 hover:border-white/30 transition-all cursor-pointer ${
                  isRemoving ? 'opacity-50' : ''
                }`}
                onClick={() => handleJobClick(job.id)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title and status */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {job.title}
                        </h3>
                        {!job.is_active && (
                          <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                            Utgången
                          </Badge>
                        )}
                      </div>

                      {/* Company */}
                      <div className="flex items-center gap-2 text-white mb-2">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{getCompanyName(job)}</span>
                      </div>

                      {/* Location and type */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-white">
                        {getLocation(job) && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{getLocation(job)}</span>
                          </div>
                        )}
                        {job.employment_type && (
                          <div className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Sparad {new Date(savedJob.created_at).toLocaleDateString('sv-SE')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleRemoveSavedJob(savedJob.id, e)}
                      disabled={isRemoving}
                      className="text-white/50 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedJobs;

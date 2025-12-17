import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MapPin, Building2, Briefcase, Clock, Trash2, Timer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';

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
    expires_at: string | null;
    profiles: {
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
}


const getDaysRemaining = (expiresAt: string | null): number | null => {
  if (!expiresAt) return null;
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffTime = expires.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const fetchSavedJobs = async (userId: string): Promise<SavedJob[]> => {
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
        expires_at,
        profiles (
          company_name,
          first_name,
          last_name
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as SavedJob[]) || [];
};

const SavedJobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Show cached data immediately, refresh silently in background
  const { data: savedJobs = [], isLoading, isFetched } = useQuery({
    queryKey: ['saved-jobs', user?.id],
    queryFn: () => fetchSavedJobs(user!.id),
    enabled: !!user,
    staleTime: 0, // Always refetch in background when returning
    gcTime: Infinity, // Keep in cache forever
    refetchOnWindowFocus: false, // Don't refetch on tab focus
  });

  const handleRemoveSavedJob = async (savedJobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setRemovingIds(prev => new Set(prev).add(savedJobId));
    
    try {
      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('id', savedJobId);

      if (error) throw error;

      // Update cache optimistically
      queryClient.setQueryData(['saved-jobs', user?.id], (old: SavedJob[] | undefined) => 
        old?.filter(job => job.id !== savedJobId) || []
      );
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

  const handleJobClick = (jobId: string, isActive: boolean) => {
    if (!isActive) {
      toast.info('Det här jobbet är inte längre tillgängligt');
      return;
    }
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

  // Only show loading on initial load (when no cached data exists)
  const showLoading = isLoading && !isFetched && savedJobs.length === 0;

  if (showLoading) {
    return (
      <div className="max-w-4xl mx-auto px-3 md:px-6 py-6">
        <div className="text-center mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Sparade Jobb</h1>
          <p className="text-sm text-white">Dina favorit-jobb samlade på ett ställe</p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-6 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Sparade Jobb</h1>
        <p className="text-sm text-white">Dina favorit-jobb samlade på ett ställe</p>
      </div>

      {savedJobs.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center">
            <Heart className="h-12 w-12 text-white mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Inga sparade jobb än</h3>
            <p className="text-white mb-4">
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
            const isExpired = !job.is_active;
            const daysRemaining = getDaysRemaining(job.expires_at);
            const showCountdown = job.is_active && daysRemaining !== null && daysRemaining <= 7;

            return (
              <Card
                key={savedJob.id}
                className={`border-white/10 transition-all cursor-pointer ${
                  isRemoving ? 'opacity-50' : ''
                } ${
                  isExpired 
                    ? 'bg-white/[0.02] opacity-60 hover:opacity-80' 
                    : 'bg-white/5 hover:border-white/30'
                }`}
                onClick={() => handleJobClick(job.id, job.is_active)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title and status */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className={`text-lg font-semibold truncate ${isExpired ? 'text-white' : 'text-white'}`}>
                          {job.title}
                        </h3>
                        {isExpired && (
                          <Badge variant="secondary" className="bg-red-500/20 text-white border-red-500/30 text-xs hover:bg-red-500/30 hover:border-red-500/50 transition-all duration-300">
                            Utgången
                          </Badge>
                        )}
                        {showCountdown && (
                          <Badge variant="secondary" className="bg-white/10 text-white border-white/20 text-xs">
                            <Timer className="h-3 w-3 mr-1" />
                            {daysRemaining === 1 ? '1 dag kvar' : `${daysRemaining} dagar kvar`}
                          </Badge>
                        )}
                      </div>

                      {/* Company */}
                      <div className={`flex items-center gap-2 mb-2 ${isExpired ? 'text-white' : 'text-white'}`}>
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{getCompanyName(job)}</span>
                      </div>

                      {/* Location and type */}
                      <div className={`flex flex-wrap items-center gap-3 text-sm ${isExpired ? 'text-white' : 'text-white'}`}>
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
                    <button
                      onClick={(e) => handleRemoveSavedJob(savedJob.id, e)}
                      disabled={isRemoving}
                      className="inline-flex items-center justify-center rounded-full border h-8 w-8 bg-white/10 border-white/20 text-white transition-all duration-300 md:hover:bg-red-500/20 md:hover:border-red-500/30 md:hover:text-red-400 disabled:opacity-50 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

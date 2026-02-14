import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Loader2 } from 'lucide-react';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';

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
    applications_count: number | null;
    views_count: number | null;
    positions_count: number | null;
    profiles: {
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
}

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
        applications_count,
        views_count,
        positions_count,
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

  const { data: savedJobs = [], isLoading, isFetched } = useQuery({
    queryKey: ['saved-jobs', user?.id],
    queryFn: () => fetchSavedJobs(user!.id),
    enabled: !!user,
    staleTime: 0,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Hämta användarens ansökningar för "Redan sökt"-badge
  const { data: appliedJobIds = new Set<string>() } = useQuery({
    queryKey: ['applied-job-ids', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_applications')
        .select('job_id')
        .eq('applicant_id', user!.id);
      return new Set((data || []).map(a => a.job_id));
    },
    enabled: !!user,
    staleTime: 60000,
    gcTime: Infinity,
  });

  // Real-time för applications_count uppdateringar
  useEffect(() => {
    const channel = supabase
      .channel('saved-jobs-applications-count')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_postings' },
        (payload) => {
          queryClient.setQueryData(['saved-jobs', user?.id], (oldData: SavedJob[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(savedJob => {
              if (savedJob.job_postings && savedJob.job_postings.id === payload.new.id) {
                return {
                  ...savedJob,
                  job_postings: {
                    ...savedJob.job_postings,
                    applications_count: payload.new.applications_count,
                  },
                };
              }
              return savedJob;
            });
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  const showLoading = isLoading && !isFetched && savedJobs.length === 0;

  if (showLoading) {
    return (
      <div className="responsive-container-wide">
        <div className="text-center mb-6">
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
    <div className="responsive-container-wide animate-fade-in">
      <div className="text-center mb-6">
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
            <Button onClick={() => navigate('/search-jobs')} variant="glass">
              Sök jobb
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {savedJobs.map((savedJob) => {
            const job = savedJob.job_postings;
            if (!job) return null;

            const companyName =
              job.profiles?.company_name ||
              `${job.profiles?.first_name || ''} ${job.profiles?.last_name || ''}`.trim() ||
              'Företag';

            return (
              <ReadOnlyMobileJobCard
                key={savedJob.id}
                job={{
                  id: job.id,
                  title: job.title,
                  location: job.workplace_city && job.workplace_county
                    ? `${job.workplace_city}, ${job.workplace_county}`
                    : job.workplace_city || job.location || '',
                  employment_type: job.employment_type || undefined,
                  is_active: job.is_active,
                  views_count: job.views_count ?? 0,
                  applications_count: job.applications_count ?? 0,
                  created_at: job.created_at,
                  expires_at: job.expires_at || undefined,
                  job_image_url: job.job_image_url || undefined,
                  company_name: companyName,
                  positions_count: job.positions_count || undefined,
                }}
                hasApplied={appliedJobIds.has(job.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedJobs;

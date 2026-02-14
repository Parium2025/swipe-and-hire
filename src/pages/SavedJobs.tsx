import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { Heart, Loader2, Trash2, AlertTriangle, ArrowDownUp } from 'lucide-react';
import { toast } from 'sonner';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { useSavedJobs } from '@/hooks/useSavedJobs';

type SortOption = 'newest' | 'oldest' | 'expired' | 'active';

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
  const { user, refreshSidebarCounts } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unsaveJob } = useSavedJobs();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [jobToRemove, setJobToRemove] = useState<{ id: string; title: string } | null>(null);

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

  const handleUnsaveClick = (jobId: string, jobTitle: string) => {
    setJobToRemove({ id: jobId, title: jobTitle });
  };

  const confirmRemove = () => {
    if (!jobToRemove) return;
    unsaveJob(jobToRemove.id);
    setJobToRemove(null);
    // Refetch to update the list
    queryClient.invalidateQueries({ queryKey: ['saved-jobs', user?.id] });
    refreshSidebarCounts();
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const sortedJobs = useMemo(() => {
    const withJobs = savedJobs.filter(sj => sj.job_postings !== null);
    
    switch (sortBy) {
      case 'newest':
        return [...withJobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return [...withJobs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'active':
        return withJobs
          .filter(sj => sj.job_postings!.is_active && !isExpired(sj.job_postings!.expires_at))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'expired':
        return withJobs
          .filter(sj => !sj.job_postings!.is_active || isExpired(sj.job_postings!.expires_at))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      default:
        return withJobs;
    }
  }, [savedJobs, sortBy]);

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

      {sortedJobs.length === 0 ? (
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
        <>
          {/* Sort chips */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            <ArrowDownUp className="h-4 w-4 text-white/60 shrink-0" />
            {([
              { key: 'newest', label: 'Nyast först' },
              { key: 'oldest', label: 'Äldst först' },
              { key: 'active', label: 'Visa aktiva' },
              { key: 'expired', label: 'Visa utgångna' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  sortBy === key
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/5 text-white/60 border border-white/10 md:hover:bg-white/10 md:hover:text-white/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {sortedJobs.map((savedJob) => {
              const job = savedJob.job_postings!;

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
                  onUnsaveClick={handleUnsaveClick}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Bekräftelsedialog för borttagning */}
      <AlertDialog open={!!jobToRemove} onOpenChange={(open) => { if (!open) setJobToRemove(null); }}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort sparat jobb
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {jobToRemove && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">"{jobToRemove.title}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRemove();
              }}
              variant="destructiveSoft"
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </div>
  );
};

export default SavedJobs;

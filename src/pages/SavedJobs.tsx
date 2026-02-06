import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Heart, MapPin, Building2, Briefcase, Clock, Trash2, Timer, Loader2, CheckCircle, Users, AlertTriangle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getTimeRemaining, formatDateShortSv } from '@/lib/date';

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
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [jobToRemove, setJobToRemove] = useState<{ id: string; title: string } | null>(null);

  // Show cached data immediately, refresh silently in background
  const { data: savedJobs = [], isLoading, isFetched } = useQuery({
    queryKey: ['saved-jobs', user?.id],
    queryFn: () => fetchSavedJobs(user!.id),
    enabled: !!user,
    staleTime: 0,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Hämta användarens ansökningar för att visa "Redan sökt"-badge
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

  // Real-time prenumeration för applications_count uppdateringar
  useEffect(() => {
    const channel = supabase
      .channel('saved-jobs-applications-count')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_postings'
        },
        (payload) => {
          // Uppdatera cache med nya applications_count
          queryClient.setQueryData(['saved-jobs', user?.id], (oldData: SavedJob[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(savedJob => {
              if (savedJob.job_postings && savedJob.job_postings.id === payload.new.id) {
                return {
                  ...savedJob,
                  job_postings: {
                    ...savedJob.job_postings,
                    applications_count: payload.new.applications_count
                  }
                };
              }
              return savedJob;
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const handleRemoveClick = (savedJobId: string, jobTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setJobToRemove({ id: savedJobId, title: jobTitle });
  };

  const confirmRemoveSavedJob = async () => {
    if (!jobToRemove) return;
    
    const savedJobId = jobToRemove.id;
    setJobToRemove(null);
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
      
      // Uppdatera sidebar-räknaren
      refreshSidebarCounts();
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
       <div className="responsive-container">
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
     <div className="responsive-container animate-fade-in">
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
              variant="glass"
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
            const hasApplied = appliedJobIds.has(job.id);
            
            // Använd centraliserad getTimeRemaining för konsekvent beräkning
            const timeInfo = getTimeRemaining(job.created_at, job.expires_at);
            const isExpired = !job.is_active || timeInfo.isExpired;

            return (
              <Card
                key={savedJob.id}
                className={`group border-white/10 transition-all cursor-pointer ${
                  isRemoving ? 'opacity-50' : ''
                } bg-white/5 hover:bg-white/10 hover:border-white/30`}
                onClick={() => handleJobClick(job.id, !isExpired)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title and status */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className={`text-lg font-semibold truncate ${isExpired ? 'text-white' : 'text-white'}`}>
                          {job.title}
                        </h3>
                        {/* Visa antal sökande */}
                        <Badge variant="glass" className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-brightness-110">
                          <Users className="h-3 w-3 mr-1" />
                          {job.applications_count ?? 0} sökande
                        </Badge>
                        {/* Visa "dagar kvar" eller "Utgången" */}
                        {isExpired ? (
                          <Badge variant="glass" className="bg-red-500/20 text-white border-red-500/30 text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/30 hover:border-red-500/50 hover:backdrop-brightness-110">
                            Utgången
                          </Badge>
                        ) : (
                          <Badge variant="glass" className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-brightness-110">
                            <Timer className="h-3 w-3 mr-1" />
                            {timeInfo.text} kvar
                          </Badge>
                        )}
                        {/* Visa "Redan sökt" badge på Sparade Jobb */}
                        {hasApplied && (
                          <Badge variant="glass" className="bg-green-500/20 text-green-300 border-green-500/30 text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-green-500/30 hover:border-green-500/50 hover:backdrop-brightness-110">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Redan sökt
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
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDateShortSv(savedJob.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={(e) => handleRemoveClick(savedJob.id, job.title, e)}
                      disabled={isRemoving}
                      className="inline-flex items-center justify-center rounded-full border h-8 w-8 bg-white/5 backdrop-blur-[2px] border-white/20 text-white transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 hover:backdrop-brightness-110 disabled:opacity-50 flex-shrink-0 active:scale-95"
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

      {/* Confirmation Dialog */}
      <AlertDialog open={!!jobToRemove} onOpenChange={() => setJobToRemove(null)}>
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
              onClick={() => setJobToRemove(null)}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveSavedJob}
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

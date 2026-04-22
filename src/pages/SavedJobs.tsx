import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Heart, Loader2, Trash2, AlertTriangle, ArrowDownUp, Undo2, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { CardErrorBoundary } from '@/components/ui/card-error-boundary';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { useSwipeActions } from '@/hooks/useSwipeActions';
import { usePreloadImages } from '@/hooks/useCachedImage';

type SortOption = 'newest' | 'oldest';
type StatusFilter = 'all' | 'active' | 'expired';
type TabValue = 'saved' | 'skipped';

interface SavedJob {
  id: string;
  job_id: string;
  created_at: string;
  job_postings: {
    id: string;
    title: string;
    image_focus_position?: string | null;
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
    salary_min: number | null;
    salary_max: number | null;
    salary_type: string | null;
    salary_transparency: string | null;
    benefits: string[] | null;
    workplace_name: string | null;
    company_logo_url: string | null;
  } | null;
}

interface SkippedJob {
  id: string;
  job_id: string;
  created_at: string;
  job_postings: {
    id: string;
    title: string;
    image_focus_position?: string | null;
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
    salary_min: number | null;
    salary_max: number | null;
    salary_type: string | null;
    salary_transparency: string | null;
    benefits: string[] | null;
    workplace_name: string | null;
    company_logo_url: string | null;
  } | null;
}

const fetchSavedJobs = async (userId: string): Promise<SavedJob[]> => {
  // 🚇 SINGLE TUNNEL: read workplace_name + company_logo_url straight from job_postings.
  const { data, error } = await supabase
    .from('saved_jobs')
    .select(`
      id,
      job_id,
      created_at,
      job_postings (
        id,
        title,
        image_focus_position,
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
        salary_min,
        salary_max,
        salary_type,
        salary_transparency,
        benefits,
        workplace_name,
        company_logo_url
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as SavedJob[]) || [];
};

const fetchSkippedJobs = async (userId: string): Promise<SkippedJob[]> => {
  // 🚇 SINGLE TUNNEL: read workplace_name + company_logo_url straight from job_postings.
  const { data, error } = await supabase
    .from('swipe_actions')
    .select(`
      id,
      job_id,
      created_at,
      job_postings (
        id,
        title,
        image_focus_position,
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
        salary_min,
        salary_max,
        salary_type,
        salary_transparency,
        benefits,
        workplace_name,
        company_logo_url
      )
    `)
    .eq('user_id', userId)
    .eq('action', 'skipped')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as SkippedJob[]) || [];
};

const SavedJobs = () => {
  const { user, refreshSidebarCounts } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unsaveJob, isJobSaved, toggleSaveJob } = useSavedJobs();
  const { undoAction } = useSwipeActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabValue = (searchParams.get('tab') === 'skipped' ? 'skipped' : 'saved');
  const setActiveTab = useCallback((tab: TabValue) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [jobToRemove, setJobToRemove] = useState<{ id: string; title: string } | null>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Mouse-drag scrolling for sort chips
  const chipsRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.pageX - (chipsRef.current?.offsetLeft || 0);
    scrollLeft.current = chipsRef.current?.scrollLeft || 0;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !chipsRef.current) return;
    e.preventDefault();
    const x = e.pageX - (chipsRef.current.offsetLeft || 0);
    chipsRef.current.scrollLeft = scrollLeft.current - (x - startX.current);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const { data: savedJobs = [], isLoading } = useQuery({
    queryKey: ['saved-jobs', user?.id],
    queryFn: () => fetchSavedJobs(user!.id),
    enabled: !!user,
    staleTime: 30_000,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: skippedJobs = [], isLoading: isLoadingSkipped } = useQuery({
    queryKey: ['skipped-jobs', user?.id],
    queryFn: () => fetchSkippedJobs(user!.id),
    enabled: !!user && activeTab === 'skipped',
    staleTime: 30_000,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
    staleTime: 30_000,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    structuralSharing: false,
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
                    workplace_name: payload.new.workplace_name,
                    company_logo_url: payload.new.company_logo_url,
                    is_active: payload.new.is_active,
                    expires_at: payload.new.expires_at,
                    deleted_at: payload.new.deleted_at,
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
    queryClient.invalidateQueries({ queryKey: ['saved-jobs', user?.id] });
    refreshSidebarCounts();
  };

  const handleRestoreSkipped = useCallback(async (jobId: string) => {
    await undoAction(jobId);
    queryClient.invalidateQueries({ queryKey: ['skipped-jobs', user?.id] });
    toast.success('Jobbet har återställts');
  }, [undoAction, queryClient, user?.id]);

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const sortedJobs = useMemo(() => {
    const withJobs = savedJobs.filter(sj => sj.job_postings !== null);

    const isJobExpired = (sj: SavedJob) => !sj.job_postings!.is_active || isExpired(sj.job_postings!.expires_at);

    // Apply status filter first (independent of sort)
    const filtered = withJobs.filter(sj => {
      if (statusFilter === 'active') return !isJobExpired(sj);
      if (statusFilter === 'expired') return isJobExpired(sj);
      return true;
    });

    // When showing "all", keep expired-jobs at the bottom; otherwise plain date sort
    const ascending = sortBy === 'oldest';
    if (statusFilter === 'all') {
      return [...filtered].sort((a, b) => {
        const aExp = isJobExpired(a) ? 1 : 0;
        const bExp = isJobExpired(b) ? 1 : 0;
        if (aExp !== bExp) return aExp - bExp;
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return ascending ? dateA - dateB : dateB - dateA;
      });
    }
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  }, [savedJobs, sortBy, statusFilter]);

  const filteredSkippedJobs = useMemo(() => {
    return skippedJobs.filter(sj => {
      if (!sj.job_postings) return false;
      if (!sj.job_postings.is_active) return false;
      if (sj.job_postings.expires_at && new Date(sj.job_postings.expires_at) < new Date()) return false;
      return true;
    });
  }, [skippedJobs]);

  const activeTabPreloadUrls = useMemo(() => {
    const sourceJobs = activeTab === 'saved'
      ? sortedJobs.map((entry) => entry.job_postings).filter(Boolean)
      : filteredSkippedJobs.map((entry) => entry.job_postings).filter(Boolean);

    const resolveStorageUrl = (bucket: 'job-images' | 'company-logos', path?: string | null) => {
      if (!path) return null;
      if (path.startsWith('http')) return path;
      return supabase.storage.from(bucket).getPublicUrl(path).data?.publicUrl || null;
    };

    return Array.from(new Set(
      sourceJobs
        .flatMap((job) => [
          resolveStorageUrl('job-images', job?.job_image_url),
          resolveStorageUrl('company-logos', job?.company_logo_url),
        ])
        .filter((url): url is string => !!url)
    )).slice(0, 6);
  }, [activeTab, sortedJobs, filteredSkippedJobs]);

  const activeTabMediaReady = usePreloadImages(activeTabPreloadUrls);

  if (!showContent) {
    return (
      <div className="responsive-container-wide opacity-0" aria-hidden="true">
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
      <div className="text-center mb-5">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">
          {activeTab === 'saved' ? `Sparade Jobb (${sortedJobs.length})` : `Skippade Jobb (${filteredSkippedJobs.length})`}
        </h1>
        <p className="text-sm text-white">
          {activeTab === 'saved' ? 'Dina favorit-jobb samlade på ett ställe' : 'Jobb du har svipat förbi — återställ de du ångrar'}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center justify-center gap-2 mb-5">
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 touch-manipulation ${
            activeTab === 'saved'
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/5 text-white/60 border border-white/10 md:hover:bg-white/10'
          }`}
        >
          <Heart className="h-3.5 w-3.5" />
          Sparade
        </button>
        <button
          onClick={() => setActiveTab('skipped')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 touch-manipulation ${
            activeTab === 'skipped'
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/5 text-white/60 border border-white/10 md:hover:bg-white/10'
          }`}
        >
          <EyeOff className="h-3.5 w-3.5" />
          Skippade
        </button>
      </div>

      {/* ── Saved tab ── */}
      {activeTab === 'saved' && (
        <>
          {((isLoading && savedJobs.length === 0) || !activeTabMediaReady) ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          ) : savedJobs.filter(sj => sj.job_postings !== null).length === 0 ? (
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
              <div
                ref={chipsRef}
                className="flex items-center justify-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <ArrowDownUp className="h-4 w-4 text-white shrink-0" />
                {([
                  { key: 'newest', label: 'Nyast först' },
                  { key: 'oldest', label: 'Äldst först' },
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
                <span className="shrink-0 w-px h-5 bg-white/15 mx-1" aria-hidden="true" />
                {([
                  { key: 'active', label: 'Visa aktiva' },
                  { key: 'expired', label: 'Visa utgångna' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(prev => prev === key ? 'all' : key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      statusFilter === key
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-white/5 text-white/60 border border-white/10 md:hover:bg-white/10 md:hover:text-white/80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {sortedJobs.length === 0 ? (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-8 text-center">
                    <Heart className="h-12 w-12 text-white mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                      {statusFilter === 'active' ? 'Inga aktiva jobb' : statusFilter === 'expired' ? 'Inga utgångna jobb' : 'Inga jobb att visa'}
                    </h3>
                    <p className="text-white/70 text-sm">
                      Justera filtret ovan för att visa fler jobb
                    </p>
                  </CardContent>
                </Card>
              ) : (

              <div className={`job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4${sortedJobs.length === 1 ? ' job-card-grid-single' : sortedJobs.length === 2 ? ' job-card-grid-double' : ''}`}>
                {sortedJobs.map((savedJob, index) => {
                  const job = savedJob.job_postings!;
                  // 🚇 SINGLE TUNNEL: workplace_name + company_logo_url come from job_postings.
                  const companyName = job.workplace_name?.trim() || 'Företag';

                  return (
                    <CardErrorBoundary key={job.id}>
                      <ReadOnlyMobileJobCard
                        job={{
                          id: job.id,
                          title: job.title,
                          location: job.workplace_city || job.location || '',
                          employment_type: job.employment_type || undefined,
                          is_active: job.is_active,
                          views_count: job.views_count ?? 0,
                          applications_count: job.applications_count ?? 0,
                          created_at: job.created_at,
                          expires_at: job.expires_at || undefined,
                          job_image_url: job.job_image_url || undefined,
                          image_focus_position: job.image_focus_position || undefined,
                          company_name: companyName,
                          company_logo_url: job.company_logo_url || undefined,
                          positions_count: job.positions_count || undefined,
                          salary_min: job.salary_min,
                          salary_max: job.salary_max,
                          salary_type: job.salary_type,
                          salary_transparency: job.salary_transparency,
                          benefits: job.benefits,
                        }}
                        cardIndex={index}
                        hasApplied={appliedJobIds.has(job.id)}
                        isSavedExternal={true}
                        onToggleSave={toggleSaveJob}
                        onUnsaveClick={handleUnsaveClick}
                        onCardClick={(jobId) => navigate(`/job-view/${jobId}`, { state: { fromSavedJobs: true } })}
                      />
                    </CardErrorBoundary>
                  );
                })}
              </div>
              )}
            </>

          )}
        </>
      )}

      {/* ── Skipped tab ── */}
      {activeTab === 'skipped' && (
        <>
          {(isLoadingSkipped || !activeTabMediaReady) ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          ) : filteredSkippedJobs.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-8 text-center">
                <EyeOff className="h-12 w-12 text-white mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Inga skippade jobb</h3>
                <p className="text-white mb-4">
                  Jobb du svipat förbi i swipe-läget hamnar här
                </p>
                <Button onClick={() => navigate('/search-jobs')} variant="glass">
                  Sök jobb
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className={`job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4${filteredSkippedJobs.length === 1 ? ' job-card-grid-single' : filteredSkippedJobs.length === 2 ? ' job-card-grid-double' : ''}`}>
              {filteredSkippedJobs.map((skippedJob, index) => {
                const job = skippedJob.job_postings!;
                // 🚇 SINGLE TUNNEL
                const companyName = job.workplace_name?.trim() || 'Företag';

                return (
                  <CardErrorBoundary key={job.id}>
                    <div className="relative group">
                      <ReadOnlyMobileJobCard
                        job={{
                          id: job.id,
                          title: job.title,
                          location: job.workplace_city || job.location || '',
                          employment_type: job.employment_type || undefined,
                          is_active: job.is_active,
                          views_count: job.views_count ?? 0,
                          applications_count: job.applications_count ?? 0,
                          created_at: job.created_at,
                          expires_at: job.expires_at || undefined,
                          job_image_url: job.job_image_url || undefined,
                          image_focus_position: job.image_focus_position || undefined,
                          company_name: companyName,
                          company_logo_url: job.company_logo_url || undefined,
                          positions_count: job.positions_count || undefined,
                          salary_min: job.salary_min,
                          salary_max: job.salary_max,
                          salary_type: job.salary_type,
                          salary_transparency: job.salary_transparency,
                          benefits: job.benefits,
                        }}
                        cardIndex={index}
                        hasApplied={appliedJobIds.has(job.id)}
                        isSavedExternal={isJobSaved(job.id)}
                        onToggleSave={toggleSaveJob}
                        onCardClick={(jobId) => navigate(`/job-view/${jobId}`, { state: { fromSavedJobs: true } })}
                      />
                      {/* Restore button overlay */}
                      <button
                        onClick={() => handleRestoreSkipped(job.id)}
                        className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-medium shadow-lg transition-colors touch-manipulation md:hover:bg-white/25"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Återställ
                      </button>
                    </div>
                  </CardErrorBoundary>
                );
              })}
            </div>
          )}
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
                <AlertTriangle className="h-4 w-4 text-white" />
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
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRemove();
              }}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
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

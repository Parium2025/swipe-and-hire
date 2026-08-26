import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
import { Heart, Loader2, Trash2, AlertTriangle, ArrowDownUp, Undo2, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { CardErrorBoundary } from '@/components/ui/card-error-boundary';
import { useSavedJobsCache, type SavedJob } from '@/hooks/useSavedJobsCache';
import { useAppliedJobIds } from '@/hooks/useAppliedJobIds';
import { useImagePrewarm } from '@/hooks/useImagePrewarm';
import { TruncatedText } from '@/components/TruncatedText';
import { JobCardGridSkeleton } from '@/components/search/JobCardGridSkeleton';
import { readCachedCount, writeCachedCount, SKELETON_COUNT_KEYS } from '@/lib/skeletonCounts';
import { useLiveSkeletonCount } from '@/lib/useLiveSkeletonCount';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { getManagedScrollContainer, readPositions, writePositions } from '@/lib/scrollRestoration';

/** Samma sidstorlek som Mina annonser / Dashboard — 18 kort per sida (6 rader × 3 kolumner). */
const PAGE_SIZE = 18;


type SortOption = 'newest' | 'oldest';
type StatusFilter = 'all' | 'active' | 'expired';
type TabValue = 'saved' | 'skipped';

const SavedJobs = () => {
  const { refreshSidebarCounts } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabValue = (searchParams.get('tab') === 'skipped' ? 'skipped' : 'saved');
  const setActiveTab = useCallback((tab: TabValue) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [skippedSort, setSkippedSort] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [jobToRemove, setJobToRemove] = useState<{ id: string; title: string } | null>(null);

  // 🚇 All data + realtime now lives in useSavedJobsCache (mirrors useMyApplicationsCache)
  const {
    savedJobs,
    skippedJobs,
    isLoadingSaved: isLoading,
    isLoadingSkipped,
    savedJobIds,
    removeSavedJobLocally,
    toggleSavedJob,
    restoreSkippedJob,
    bulkRemoveSaved,
    bulkRemoveSkipped,
  } = useSavedJobsCache({ enableSkipped: activeTab === 'skipped' });

  // 🗑️ Rensa-läge (samma mönster som arbetsgivarens utgångna annonser)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Byte av flik nollställer markeringen så inget råkar raderas i fel lista
  useEffect(() => {
    exitSelectionMode();
  }, [activeTab, exitSelectionMode]);

  const toggleSelected = useCallback((jobId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  }, []);

  const [showContent, setShowContent] = useState(false);

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

  // Delad applied-job-ids query (ingen dubbel-fetch mellan sidor)
  const { data: appliedJobIds = new Set<string>() } = useAppliedJobIds();

  const handleUnsaveClick = (jobId: string, jobTitle: string) => {
    setJobToRemove({ id: jobId, title: jobTitle });
  };

  const confirmRemove = () => {
    if (!jobToRemove) return;
    const removedId = jobToRemove.id;
    setJobToRemove(null);
    // Optimistic local update via cache hook
    removeSavedJobLocally(removedId);
    toggleSavedJob(removedId).catch(() => {
      toast.error('Kunde inte ta bort jobbet');
    });
    refreshSidebarCounts();
  };

  const handleRestoreSkipped = useCallback(async (jobId: string) => {
    try {
      await restoreSkippedJob(jobId);
      toast.success('Jobbet har återställts');
    } catch {
      toast.error('Kunde inte återställa jobbet');
    }
  }, [restoreSkippedJob]);

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const hasRenderableJobPosting = useCallback((entry: SavedJob) => {
    const posting = entry.job_postings;
    return !!(
      posting &&
      typeof posting.id === 'string' && posting.id.trim() &&
      typeof posting.title === 'string' && posting.title.trim() &&
      typeof posting.created_at === 'string' && posting.created_at.trim()
    );
  }, []);

  const sortedJobs = useMemo(() => {
    const withJobs = savedJobs.filter(hasRenderableJobPosting);

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
    const visible = skippedJobs.filter(sj => {
      if (!hasRenderableJobPosting(sj)) return false;
      if (!sj.job_postings.is_active) return false;
      if (sj.job_postings.expires_at && new Date(sj.job_postings.expires_at) < new Date()) return false;
      return true;
    });
    const ascending = skippedSort === 'oldest';
    return [...visible].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  }, [skippedJobs, hasRenderableJobPosting, skippedSort]);

  const activeJobsForMedia = activeTab === 'saved' ? sortedJobs : filteredSkippedJobs;

  // 📄 Sidnavigering — exakt samma modell som Mina annonser/Dashboard:
  // 18 kort per sida, sidan nollställs vid flik-, sorterings- och filterbyte
  // och klampas alltid inom listans längd.
  const [page, setPage] = useState(1);
  const didMountRef = useRef(false);
  const totalPages = Math.max(1, Math.ceil(activeJobsForMedia.length / PAGE_SIZE));

  useEffect(() => { setPage(1); }, [activeTab]);
  useEffect(() => { setPage(1); }, [sortBy, statusFilter, skippedSort]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (typeof window === 'undefined') return;
    getManagedScrollContainer()?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const positions = readPositions();
    positions[window.location.pathname] = { top: 0 };
    writePositions(positions);
  }, [page]);

  const pagedSavedJobs = useMemo(
    () => sortedJobs.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE),
    [sortedJobs, page],
  );
  const pagedSkippedJobs = useMemo(
    () => filteredSkippedJobs.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE),
    [filteredSkippedJobs, page],
  );
  const pagedActiveJobs = activeTab === 'saved' ? pagedSavedJobs : pagedSkippedJobs;

  // Alla jobb som just nu syns i aktiv flik (respekterar sortering + filter)
  const visibleIds = useMemo(
    () => activeJobsForMedia.map((entry) => entry.job_postings!.id),
    [activeJobsForMedia],
  );

  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      if (activeTab === 'saved') {
        await bulkRemoveSaved(ids);
      } else {
        await bulkRemoveSkipped(ids);
      }
      toast.success(`${ids.length} ${ids.length === 1 ? 'jobb borttaget' : 'jobb borttagna'}`);
      refreshSidebarCounts();
      setBulkDeleteOpen(false);
      exitSelectionMode();
    } catch {
      toast.error('Kunde inte ta bort alla jobb — försök igen');
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds, activeTab, bulkRemoveSaved, bulkRemoveSkipped, refreshSidebarCounts, exitSelectionMode]);

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const selectionToolbar = visibleIds.length > 0 ? (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
      {!selectionMode ? (
        <button
          type="button"
          onClick={() => setSelectionMode(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors md:hover:bg-white/15"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Rensa
        </button>
      ) : (
        <>
          <span className="text-xs sm:text-sm font-medium text-white">{selectedIds.size} markerade</span>
          <button
            type="button"
            onClick={() => setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleIds))}
            className="inline-flex items-center rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors md:hover:bg-white/15"
          >
            {allVisibleSelected ? 'Avmarkera alla' : `Markera alla (${visibleIds.length})`}
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setBulkDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-400/40 px-3 py-1.5 text-xs font-medium text-white transition-colors md:hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Ta bort markerade
          </button>
          <button
            type="button"
            onClick={exitSelectionMode}
            aria-label="Avbryt markering"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors md:hover:bg-white/15"
          >
            <X className="h-3.5 w-3.5" />
            Avbryt
          </button>
        </>
      )}
    </div>
  ) : null;

  const renderSelectionOverlay = (jobId: string, title: string) => {
    if (!selectionMode) return null;
    const checked = selectedIds.has(jobId);
    return (
      <button
        type="button"
        onClick={() => toggleSelected(jobId)}
        aria-pressed={checked}
        aria-label={`${checked ? 'Avmarkera' : 'Markera'} ${title}`}
        className={`absolute inset-0 z-20 flex items-start justify-end rounded-2xl p-3 transition-colors ${
          checked ? 'bg-primary/25 ring-2 ring-white/70' : 'bg-black/25 md:hover:bg-black/15'
        }`}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
            checked ? 'bg-white border-white' : 'bg-white/15 border-white/60 backdrop-blur-sm'
          }`}
        >
          {checked && <Check className="h-4 w-4 text-primary" />}
        </span>
      </button>
    );
  };

  // Förvärm bilder för aktuell sida + nästa sida, så "Nästa" känns instant
  // utan att vi någonsin drar ner tusentals bilder i onödan.
  const prewarmEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return activeJobsForMedia.slice(start, start + PAGE_SIZE * 2).flatMap((entry) => {
      const posting = entry.job_postings;
      if (!posting) return [];

      return [
        { path: posting.job_image_url, bucket: 'job-images' as const },
        { path: posting.company_logo_url, bucket: 'company-logos' as const },
      ].filter((item) => Boolean(item.path));
    });
  }, [activeJobsForMedia]);

  useImagePrewarm(prewarmEntries);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setShowContent(true);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  // Cacha antalet så skeleton kan rendera exakt lika många kort nästa cold-load.
  useEffect(() => {
    if (!isLoading) writeCachedCount(SKELETON_COUNT_KEYS.savedJobs, savedJobs.length);
  }, [isLoading, savedJobs.length]);
  useEffect(() => {
    if (!isLoadingSkipped) writeCachedCount(SKELETON_COUNT_KEYS.skippedJobs, skippedJobs.length);
  }, [isLoadingSkipped, skippedJobs.length]);

  // Skelettet speglar det faktiska antalet kort: live ur cachen, annars
  // senast kända antal — aldrig ett gissat fast antal.
  const savedSkeletonCount = useLiveSkeletonCount({
    queryKeys: ['saved-jobs'],
    fallbackKey: SKELETON_COUNT_KEYS.savedJobs,
  });
  const skippedSkeletonCount = useLiveSkeletonCount({
    queryKeys: ['skipped-jobs'],
    fallbackKey: SKELETON_COUNT_KEYS.skippedJobs,
  });

  if (!showContent) {
    const skeletonCount = activeTab === 'skipped' ? skippedSkeletonCount : savedSkeletonCount;
    return (
      <div className="responsive-container-wide [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
        <div className="text-center mb-5">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">
            {activeTab === 'skipped' ? 'Skippade Jobb' : 'Sparade Jobb'}
          </h1>
          <p className="text-sm text-white">
            {activeTab === 'skipped' ? 'Jobb du har svipat förbi — återställ de du ångrar' : 'Dina favorit-jobb samlade på ett ställe'}
          </p>
        </div>
        <JobCardGridSkeleton count={skeletonCount} />
      </div>
    );
  }


  return (
    <div className="responsive-container-wide [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
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
              : 'bg-white/5 text-white border border-white/10 md:hover:bg-white/10'
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
              : 'bg-white/5 text-white border border-white/10 md:hover:bg-white/10'
          }`}
        >
          <EyeOff className="h-3.5 w-3.5" />
          Skippade
        </button>
      </div>

      {/* ── Saved tab ── */}
      {activeTab === 'saved' && (
        <>
          {(isLoading && savedJobs.length === 0) ? (
            <JobCardGridSkeleton count={savedSkeletonCount} />
          ) : savedJobs.filter(hasRenderableJobPosting).length === 0 ? (
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
                className="flex items-center justify-start md:justify-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none cursor-grab active:cursor-grabbing select-none"
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
                        : 'bg-white/5 text-white border border-white/10 md:hover:bg-white/10'
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
                        : 'bg-white/5 text-white border border-white/10 md:hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {selectionToolbar}

              {sortedJobs.length === 0 ? (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-8 text-center">
                    <Heart className="h-12 w-12 text-white mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                      {statusFilter === 'active' ? 'Inga aktiva jobb' : statusFilter === 'expired' ? 'Inga utgångna jobb' : 'Inga jobb att visa'}
                    </h3>
                    <p className="text-white text-sm">
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
                     <div className="relative">
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
                          job_image_desktop_url: job.job_image_desktop_url || undefined,
                          image_focus_position: job.image_focus_position || undefined,
                          company_name: companyName,
                          company_logo_url: job.company_logo_url || undefined,
                          positions_count: job.positions_count || undefined,
                          salary_min: job.salary_min,
                          salary_max: job.salary_max,
                          salary_type: job.salary_type,
                          salary_transparency: job.salary_transparency,
                          benefits: job.benefits,
                          part_time_days: (job as any).part_time_days,
                          part_time_shifts: (job as any).part_time_shifts,
                          duration_amount: (job as any).duration_amount,
                          duration_unit: (job as any).duration_unit,
                        }}
                        cardIndex={index}
                        hasApplied={appliedJobIds.has(job.id)}
                        isSavedExternal={true}
                        onToggleSave={toggleSavedJob}
                        onUnsaveClick={handleUnsaveClick}
                        onCardClick={(jobId, imageState) => navigate(`/job-view/${jobId}`, { state: { fromSavedJobs: true, background: location, ...imageState } })}
                      />
                      {renderSelectionOverlay(job.id, job.title)}
                     </div>
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
          {isLoadingSkipped ? (
            <JobCardGridSkeleton count={skippedSkeletonCount} />
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
            <>
              {/* Sort chips — speglar Sparade-fliken */}
              <div
                ref={chipsRef}
                className="flex items-center justify-start md:justify-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none cursor-grab active:cursor-grabbing select-none"
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
                    onClick={() => setSkippedSort(key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      skippedSort === key
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-white/5 text-white border border-white/10 md:hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

            {selectionToolbar}


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
                          job_image_desktop_url: job.job_image_desktop_url || undefined,
                          image_focus_position: job.image_focus_position || undefined,
                          company_name: companyName,
                          company_logo_url: job.company_logo_url || undefined,
                          positions_count: job.positions_count || undefined,
                          salary_min: job.salary_min,
                          salary_max: job.salary_max,
                          salary_type: job.salary_type,
                          salary_transparency: job.salary_transparency,
                          benefits: job.benefits,
                          part_time_days: (job as any).part_time_days,
                          part_time_shifts: (job as any).part_time_shifts,
                          duration_amount: (job as any).duration_amount,
                          duration_unit: (job as any).duration_unit,
                        }}
                        cardIndex={index}
                        hasApplied={appliedJobIds.has(job.id)}
                        isSavedExternal={savedJobIds.has(job.id)}
                        onToggleSave={(jobId) => {
                          void toggleSavedJob(jobId, job).catch(() => {
                            toast.error('Kunde inte spara jobbet');
                          });
                        }}
                        onCardClick={(jobId, imageState) => navigate(`/job-view/${jobId}`, { state: { fromSavedJobs: true, background: location, ...imageState } })}
                      />
                      {/* Restore button overlay */}
                      <button
                        onClick={() => handleRestoreSkipped(job.id)}
                        className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-primary-foreground border-2 border-white/40 text-xs font-semibold shadow-xl shadow-black/40 transition-colors touch-manipulation md:hover:bg-primary/90"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Återställ
                      </button>
                      {renderSelectionOverlay(job.id, job.title)}
                    </div>
                  </CardErrorBoundary>
                 );
               })}
             </div>
            </>
           )}
         </>
       )}

      {/* Bekräftelsedialog för massrensning */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!bulkDeleting) setBulkDeleteOpen(open); }}>
        <AlertDialogContentNoFocus
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort {selectedIds.size} {selectedIds.size === 1 ? 'jobb' : 'jobb'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {activeTab === 'saved'
                ? 'De markerade jobben tas bort från dina sparade jobb. Annonserna finns kvar i sök.'
                : 'De markerade jobben tas bort från din skippade-lista och kan dyka upp igen i swipe-läget.'}
              {' '}Denna åtgärd går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel
              disabled={bulkDeleting}
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirmBulkDelete(); }}
              disabled={bulkDeleting}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              {bulkDeleting ? 'Tar bort…' : 'Ta bort'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

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
                  Är du säker på att du vill ta bort <span className="font-semibold text-white break-words">"{jobToRemove.title}"</span>? Denna åtgärd går inte att ångra.
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

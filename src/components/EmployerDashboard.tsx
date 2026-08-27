import { useState, memo, useMemo, useRef, useEffect, useCallback, startTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Eye, Edit, Trash2, AlertTriangle, Briefcase, TrendingUp, Users, ChevronsDownUp, ChevronsUpDown, Check, X } from 'lucide-react';
import EditJobDialog from '@/components/EditJobDialog';
import { useJobsData, removeJobFromJobsCache, removeJobsFromJobsCache, type JobPosting } from '@/hooks/useJobsData';

import { MobileJobCard } from '@/components/MobileJobCard';


import { TruncatedText } from '@/components/TruncatedText';
import { CardErrorBoundary } from '@/components/ui/card-error-boundary';
import { formatDateShortSv } from '@/lib/date';
import { getEmployerJobStatus, isEmployerJobActive, isEmployerJobDraft, isEmployerJobExpired } from '@/lib/jobStatus';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertDialogContentNoFocus } from "@/components/ui/alert-dialog-no-focus";
import { StatsGrid } from '@/components/StatsGrid';
import { JobSearchBar } from '@/components/JobSearchBar';
import { useJobFiltering } from '@/hooks/useJobFiltering';
import { useJobPrefetch } from '@/hooks/useJobPrefetch';
import { JobStatusTabs } from '@/components/ui/job-status-tabs';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { VirtualJobGrid } from '@/components/dashboard/VirtualJobGrid';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { EmptyJobsCta } from '@/components/dashboard/EmptyJobsCta';
import { useImagePrewarm } from '@/hooks/useImagePrewarm';
import { buildCardImageUrl } from '@/hooks/useCardImage';
import { getImageVersion } from '@/lib/imageTransforms';

import { useEmployerJobsCounts, useEmployerDashboardStats } from '@/hooks/useEmployerScaleStats';
import { getManagedScrollContainer, readPositions, writePositions } from '@/lib/scrollRestoration';
import { EmployerDashboardSkeleton } from '@/components/employer/EmployerPageSkeleton';
import { writeCachedCount, SKELETON_COUNT_KEYS } from '@/lib/skeletonCounts';
import { RepublishJobDialog } from '@/components/RepublishJobDialog';

type JobStatusTab = 'active' | 'expired' | 'draft';

// Module-level flag: once /my-jobs har laddats färdigt en gång i tab-sessionen,
// hoppar vi över full-screen skeleton vid sidebar-navigering — speglar
// `__searchJobsHasMountedOnce` på job-seeker-sidan exakt.
let __employerDashboardHasMountedOnce = false;

const EmployerDashboard = memo(() => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  // Server-side truth — exakta totaler även vid 10k+ jobb
  const { data: serverCounts } = useEmployerJobsCounts('personal');
  const { data: serverStats } = useEmployerDashboardStats('personal');
  const queryClient = useQueryClient();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [republishJob, setRepublishJob] = useState<JobPosting | null>(null);
  const [republishDialogOpen, setRepublishDialogOpen] = useState(false);
  // Massradering (endast utgångna/utkast)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [editRepublishMode, setEditRepublishMode] = useState(false);
  const [pendingEditJobId, setPendingEditJobId] = useState<string | null>(null);
  const { user, profile, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications } = useAuth();
  const { toast } = useToast();
  
  // Prefetch job details on hover for instant navigation
  const { handleMouseEnter: prefetchJob, handleMouseLeave: cancelPrefetch } = useJobPrefetch();
  
  const hasAutoRestoredEdit = useRef(false);

  // Auto-restore: if there was an active edit session, re-open the edit dialog
  useEffect(() => {
    if (hasAutoRestoredEdit.current || !jobs || jobs.length === 0) return;
    hasAutoRestoredEdit.current = true;
    
    try {
      const editSession = sessionStorage.getItem('parium-editing-job');
      if (editSession) {
        const parsed = JSON.parse(editSession);
        if (parsed.jobId) {
          const job = jobs.find(j => j.id === parsed.jobId);
          if (job) {
            console.log('🔄 Auto-restoring edit job dialog');
            // Don't remove session marker here — EditJobDialog will manage it
            setEditingJob(job);
            setEditRepublishMode(!!parsed.republish);
            setEditDialogOpen(true);
          } else {
            sessionStorage.removeItem('parium-editing-job');
          }
        }
      }
    } catch (e) {
      console.warn('Failed to check for editing job session');
    }
  }, [jobs]);
  
  // Skip fade-in animation when data is already cached (instant render on re-navigation)
  // Only show fade-in on first load when we actually waited for data
  const dataWasCached = useRef(!loading);
  const [showContent, setShowContent] = useState(() => !loading);
  useEffect(() => {
    if (!loading && !showContent) {
      if (dataWasCached.current) {
        setShowContent(true); // Instant — data was cached
      } else {
        const timer = setTimeout(() => setShowContent(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, showContent]);

  // Full-screen skeleton overlay — visas vid kall mount (browser refresh / direkt URL),
  // hoppar över vid in-app sidebar-navigering (mirror av seeker-sidans pattern).
  const [initialLoadDone, setInitialLoadDone] = useState(__employerDashboardHasMountedOnce);
  useEffect(() => {
    if (!loading && !initialLoadDone) {
      const t = setTimeout(() => {
        setInitialLoadDone(true);
        __employerDashboardHasMountedOnce = true;
      }, 150);
      return () => clearTimeout(t);
    }
  }, [loading, initialLoadDone]);

  // Cachea per-tab-antal så skeletonen nästa gång rendrar exakt rätt antal kort
  // för den tab användaren är på. Skriver server-truth när tillgängligt, annars
  // klient-buckets. Skrivs endast när data är klar för att undvika flimmer.
  const cachedCountsRef = useRef({ active: -1, expired: -1, draft: -1 });
  useEffect(() => {
    if (loading) return;
    const active = serverCounts?.active ?? jobs.filter(j => isEmployerJobActive(j)).length;
    const expired = serverCounts?.expired ?? jobs.filter(j => isEmployerJobExpired(j)).length;
    const draft = serverCounts?.draft ?? jobs.filter(j => isEmployerJobDraft(j)).length;
    if (cachedCountsRef.current.active !== active) {
      writeCachedCount(SKELETON_COUNT_KEYS.myJobsActive, active);
      cachedCountsRef.current.active = active;
    }
    if (cachedCountsRef.current.expired !== expired) {
      writeCachedCount(SKELETON_COUNT_KEYS.myJobsExpired, expired);
      cachedCountsRef.current.expired = expired;
    }
    if (cachedCountsRef.current.draft !== draft) {
      writeCachedCount(SKELETON_COUNT_KEYS.myJobsDraft, draft);
      cachedCountsRef.current.draft = draft;
    }
  }, [loading, jobs, serverCounts]);

  
  const {
    searchInput,
    setSearchInput,
    searchTerm,
    sortBy,
    setSortBy,
    filteredAndSortedJobs,
  } = useJobFiltering(jobs, { scope: 'personal', ownerId: user?.id ?? null });
  
  // Tab state synkad med URL (?tab=active|expired|draft)
  const tabParam = searchParams.get('tab') as JobStatusTab | null;
  const urlTab: JobStatusTab = tabParam === 'expired' || tabParam === 'draft' ? tabParam : 'active';

  // Optimistic local tab — uppdaterar indikatorn omedelbart vid klick.
  // Utan detta blockerar startTransition indikator-renderingen (låg-prio)
  // och tabben markeras inte förrän nästa interaktion triggar en ny render.
  const [optimisticTab, setOptimisticTab] = useState<JobStatusTab>(urlTab);
  useEffect(() => { setOptimisticTab(urlTab); }, [urlTab]);

  const activeTab = optimisticTab;
  // DOM-persistens i VirtualJobGrid gör tab-bytet billigt — inget behov av useDeferredValue.
  // Den orsakade dubbelblink (mellan-render med gamla tabben fortfarande aktiv).
  const listActiveTab = activeTab;

  // Global "Visa detaljer / Dölj detaljer" — kollapsibel-toggle för alla kort.
  const [expandAll, setExpandAll] = useState<boolean>(() => {
    try { return sessionStorage.getItem('employer_dashboard_expand_all') === '1'; } catch { return false; }
  });
  const toggleExpandAll = useCallback(() => {
    setExpandAll(v => {
      const next = !v;
      try { sessionStorage.setItem('employer_dashboard_expand_all', next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);


  const setActiveTab = useCallback((tab: JobStatusTab) => {
    setOptimisticTab(tab); // 0ms visuell respons för indikatorn
    startTransition(() => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (tab === 'active') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      }, { replace: true });
    });
  }, [setSearchParams]);
  
  // Pagination state for mobile
  const [page, setPage] = useState(1);
  const pageSize = 18;
  const listTopRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  const editLaunchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (editLaunchTimeoutRef.current) {
        window.clearTimeout(editLaunchTimeoutRef.current);
      }
    };
  }, []);
  
  // Check if there are any drafts.
  // Serverräkningen först: vid tusentals annonser kan utkasten ligga långt bak
  // i bakgrundsströmmen, och då dök fliken upp först efter flera sekunder.
  const hasDrafts = useMemo(
    () => (serverCounts?.draft ?? 0) > 0 || jobs.some(job => isEmployerJobDraft(job)),
    [serverCounts?.draft, jobs],
  );

  
  // Beräkna ALLA tre tabbars data samtidigt — gör DOM-persistens möjlig.
  // VirtualJobGrid håller alla tre i DOM:en (display:none för inaktiva)
  // så tab-byte blir en CSS-toggle istället för en full React-remount.
  const tabBuckets = useMemo(() => {
    const active: JobPosting[] = [];
    const expired: JobPosting[] = [];
    const draft: JobPosting[] = [];
    for (const j of filteredAndSortedJobs) {
      const jp = j as JobPosting;
      if (isEmployerJobDraft(jp)) draft.push(jp);
      else if (isEmployerJobExpired(jp)) expired.push(jp);
      else if (isEmployerJobActive(jp)) active.push(jp);
    }
    return { active, expired, draft };
  }, [filteredAndSortedJobs]);

  const tabFilteredJobs = activeTab === 'expired'
    ? tabBuckets.expired
    : activeTab === 'draft'
      ? tabBuckets.draft
      : tabBuckets.active;

  const activeTabTotalCount = searchTerm.trim()
    ? tabFilteredJobs.length
    : activeTab === 'expired'
      ? (serverCounts?.expired ?? tabBuckets.expired.length)
      : activeTab === 'draft'
        ? (serverCounts?.draft ?? tabBuckets.draft.length)
        : (serverCounts?.active ?? tabBuckets.active.length);

  // Ordered tabs for swipe navigation
  const tabOrder: JobStatusTab[] = useMemo(() => hasDrafts ? ['active', 'expired', 'draft'] : ['active', 'expired'], [hasDrafts]);

  const swipeToNextTab = useCallback(() => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx < tabOrder.length - 1) setActiveTab(tabOrder[idx + 1]);
  }, [activeTab, tabOrder, setActiveTab]);

  const swipeToPrevTab = useCallback(() => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx > 0) setActiveTab(tabOrder[idx - 1]);
  }, [activeTab, tabOrder, setActiveTab]);

  const tabSwipeHandlers = useSwipeGesture({ onSwipeLeft: swipeToNextTab, onSwipeRight: swipeToPrevTab, threshold: 50 });

  // Reset page when tab changes
  useEffect(() => { setPage(1); }, [activeTab]);

  // Markeringsläget får aldrig överleva ett tab-/sökbyte — annars raderar man
  // annonser man inte längre ser på skärmen.
  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [activeTab, searchTerm]);


  // Använd lokal data-längd så vi inte visar tomma sidor när server-count är högre
  // än vad som faktiskt laddats in i klienten.
  const totalPages = Math.max(1, Math.ceil(tabFilteredJobs.length / pageSize));

  // Klampa sidan när listan krymper (t.ex. massradering av hela sista sidan).
  // Utan detta stod man kvar på en sida som inte längre finns: tom lista och
  // "Visar 37–36 av 36".
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);


  // 🔥 Pre-warma BARA aktuell tab × current+next page (~40 bilder).
  // Tidigare prewarm av tusentals bilder mättade nätet och evictade cachen.
  // 🔑 URL:erna byggs med EXAKT samma källa, transform och version som
  // `MobileJobCard` renderar (job_image_url @ 600x400 q75 cover / logo 64x64
  // q80 contain). Minsta avvikelse → cache-MISS vid render, dubbel bandbredd.
  const prewarmEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize * 2;
    const currentBucket = activeTab === 'expired'
      ? tabBuckets.expired
      : activeTab === 'draft'
        ? tabBuckets.draft
        : tabBuckets.active;
    const window = currentBucket.slice(start, end);
    const entries: Array<{ path?: string | null; bucket?: 'job-images' | 'company-logos' }> = [];
    for (const j of window) {
      const v = getImageVersion(j as any);
      const cardUrl = buildCardImageUrl(j.job_image_url ?? (j as any).job_image_desktop_url ?? null, 'job-images', v, { width: 600, height: 400, quality: 75, resize: 'cover' });

      if (cardUrl) entries.push({ path: cardUrl });
      const logoUrl = buildCardImageUrl(j.company_logo_url ?? null, 'company-logos', v, { width: 64, height: 64, quality: 80, resize: 'contain' });
      if (logoUrl) entries.push({ path: logoUrl });
    }
    return entries;
  }, [tabBuckets, activeTab, page, pageSize]);
  useImagePrewarm(prewarmEntries);


  // Sida-slice för respektive tab så pagineringen funkar oberoende.
  const sliceToPage = useCallback((arr: JobPosting[]) => {
    const start = (page - 1) * pageSize;
    return arr.slice(start, start + pageSize);
  }, [page]);

  const pageJobs = useMemo(() => sliceToPage(tabFilteredJobs), [sliceToPage, tabFilteredJobs]);
  const pagedBuckets = useMemo(() => ({
    active: sliceToPage(tabBuckets.active),
    expired: sliceToPage(tabBuckets.expired),
    draft: sliceToPage(tabBuckets.draft),
  }), [sliceToPage, tabBuckets]);

  // Scroll to top when page changes (but not on initial mount)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (typeof window !== 'undefined') {
      const scrollContainer = getManagedScrollContainer();
      scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const positions = readPositions();
      positions[window.location.pathname] = { top: 0 };
      writePositions(positions);
    }
  }, [page]);

  const handleDeleteClick = (job: JobPosting) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  /**
   * 🗑️ Massradering — endast på "Utgångna" och "Utkast". Aktiva annonser är
   * medvetet undantagna: en live-annons ska aldrig kunna försvinna via en
   * bock-i-farten. Radering sker i chunkar om 200 id:n så en RLS-uppdatering
   * av 1 000 rader inte timeoutar, med tombstones + cache-städning i ett svep.
   */
  const bulkSelectable = activeTab === 'expired' || activeTab === 'draft';

  // Endast egna annonser kan massmarkeras — databasen tillåter bara ägaren att
  // ta bort en annons, så kollegors annonser får inte kunna bockas i.
  const isOwnJob = useCallback((j: { employer_id?: string | null }) => !j.employer_id || j.employer_id === user?.id, [user?.id]);
  const ownPageJobs = useMemo(() => pageJobs.filter(isOwnJob), [pageJobs, isOwnJob]);
  const ownTabJobs = useMemo(() => tabFilteredJobs.filter(isOwnJob), [tabFilteredJobs, isOwnJob]);

  const toggleSelected = useCallback((jobId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || bulkDeleting) return;
    setBulkDeleting(true);
    try {
      queryClient.setQueriesData({ queryKey: ['jobs'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const set = new Set(ids);
        return old.filter((j: any) => !set.has(j.id));
      });
      if (user?.id) removeJobsFromJobsCache(user.id, ids);

      const now = new Date().toISOString();
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('job_postings')
          .update({ deleted_at: now, is_active: false })
          .in('id', chunk);
        if (error) throw error;
      }

      toast({
        title: ids.length === 1 ? 'Annons borttagen' : `${ids.length} annonser borttagna`,
        description: 'Annonserna har tagits bort.',
      });
      setBulkDeleteOpen(false);
      exitSelectionMode();
      invalidateJobs();
    } catch (error: any) {
      invalidateJobs();
      toast({
        title: 'Kunde inte ta bort alla annonser',
        description: error?.message || 'Försök igen om en liten stund.',
        variant: 'destructive',
      });
    } finally {
      setBulkDeleting(false);
    }
  };


  const handleRepublishClick = (job: JobPosting) => {
    setRepublishJob(job);
    setRepublishDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;
    
    try {
      // Optimistic: remove from react-query cache immediately
      queryClient.setQueriesData({ queryKey: ['jobs'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((j: any) => j.id !== jobToDelete.id);
      });

      // Rensa localStorage-cachen direkt så annonsen inte blinkar tillbaka
      if (user?.id) removeJobFromJobsCache(user.id, jobToDelete.id);

      // Soft delete in DB — is_active måste nollas också, annars ligger raden
      // kvar som "aktiv" i alla vyer/räknare som bara tittar på is_active.
      const { error } = await supabase
        .from('job_postings')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', jobToDelete.id);

      if (error) {
        // Rollback on error
        invalidateJobs();
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

      setDeleteDialogOpen(false);
      setJobToDelete(null);
      // Background refetch to sync with server
      invalidateJobs();
    } catch (error) {
      invalidateJobs();
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte ta bort annonsen.",
        variant: "destructive"
      });
    }
  };

  const handleEditJob = (job: JobPosting, opts?: { republish?: boolean }) => {
    setEditingJob(job);
    setEditRepublishMode(!!opts?.republish);
    setEditDialogOpen(true);
  };

  // Handle editing draft jobs - use the same edit dialog flow as published jobs
  const handleEditDraft = (job: JobPosting) => {
    setEditingJob(job);
    setEditDialogOpen(true);
  };

  const handlePremiumEditOpen = useCallback((job: JobPosting) => {
    if (pendingEditJobId) return;

    setPendingEditJobId(job.id);

    if (editLaunchTimeoutRef.current) {
      window.clearTimeout(editLaunchTimeoutRef.current);
    }

    editLaunchTimeoutRef.current = window.setTimeout(() => {
      handleEditJob(job);

      setPendingEditJobId(null);
      editLaunchTimeoutRef.current = null;
    }, 150);
  }, [pendingEditJobId]);

  // Handle row click - drafts open wizard, active jobs go to details
  const handleJobRowClick = (job: JobPosting) => {
    if (!job.is_active) {
      handleEditDraft(job);
    } else {
      navigate(`/job-details/${job.id}`, { state: { fromRoute: '/my-jobs', fromTab: activeTab } });
    }
  };

  // Count active/expired/draft jobs consistently across employer views
  const activeJobs = useMemo(() => 
    jobs.filter(j => isEmployerJobActive(j)), 
    [jobs]
  );
  
  const expiredJobsCount = useMemo(() => 
    jobs.filter(j => isEmployerJobExpired(j)).length, 
    [jobs]
  );
  
  const draftJobsCount = useMemo(() => 
    jobs.filter(j => isEmployerJobDraft(j)).length, 
    [jobs]
  );
  
  /** Företaget har haft annonser tidigare (utgångna eller utkast finns) → annan tomlägestext */
  const hasPreviousJobs = useMemo(() => {
    const total = serverCounts?.total ?? jobs.length;
    const expired = serverCounts?.expired ?? expiredJobsCount;
    const draft = serverCounts?.draft ?? draftJobsCount;
    return total > 0 || expired > 0 || draft > 0;
  }, [serverCounts, jobs.length, expiredJobsCount, draftJobsCount]);

  // Klick på ett statistikkort → byt flik och glid mjukt ner till listan
  const goToTab = useCallback((tab: JobStatusTab) => {
    setActiveTab(tab);
    setPage(1);
    requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [setActiveTab, setPage]);

  const statsCards = useMemo(() => {
    const totalJobs = serverCounts?.total ?? jobs.length;
    const activeCount = serverCounts?.active ?? activeJobs.length;
    const expiredCount = serverCounts?.expired ?? expiredJobsCount;
    const draftCount = serverCounts?.draft ?? draftJobsCount;
    // Fallback = livstidstotal över ALLA annonser, samma definition som servern.
    const totalViews = serverStats?.total_views ?? jobs.reduce((s, j) => s + (j.views_count || 0), 0);
    const totalApps = serverStats?.total_applications ?? jobs.reduce((s, j) => s + (j.applications_count || 0), 0);

    // ⚠️ De förladdade sessionStorage-siffrorna är ORGANISATIONS-scopade
    // (aktiva/visningar/ansökningar för hela företaget). Den här sidan visar
    // MINA annonser. Så fort de personliga server-siffrorna finns (de seedas
    // direkt från localStorage) använder vi dem — annars hoppade siffran ner
    // från företagets totaler till mina egna när listan blev klar.
    const seeded = !!serverCounts;
    const seededStats = !!serverStats;
    return [
      { icon: Briefcase, title: 'Annonser', value: loading && !seeded ? preloadedEmployerMyJobs : totalJobs, loading: false, isLoading: loading, cacheKey: 'emp_total_jobs' },
      {
        icon: TrendingUp,
        title: 'Aktiva',
        value: loading && !seeded ? preloadedEmployerActiveJobs : activeCount,
        loading: false,
        isLoading: loading,
        cacheKey: 'emp_active_jobs',
        onClick: () => goToTab('active'),
        ariaLabel: 'Visa aktiva annonser',
        subItems: [
          { label: 'Utgångna', value: expiredCount, cacheKey: 'emp_expired_jobs', onClick: () => goToTab('expired'), ariaLabel: 'Visa utgångna annonser' },
          { label: 'Utkast', value: draftCount, cacheKey: 'emp_draft_jobs', onClick: () => goToTab('draft'), ariaLabel: 'Visa utkast' },
        ],
      },
      { icon: Eye, title: 'Visningar', value: loading && !seededStats ? preloadedEmployerTotalViews : totalViews, loading: false, isLoading: loading, cacheKey: 'emp_total_views' },
      { icon: Users, title: 'Ansökningar', value: loading && !seededStats ? preloadedEmployerTotalApplications : totalApps, loading: false, isLoading: loading, cacheKey: 'emp_total_apps', onClick: () => navigate('/candidates'), ariaLabel: 'Visa alla kandidater' },
    ];
  }, [jobs.length, activeJobs, expiredJobsCount, draftJobsCount, loading, serverCounts, serverStats, preloadedEmployerMyJobs, preloadedEmployerActiveJobs, preloadedEmployerTotalViews, preloadedEmployerTotalApplications, goToTab, navigate]);

  // Full-screen skeleton vid kall mount i tab-sessionen — visas tills första data
  // landar oavsett om localStorage-cachen var varm (mirror av seeker SearchJobs).
  if (!initialLoadDone) {
    return <EmployerDashboardSkeleton showDrafts titleWidthClass="w-48" />;
  }
  // Sidebar-navigering (varm cache) → osynlig placeholder under fade-in delay.
  if (loading || !showContent) {
    return (
      <div className="space-y-4 responsive-container-wide opacity-0 [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]" aria-hidden="true">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  // Always fade in on mount — symmetric with dashboard
  const fadeClass = '';

  return (
     <div className={`space-y-4 responsive-container-wide [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)] ${fadeClass}`}>
      <div className="flex justify-center items-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Mina jobbannonser</h1>
      </div>

      <StatsGrid stats={statsCards} />

      <JobSearchBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        sortBy={sortBy}
        onSortChange={setSortBy}
        companyName={profile?.company_name || 'företaget'}
        hasDrafts={hasDrafts}
      />

      <div ref={listTopRef} className="scroll-mt-4" />
      {/* Status tabs: Aktiva / Utgångna / Utkast + sidindikator */}
      <div className="relative flex justify-center items-center pr-11 sm:pr-0">
        <JobStatusTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeCount={serverCounts?.active ?? activeJobs.length}
          expiredCount={serverCounts?.expired ?? expiredJobsCount}
          draftCount={serverCounts?.draft ?? draftJobsCount}
          showDrafts
        />
        <button
          type="button"
          onClick={toggleExpandAll}
          aria-label={expandAll ? 'Dölj detaljer' : 'Visa detaljer'}
          title={expandAll ? 'Dölj detaljer' : 'Visa detaljer'}
          className="absolute right-0 inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-colors"
        >
          {expandAll ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{expandAll ? 'Dölj detaljer' : 'Visa detaljer'}</span>
        </button>
        {totalPages > 1 && (
          <span className="hidden xl:inline absolute right-40 text-sm text-white">
            Sida {page} av {totalPages}
          </span>
        )}
      </div>

      {/* Antalsindikator: visar alltid hur många av totalen som syns på sidan */}
      {!searchTerm && tabFilteredJobs.length > 0 && (
        <div className="mt-2 text-center text-xs sm:text-sm text-white">
          Visar {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, tabFilteredJobs.length)} av {tabFilteredJobs.length} annonser
        </div>
      )}

      {/* 🗑️ Massradering — endast utgångna/utkast */}
      {bulkSelectable && tabFilteredJobs.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {!selectionMode ? (
            <button
              type="button"
              onClick={() => setSelectionMode(true)}
              className="inline-flex items-center rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-colors"
            >
              Markera flera
            </button>
          ) : (
            <>
              <span className="text-xs sm:text-sm text-white font-medium">
                {selectedIds.size} markerade
              </span>
              <button
                type="button"
                onClick={() => {
                  const pageIds = ownPageJobs.map(j => j.id);
                  const allSelected = pageIds.every(id => selectedIds.has(id));
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    for (const id of pageIds) {
                      if (allSelected) next.delete(id); else next.add(id);
                    }
                    return next;
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-colors"
              >
                {ownPageJobs.length > 0 && ownPageJobs.every(j => selectedIds.has(j.id)) ? 'Avmarkera sidan' : 'Markera sidan'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(ownTabJobs.map(j => j.id)))}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-colors"
              >
                Markera alla ({ownTabJobs.length})
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => setBulkDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-400/40 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Ta bort markerade
              </button>
              <button
                type="button"
                onClick={exitSelectionMode}
                aria-label="Avbryt markering"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Avbryt
              </button>
            </>
          )}
        </div>
      )}



      {/* Result indicator */}
      {searchTerm && (
        <div className="text-sm text-white mb-4">
          {tabFilteredJobs.length === 0 ? (
            <span>Inga annonser stämde med din sökning.</span>
          ) : (
            <span>
              Visar {tabFilteredJobs.length} av {jobs.length} annonser
            </span>
          )}
        </div>
      )}

      {/* Desktop: Card grid — virtualiserad + DOM-persistent över tabbar */}
      <div className="hidden md:block">
        {tabFilteredJobs.length === 0 ? (
          searchTerm.trim() ? (
            <div className="text-center text-white py-12 font-medium text-sm">
              Inga annonser stämde med din sökning.
            </div>
          ) : activeTab === 'active' ? (
            <EmptyJobsCta hasPreviousJobs={hasPreviousJobs} />
          ) : (
            <div className="text-center text-white py-12 font-medium text-sm">
              {activeTab === 'expired' ? 'Inga utgångna jobbannonser.' : 'Inga utkast.'}
            </div>
          )
        ) : (
          <>
            <VirtualJobGrid
              activeTab={listActiveTab}
              tabs={[
                { key: 'active', jobs: pagedBuckets.active },
                { key: 'expired', jobs: pagedBuckets.expired },
                { key: 'draft', jobs: pagedBuckets.draft },
              ]}
              gridClassName="job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              renderCard={(job, idx) => (
                <CardErrorBoundary>
                  <div className="relative">
                    <MobileJobCard
                      job={job}
                      onEdit={handleEditJob}
                      onDelete={handleDeleteClick}
                      onEditDraft={handleEditDraft}
                      onPrefetch={prefetchJob}
                      onRepublish={handleRepublishClick}
                      cardIndex={idx}
                      collapsible
                      expanded={expandAll}
                    />
                    {selectionMode && bulkSelectable && isOwnJob(job) && (
                      <button
                        type="button"
                        onClick={() => toggleSelected(job.id)}
                        aria-pressed={selectedIds.has(job.id)}
                        aria-label={`${selectedIds.has(job.id) ? 'Avmarkera' : 'Markera'} ${job.title}`}
                        className={`absolute inset-0 z-20 flex items-start justify-end rounded-2xl p-3 transition-colors ${
                          selectedIds.has(job.id) ? 'bg-primary/25 ring-2 ring-white/70' : 'bg-black/25 hover:bg-black/15'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                            selectedIds.has(job.id)
                              ? 'bg-white border-white'
                              : 'bg-white/15 border-white/60 backdrop-blur-sm'
                          }`}
                        >
                          {selectedIds.has(job.id) && <Check className="h-4 w-4 text-primary" />}
                        </span>
                      </button>
                    )}
                  </div>
                </CardErrorBoundary>
              )}

            />
            <DashboardPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Mobile: Card view — virtualiserad + DOM-persistent över tabbar */}
      <div className="md:hidden touch-pan-y" onTouchStart={tabSwipeHandlers.onTouchStart} onTouchMove={tabSwipeHandlers.onTouchMove} onTouchEnd={tabSwipeHandlers.onTouchEnd}>
        {loading ? (
          <div className="space-y-3 px-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-white/10" />
                    <Skeleton className="h-3 w-1/2 bg-white/10" />
                    <div className="flex gap-2 mt-2">
                      <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
                      <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tabFilteredJobs.length === 0 ? (
          searchTerm.trim() ? (
            <div className="text-center text-white py-8 font-medium text-sm min-h-[40vh] flex items-center justify-center">
              <span>Inga annonser stämde med din sökning.</span>
            </div>
          ) : activeTab === 'active' ? (
            <EmptyJobsCta compact hasPreviousJobs={hasPreviousJobs} />
          ) : (
            <div className="text-center text-white py-8 font-medium text-sm min-h-[40vh] flex items-center justify-center">
              <span>{activeTab === 'expired' ? 'Inga utgångna jobbannonser.' : 'Inga utkast.'}</span>
            </div>
          )
        ) : (
          <>
            <VirtualJobGrid
              activeTab={listActiveTab}
              tabs={[
                { key: 'active', jobs: pagedBuckets.active },
                { key: 'expired', jobs: pagedBuckets.expired },
                { key: 'draft', jobs: pagedBuckets.draft },
              ]}
              className=""
              gridClassName="job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              renderCard={(job, idx) => (
                <CardErrorBoundary>
                  <div className="relative">
                    <MobileJobCard
                      job={job}
                      onEdit={handlePremiumEditOpen}
                      onDelete={handleDeleteClick}
                      onEditDraft={handleEditDraft}
                      onPrefetch={prefetchJob}
                      onRepublish={handleRepublishClick}
                      cardIndex={idx}
                      collapsible
                      expanded={expandAll}
                    />
                    {selectionMode && bulkSelectable && isOwnJob(job) && (
                      <button
                        type="button"
                        onClick={() => toggleSelected(job.id)}
                        aria-pressed={selectedIds.has(job.id)}
                        aria-label={`${selectedIds.has(job.id) ? 'Avmarkera' : 'Markera'} ${job.title}`}
                        className={`absolute inset-0 z-20 flex items-start justify-end rounded-2xl p-3 transition-colors ${
                          selectedIds.has(job.id) ? 'bg-primary/25 ring-2 ring-white/70' : 'bg-black/25 hover:bg-black/15'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                            selectedIds.has(job.id)
                              ? 'bg-white border-white'
                              : 'bg-white/15 border-white/60 backdrop-blur-sm'
                          }`}
                        >
                          {selectedIds.has(job.id) && <Check className="h-4 w-4 text-primary" />}
                        </span>
                      </button>
                    )}
                  </div>
                </CardErrorBoundary>
              )}

            />
            <DashboardPagination page={page} totalPages={totalPages} onPageChange={setPage} compact />
          </>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0 max-h-[90dvh] flex flex-col"
        >
          <AlertDialogHeader className="space-y-4 text-center flex-shrink-0">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort jobbannons
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <div className="overflow-y-auto flex-1 my-4">
            <AlertDialogDescription className="text-white text-sm leading-relaxed text-center">
              {jobToDelete && (
                <>
                  Är du säker på att du vill ta bort <TruncatedText text={`"${jobToDelete.title}"`} className="font-semibold text-white break-words" />? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center flex-shrink-0">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setJobToDelete(null);
              }}
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteJob}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => { if (!bulkDeleting) setBulkDeleteOpen(o); }}>
        <AlertDialogContentNoFocus
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0 max-h-[90dvh] flex flex-col"
        >
          <AlertDialogHeader className="space-y-4 text-center flex-shrink-0">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort {selectedIds.size} {selectedIds.size === 1 ? 'annons' : 'annonser'}
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <div className="overflow-y-auto flex-1 my-4">
            <AlertDialogDescription className="text-white text-sm leading-relaxed text-center">
              Du är på väg att ta bort {selectedIds.size} {activeTab === 'draft' ? 'utkast' : 'utgångna annonser'}. Ansökningar och statistik för dessa annonser försvinner från dina vyer. Denna åtgärd går inte att ångra.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center flex-shrink-0">
            <AlertDialogCancel
              disabled={bulkDeleting}
              onClick={() => setBulkDeleteOpen(false)}
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmBulkDelete(); }}
              disabled={bulkDeleting}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {bulkDeleting ? 'Tar bort…' : 'Ta bort'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

      <EditJobDialog

        job={editingJob}
        open={editDialogOpen}
        republishMode={editRepublishMode}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditRepublishMode(false);
        }}
        onJobUpdated={invalidateJobs}
        onPublished={() => {
          // Hoppa till "Aktiva" så att den nypublicerade annonsen syns direkt
          setActiveTab('active');
          setPage(1);
          // Glid mjukt upp till toppen så man ser statistiken uppdateras
          if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
              getManagedScrollContainer()?.scrollTo({ top: 0, behavior: 'smooth' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
              const positions = readPositions();
              positions[window.location.pathname] = { top: 0 };
              writePositions(positions);
            });
          }
        }}
      />

      <RepublishJobDialog
        jobId={republishJob?.id ?? null}
        jobTitle={republishJob?.title}
        open={republishDialogOpen}
        onOpenChange={(open) => {
          setRepublishDialogOpen(open);
          if (!open) setRepublishJob(null);
        }}
        onRepublished={() => {
          invalidateJobs();
          setRepublishJob(null);
        }}
        onEditFirst={() => {
          const job = republishJob;
          setRepublishJob(null);
          if (job) handleEditJob(job, { republish: true });
        }}
      />
    </div>
  );
});

EmployerDashboard.displayName = 'EmployerDashboard';

export default EmployerDashboard;
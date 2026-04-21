import { useState, memo, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Eye, Edit, Trash2, AlertTriangle, Briefcase, TrendingUp, Users } from 'lucide-react';
import EditJobDialog from '@/components/EditJobDialog';
import { useJobsData, type JobPosting } from '@/hooks/useJobsData';
import { MobileJobCard } from '@/components/MobileJobCard';

import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
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

type JobStatusTab = 'active' | 'expired' | 'draft';

/** Lightweight inline pagination — no external dependency, identical visual to previous inline version */
const SimplePagination = memo(({ page, totalPages, onPageChange, className = '' }: { page: number; totalPages: number; onPageChange: (p: number) => void; className?: string }) => (
  <div className={`flex items-center justify-center gap-6 text-xs ${className}`}>
    <button
      onClick={() => onPageChange(Math.max(1, page - 1))}
      disabled={page === 1}
      className={`flex items-center gap-1.5 text-white transition-colors ${page === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-70'}`}
    >
      <span className="text-lg leading-none">‹</span>
      <span>Föreg</span>
    </button>
    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(n => (
      <button
        key={n}
        onClick={() => onPageChange(n)}
        className={`px-1 text-white transition-colors ${page === n ? 'font-medium' : 'opacity-60 hover:opacity-100 cursor-pointer'}`}
      >
        {n}
      </button>
    ))}
    <button
      onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      disabled={page === totalPages}
      className={`flex items-center gap-1.5 text-white transition-colors ${page === totalPages ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-70'}`}
    >
      <span>Nästa</span>
      <span className="text-lg leading-none">›</span>
    </button>
  </div>
));
SimplePagination.displayName = 'SimplePagination';

const EmployerDashboard = memo(() => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  const queryClient = useQueryClient();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
  
  const {
    searchInput,
    setSearchInput,
    searchTerm,
    sortBy,
    setSortBy,
    filteredAndSortedJobs,
  } = useJobFiltering(jobs);
  
  // Tab state synkad med URL (?tab=active|expired|draft)
  const tabParam = searchParams.get('tab') as JobStatusTab | null;
  const activeTab: JobStatusTab = tabParam === 'expired' || tabParam === 'draft' ? tabParam : 'active';
  const setActiveTab = useCallback((tab: JobStatusTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'active') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  
  // Pagination state for mobile
  const [page, setPage] = useState(1);
  const pageSize = 20;
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
  
  // Check if there are any drafts
  const hasDrafts = useMemo(() => jobs.some(job => isEmployerJobDraft(job)), [jobs]);
  
  // Filter jobs by active tab BEFORE pagination
  const tabFilteredJobs = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return filteredAndSortedJobs.filter(j => isEmployerJobActive(j));
      case 'expired':
        return filteredAndSortedJobs.filter(j => isEmployerJobExpired(j));
      case 'draft':
        return filteredAndSortedJobs.filter(j => isEmployerJobDraft(j));
      default:
        return filteredAndSortedJobs;
    }
  }, [filteredAndSortedJobs, activeTab]);

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
  
  const totalPages = Math.max(1, Math.ceil(tabFilteredJobs.length / pageSize));
  const pageJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return tabFilteredJobs.slice(start, start + pageSize);
  }, [tabFilteredJobs, page]);

  // 🚀 Chunked rendering: first 6 cards instant, rest in next idle frame.
  // Eliminates the "cold mount" hack when switching to a tab with many cards.

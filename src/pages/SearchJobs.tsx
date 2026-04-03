import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';

import { cn } from '@/lib/utils';
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
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, Briefcase, Building } from 'lucide-react';
import { SwipeFullscreen } from '@/components/SwipeFullscreen';
import { useIsMobile } from '@/hooks/use-mobile'; // kept for swipe mode layout
import { useTouchCapable } from '@/hooks/useInputCapability';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { getTimeRemaining } from '@/lib/date'; // kept for swipe jobs mapping
import { StatsGrid } from '@/components/StatsGrid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { preloadImages } from '@/lib/serviceWorkerManager';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { useOptimizedJobSearch } from '@/hooks/useOptimizedJobSearch';
import { useSavedSearches, SearchCriteria } from '@/hooks/useSavedSearches';
import { SaveSearchDialog } from '@/components/SaveSearchDialog';
import { useBatchPrefetchReviews, useBatchPrefetchCompanyProfiles } from '@/hooks/useCompanyReviewsCache';

import { SearchFiltersPanel } from '@/components/search/SearchFiltersPanel';
import { CompanySuggestionCard } from '@/components/search/CompanySuggestionCard';
import { SwipeModeToggle } from '@/components/search/SwipeModeToggle';
import { useJobPrefetchCache } from '@/hooks/useJobPrefetchCache';
import { useTapToPreview } from '@/hooks/useTapToPreview';

interface Job {
  id: string;
  title: string;
  company_name: string;
  company_logo_url?: string;
  company_avg_rating?: number;
  company_review_count?: number;
  location: string;
  workplace_city?: string;
  workplace_postal_code?: string;
  employment_type: string;
  salary_min?: number;
  salary_max?: number;
  description: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  job_image_url?: string;
  image_focus_position?: string;
  employer_id?: string;
  employer_profile?: {
    first_name: string;
    last_name: string;
  };
  profiles?: {
    company_name: string | null;
  };
}

// Pure utility — moved outside component to avoid re-creation on every render
const formatSalary = (min?: number, max?: number) => {
  if (min && max) {
    return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
  } else if (min) {
    return `Från ${min.toLocaleString()} kr/mån`;
  } else if (max) {
    return `Upp till ${max.toLocaleString()} kr/mån`;
  }
  return 'Enligt överenskommelse';
};

const SearchJobs = memo(() => {
  const navigate = useNavigate();
  // toast and blurHandlers removed — no longer needed after filter extraction
  const queryClient = useQueryClient();

  // Delayed fade-in (employer-side parity)
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);
  const { preloadedTotalJobs, preloadedUniqueCompanies, preloadedNewThisWeek, user } = useAuth();
  const { isJobSaved, toggleSaveJob, unsaveJob } = useSavedJobs();
  const { seedJobsFromSearch } = useJobPrefetchCache();
  
  const { savedSearches, saveSearch, deleteSearch, hasActiveFilters, totalNewMatches, clearNewMatches } = useSavedSearches();
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);
  const isTouchCapable = useTouchCapable();
  const isMobile = useIsMobile();
  const [swipeModeActive, setSwipeModeActive] = useState(false);
  const [jobToUnsave, setJobToUnsave] = useState<{ id: string; title: string } | null>(null);
  const [selectedCompanies, setSelectedCompaniesRaw] = useState<string[]>(() => {
    try { const raw = sessionStorage.getItem('parium-search-filters'); return raw ? (JSON.parse(raw).companies || []) : []; } catch { return []; }
  });
  const setSelectedCompanies = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setSelectedCompaniesRaw(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      try { const current = JSON.parse(sessionStorage.getItem('parium-search-filters') || '{}'); sessionStorage.setItem('parium-search-filters', JSON.stringify({ ...current, companies: next })); } catch {}
      return next;
    });
  }, []);
  const { handleTap: handleCompanyTap, isPreview: isCompanyPreview, resetPreview: resetCompanyPreview } = useTapToPreview();
  const companyTextRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const handleUnsaveClick = useCallback((jobId: string, jobTitle: string) => {
    setJobToUnsave({ id: jobId, title: jobTitle });
  }, []);

  const confirmUnsave = useCallback(() => {
    if (!jobToUnsave) return;
    unsaveJob(jobToUnsave.id);
    setJobToUnsave(null);
  }, [jobToUnsave, unsaveJob]);

  // Handler to apply a saved search - sets all the filter states
  // 🔥 PREMIUM: Sätter BÅDE searchInput OCH debouncedSearch direkt för omedelbar respons
  const handleApplySavedSearch = useCallback((criteria: SearchCriteria) => {
    // Invalidera cache
    queryClient.removeQueries({ queryKey: ['optimized-job-search'] });
    
    const newSearchQuery = criteria.search_query || '';
    
    // 🔥 CRITICAL: Sätt BÅDA för att skippa debounce-fördröjning
    setSearchInput(newSearchQuery);
    setDebouncedSearch(newSearchQuery); // Omedelbar sökning utan 300ms väntan
    
    setSelectedCity(criteria.city || '');
    setSelectedPostalCode('');
    setSelectedCategory(criteria.category || 'all-categories');
    setSelectedSubcategories([]);
    setSelectedEmploymentTypes(criteria.employment_types || []);
    
    // Expand filters if there are active filters to show
    if (criteria.city || criteria.category || criteria.employment_types?.length) {
      setFiltersExpanded(true);
    }
    
    // Reset display count to show fresh results
    setDisplayCount(20);
    
    // Scroll to top of results
    listTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [queryClient]);
  
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
    staleTime: 0,
    gcTime: Infinity,
    structuralSharing: false,
  });
  // --- Session-persistent filter state (survives refresh, resets on app close) ---
  const SS_KEY = 'parium-search-filters';
  const savedFilters = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, []);
  const persistFilters = useCallback((patch: Record<string, unknown>) => {
    try {
      const current = JSON.parse(sessionStorage.getItem(SS_KEY) || '{}');
      sessionStorage.setItem(SS_KEY, JSON.stringify({ ...current, ...patch }));
    } catch {}
  }, []);

  const [searchInput, setSearchInputRaw] = useState<string>(savedFilters.q || '');
  const setSearchInput = useCallback((v: string) => { setSearchInputRaw(v); persistFilters({ q: v }); }, [persistFilters]);

  const [sortBy, setSortByRaw] = useState<'newest' | 'oldest' | 'most-views'>(savedFilters.sort || 'newest');
  const setSortBy = useCallback((v: 'newest' | 'oldest' | 'most-views') => { setSortByRaw(v); persistFilters({ sort: v }); }, [persistFilters]);

  const [timeFilter, setTimeFilterState] = useState<'all' | '12h' | '24h' | '3d' | '7d'>(() => {
    if (savedFilters.time && ['all', '12h', '24h', '3d', '7d'].includes(savedFilters.time)) return savedFilters.time;
    try {
      const saved = localStorage.getItem('parium-search-time-filter');
      if (saved && ['all', '12h', '24h', '3d', '7d'].includes(saved)) return saved as any;
    } catch {}
    return 'all';
  });
  const setTimeFilter = useCallback((v: 'all' | '12h' | '24h' | '3d' | '7d') => {
    setTimeFilterState(v);
    try { localStorage.setItem('parium-search-time-filter', v); } catch {}
    persistFilters({ time: v });
  }, [persistFilters]);

  const [selectedPostalCode, setSelectedPostalCodeRaw] = useState(savedFilters.postal || '');
  const setSelectedPostalCode = useCallback((v: string) => { setSelectedPostalCodeRaw(v); persistFilters({ postal: v }); }, [persistFilters]);

  const [selectedCity, setSelectedCityRaw] = useState(savedFilters.city || '');
  const setSelectedCity = useCallback((v: string) => { setSelectedCityRaw(v); persistFilters({ city: v }); }, [persistFilters]);

  const [isPostalCodeValid, setIsPostalCodeValid] = useState(false);

  const [selectedCategory, setSelectedCategoryRaw] = useState(savedFilters.cat || 'all-categories');
  const setSelectedCategory = useCallback((v: string) => { setSelectedCategoryRaw(v); persistFilters({ cat: v }); }, [persistFilters]);

  const [selectedSubcategories, setSelectedSubcategoriesRaw] = useState<string[]>(savedFilters.subcats || []);
  const setSelectedSubcategories = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setSelectedSubcategoriesRaw(prev => { const next = typeof v === 'function' ? v(prev) : v; persistFilters({ subcats: next }); return next; });
  }, [persistFilters]);

  const [selectedEmploymentTypes, setSelectedEmploymentTypesRaw] = useState<string[]>(savedFilters.empTypes || []);
  const setSelectedEmploymentTypes = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setSelectedEmploymentTypesRaw(prev => { const next = typeof v === 'function' ? v(prev) : v; persistFilters({ empTypes: next }); return next; });
  }, [persistFilters]);

  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Company suggestion state
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  // Lazy loading state with infinite scroll
  const [displayCount, setDisplayCount] = useState(20); // Start with 20 jobs
  const loadMoreSize = 20; // Load 20 more each time
  const listTopRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);

  

  // Debounced search for better performance
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Use the new optimized job search hook with full-text search
  const { jobs, isLoading } = useOptimizedJobSearch({
    searchQuery: debouncedSearch,
    city: selectedCity,
    employmentTypes: selectedEmploymentTypes,
    category: selectedCategory,
    subcategories: selectedSubcategories,
    enabled: true,
  });

  // Prefetch reviews and company profiles for all companies in results for instant dialog load
  const prefetchReviews = useBatchPrefetchReviews();
  const prefetchProfiles = useBatchPrefetchCompanyProfiles();
  const companyIds = useMemo(() => {
    return [...new Set(jobs.map(job => job.employer_id).filter(Boolean))] as string[];
  }, [jobs]);

  // Prefetch reviews AND profiles when jobs load
  useEffect(() => {
    if (companyIds.length > 0) {
      prefetchReviews(companyIds);
      prefetchProfiles(companyIds);
    }
  }, [companyIds, prefetchReviews, prefetchProfiles]);

  // Förladdda alla jobbbilder via Service Worker för persistent cache
  const jobImageUrls = useMemo(() => {
    return jobs.map(job => job.job_image_url).filter(Boolean) as string[];
  }, [jobs]);

  // Preload via Service Worker när bilder laddas
  useEffect(() => {
    if (jobImageUrls.length > 0) {
      preloadImages(jobImageUrls);
    }
  }, [jobImageUrls]);

  // 🔥 PREFETCH: Seed job data into React Query cache for instant JobView rendering
  useEffect(() => {
    if (jobs.length > 0) {
      seedJobsFromSearch(jobs);
    }
  }, [jobs, seedJobsFromSearch]);

  // Realtime hanteras redan av useOptimizedJobSearch — ingen dubbel prenumeration behövs

  // Sort jobs (filtering is now done in database for performance)
  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];

    // Company filter
    if (selectedCompanies.length > 0) {
      result = result.filter(j => selectedCompanies.includes(j.company_name));
    }

    // Time filter
    if (timeFilter !== 'all') {
      const now = Date.now();
      const hoursMap = { '12h': 12, '24h': 24, '3d': 72, '7d': 168 };
      const cutoff = now - hoursMap[timeFilter] * 60 * 60 * 1000;
      result = result.filter(j => new Date(j.created_at).getTime() >= cutoff);
    }

    // Sort based on user preference
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'most-views':
        result.sort((a, b) => b.views_count - a.views_count);
        break;
    }

    return result;
  }, [jobs, sortBy, timeFilter, selectedCompanies]);

  // Display jobs with lazy loading
  const displayedJobs = useMemo(() => {
    return filteredAndSortedJobs.slice(0, displayCount);
  }, [filteredAndSortedJobs, displayCount]);

  const hasMoreJobs = displayCount < filteredAndSortedJobs.length;

  // Memoize swipe jobs to avoid re-mapping on every render
  const swipeJobs = useMemo(() => filteredAndSortedJobs.map(job => ({
    id: job.id,
    title: job.title,
    company_name: job.company_name,
    location: job.workplace_city || job.location,
    employment_type: job.employment_type,
    job_image_url: job.job_image_url,
    image_focus_position: job.image_focus_position,
    views_count: job.views_count,
    applications_count: job.applications_count,
    created_at: job.created_at,
    expires_at: job.expires_at,
    employer_id: job.employer_id,
    description: job.description,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
  })), [filteredAndSortedJobs]);

  // Find matching companies for smart search suggestion
  // 🔥 CRITICAL: Använd debouncedSearch OCH kontrollera att det matchar searchInput
  // Detta förhindrar blinkande företagsförslag vid sparad sökning
  const matchingCompany = useMemo(() => {
    // Visa bara om debounce är klar (debouncedSearch === searchInput)
    // och vi inte är mitt i en sökning
    if (!debouncedSearch.trim() || debouncedSearch.length < 2) return null;
    if (debouncedSearch !== searchInput) return null; // Debounce pågår - visa inget
    if (isLoading) return null; // Fortfarande laddar - visa inget
    
    const searchLower = debouncedSearch.toLowerCase().trim();
    
    // Get unique companies from jobs with job count and rating
    const uniqueCompanies = new Map<string, { id: string; name: string; logo?: string; jobCount: number; avgRating?: number; reviewCount: number }>();
    jobs.forEach(job => {
      if (job.company_name && job.company_name !== 'Okänt företag') {
        const companyLower = job.company_name.toLowerCase();
        // Check if search term matches company name (partial match)
        if (companyLower.includes(searchLower) || searchLower.includes(companyLower.split(' ')[0])) {
          const existing = uniqueCompanies.get(job.company_name);
          if (existing) {
            existing.jobCount++;
          } else {
            uniqueCompanies.set(job.company_name, {
              id: job.employer_id || '',
              name: job.company_name,
              logo: job.company_logo_url,
              jobCount: 1,
              avgRating: job.company_avg_rating,
              reviewCount: job.company_review_count || 0
            });
          }
        }
      }
    });
    
    // Return first matching company
    const matches = Array.from(uniqueCompanies.values());
    return matches.length > 0 ? matches[0] : null;
  }, [jobs, debouncedSearch, searchInput, isLoading]);

  // Company data for dropdown-selected company filters
  const selectedCompaniesData = useMemo(() => {
    if (selectedCompanies.length === 0) return [];
    return selectedCompanies.map(companyName => {
      const data = { id: '', name: companyName, logo: undefined as string | undefined, jobCount: 0, avgRating: undefined as number | undefined, reviewCount: 0 };
      jobs.forEach(job => {
        if (job.company_name === companyName) {
          data.jobCount++;
          if (!data.id) data.id = job.employer_id || '';
          if (!data.logo) data.logo = job.company_logo_url;
          if (!data.avgRating) data.avgRating = job.company_avg_rating;
          if (!data.reviewCount) data.reviewCount = job.company_review_count || 0;
        }
      });
      return data;
    });
  }, [jobs, selectedCompanies]);

  // Reset display count and default sort when filters change
  useEffect(() => {
    setDisplayCount(20);
    setSortBy('newest');
  }, [searchInput, selectedCity, selectedCategory, selectedSubcategories, selectedEmploymentTypes]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreJobs && !isLoadingMoreRef.current) {
          isLoadingMoreRef.current = true;
          setDisplayCount(prev => {
            const next = Math.min(prev + loadMoreSize, filteredAndSortedJobs.length);
            // Reset loading flag after state update
            setTimeout(() => { isLoadingMoreRef.current = false; }, 100);
            return next;
          });
        }
      },
      { 
        rootMargin: '200px', // Start loading 200px before reaching the trigger
        threshold: 0.1 
      }
    );

    observer.observe(trigger);
    return () => observer.disconnect();
  }, [hasMoreJobs, filteredAndSortedJobs.length, loadMoreSize]);

  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + loadMoreSize, filteredAndSortedJobs.length));
  }, [filteredAndSortedJobs.length, loadMoreSize]);

  // formatSalary moved to top-level scope for performance

  // jobs from useOptimizedJobSearch already filters expired — use directly
  const activeJobCount = useMemo(() => filteredAndSortedJobs.length, [filteredAndSortedJobs]);
  const uniqueCompanyCount = useMemo(() => new Set(filteredAndSortedJobs.map(j => j.company_name)).size, [filteredAndSortedJobs]);
  const newThisWeekCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return filteredAndSortedJobs.filter(j => new Date(j.created_at).getTime() > weekAgo).length;
  }, [filteredAndSortedJobs]);

  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Aktiva jobb', value: activeJobCount, loading: false, cacheKey: 'search_active_jobs' },
    { icon: Building, title: 'Unika företag', value: uniqueCompanyCount, loading: false, cacheKey: 'search_unique_companies' },
    { icon: TrendingUp, title: 'Nya denna vecka', value: newThisWeekCount, loading: false, cacheKey: 'search_new_this_week' },
  ], [activeJobCount, uniqueCompanyCount, newThisWeekCount]);

  const handleClearAllFilters = useCallback(() => {
    setSelectedPostalCode('');
    setSelectedCity('');
    setSelectedEmploymentTypes([]);
    setSelectedCategory('all-categories');
    setSelectedSubcategories([]);
    setSearchInput('');
    setTimeFilter('all');
    setSelectedCompanies([]);
    try { sessionStorage.removeItem('parium-search-filters'); } catch {}
  }, [setSelectedPostalCode, setSelectedCity, setSelectedEmploymentTypes, setSelectedCategory, setSelectedSubcategories, setSearchInput, setTimeFilter, setSelectedCompanies]);

  const handleLocationChange = (location: string, postalCode?: string) => {
    setSelectedCity(location);
    setSelectedPostalCode(postalCode || '');
  };

  if (!showContent) {
    return <div className="space-y-3 md:space-y-4 responsive-container-wide opacity-0" aria-hidden="true" />;
  }

   return (
     <div className="space-y-3 md:space-y-4 responsive-container-wide animate-fade-in">
      {/* Compact header: title centered + stats inline on mobile */}
      <div className="flex items-center justify-center mb-1 md:mb-4">
        <h1 className="text-lg md:text-2xl font-semibold text-white tracking-tight text-center">Sök Jobb</h1>
      </div>

      {/* Stats grid — hidden on mobile (shown inline above), visible on desktop */}
      <div className="hidden md:block">
        <StatsGrid stats={statsCards} />
      </div>

      <SearchFiltersPanel
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        selectedCity={selectedCity}
        selectedPostalCode={selectedPostalCode}
        onLocationChange={handleLocationChange}
        onPostalCodeChange={setSelectedPostalCode}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedSubcategories={selectedSubcategories}
        onSubcategoriesChange={setSelectedSubcategories}
        selectedEmploymentTypes={selectedEmploymentTypes}
        onEmploymentTypesChange={setSelectedEmploymentTypes}
        sortBy={sortBy}
        onSortChange={setSortBy}
        filtersExpanded={filtersExpanded}
        onFiltersExpandedChange={setFiltersExpanded}
        savedSearches={savedSearches}
        totalNewMatches={totalNewMatches}
        onApplySavedSearch={handleApplySavedSearch}
        onDeleteSearch={deleteSearch}
        onClearNewMatches={clearNewMatches}
        hasActiveFilters={hasActiveFilters}
        onOpenSaveDialog={() => setSaveSearchDialogOpen(true)}
        onClearAll={handleClearAllFilters}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
      />

      {/* Company Suggestion Card - LinkedIn style */}
      {(matchingCompany && searchInput.trim() && selectedCompanies.length === 0) && (
        <CompanySuggestionCard
          company={matchingCompany}
          onOpenProfile={(id) => {
            setSelectedCompanyId(id);
            setCompanyDialogOpen(true);
          }}
        />
      )}
      {selectedCompaniesData.map(companyData => (
        <CompanySuggestionCard
          key={companyData.name}
          company={companyData}
          onOpenProfile={(id) => {
            setSelectedCompanyId(id);
            setCompanyDialogOpen(true);
          }}
          onRemove={() => setSelectedCompanies(prev => prev.filter(c => c !== companyData.name))}
        />
      ))}



      <div ref={listTopRef} />

      {/* Jobs Card List */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white text-center">Jobbsökresultat</h2>
        <div className="flex items-center justify-center gap-3 md:hidden">
          <span className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-full bg-white/5 border border-white/10">
            <Briefcase className="h-4 w-4 text-white" />{activeJobCount} jobb
          </span>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-full bg-white/5 border border-white/10 active:scale-[0.97] touch-manipulation max-w-[200px]">
                <Building className="h-4 w-4 text-white flex-shrink-0" />
                <span className="truncate">{selectedCompanies.length > 0 ? `${selectedCompanies.length} företag` : `${uniqueCompanyCount} företag`}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="bottom" className="bg-slate-900 border border-white/20 rounded-md shadow-lg text-white min-w-[200px] max-w-[280px] max-h-64 overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain">
              {[...new Set(jobs.map(j => j.company_name).filter(Boolean))].sort().map((name, index, arr) => (
                <React.Fragment key={name}>
                  <div className="relative">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        handleCompanyTap(
                          name,
                          companyTextRefs.current[name] ?? null,
                          () => setSelectedCompanies(prev =>
                            prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
                          )
                        );
                      }}
                      onSelect={(e) => e.preventDefault()}
                      className={cn(
                        "text-white py-2.5 px-3 text-sm touch-manipulation [@media(hover:hover)]:hover:bg-white/10 active:bg-white/10 focus:bg-white/10 focus:text-white",
                        selectedCompanies.includes(name) && "bg-white/10"
                      )}
                    >
                      <span ref={(el) => { companyTextRefs.current[name] = el; }} className="truncate">{name}</span>
                      {selectedCompanies.includes(name) && <span className="ml-auto text-white/60">✓</span>}
                    </DropdownMenuItem>
                    {isCompanyPreview(name) && (
                      <div className="absolute left-2 right-2 -top-1 -translate-y-full z-[60] px-3 py-2 rounded-lg bg-slate-900/95 border border-white/20 shadow-2xl text-sm text-white leading-relaxed whitespace-pre-wrap break-words animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-none">
                        {name}
                      </div>
                    )}
                  </div>
                  {index < arr.length - 1 && <DropdownMenuSeparator className="bg-white/20" />}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedCompanies.length > 1 && (
            <button
              onClick={() => setSelectedCompanies([])}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 active:scale-[0.95] touch-manipulation border border-white/15"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          )}
        </div>
        
        {isLoading ? (
          // Show skeletons during any loading state (initial, back-navigation, filter change)
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10">
                <CardContent className="p-4 min-h-[120px]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Skeleton className="h-6 w-3/4 bg-white/10 mb-3" />
                      <Skeleton className="h-4 w-1/2 bg-white/10 mb-3" />
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-24 bg-white/10" />
                        <Skeleton className="h-4 w-20 bg-white/10" />
                        <Skeleton className="h-4 w-28 bg-white/10" />
                      </div>
                    </div>
                    <Skeleton className="h-7 w-28 bg-white/10 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedJobs.length === 0 ? (
          <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
            <Briefcase className="h-12 w-12 text-white mx-auto mb-4" />
            <p className="text-white">Inga jobb hittades</p>
          </div>
        ) : (
          <>
            {/* Mobile: Swipe Mode Toggle */}
            {/* Swipe Mode Toggle - only for touch devices */}
            {isTouchCapable && (
              <SwipeModeToggle onActivate={() => setSwipeModeActive(true)} />
            )}

            {/* Job Cards — image cards on all screen sizes */}
            <div className={cn("job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", displayedJobs.length === 1 && "search-jobs-grid-single-desktop")}>
              {displayedJobs.map((job) => (
                <ReadOnlyMobileJobCard
                  key={job.id}
                  job={{
                    id: job.id,
                    title: job.title,
                    location: job.location,
                    employment_type: job.employment_type,
                    is_active: job.is_active,
                    views_count: job.views_count,
                    applications_count: job.applications_count,
                    created_at: job.created_at,
                    expires_at: job.expires_at,
                    job_image_url: job.job_image_url,
                    image_focus_position: job.image_focus_position,
                    company_name: job.company_name,
                  }}
                  hasApplied={appliedJobIds.has(job.id)}
                  onUnsaveClick={handleUnsaveClick}
                  isSavedExternal={isJobSaved(job.id)}
                  onToggleSave={toggleSaveJob}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Infinite Scroll Trigger */}
      <div ref={loadMoreTriggerRef} className="h-1" />
      
      {/* Loading indicator with progress */}
      {hasMoreJobs && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            <span>Visar {displayCount} av {filteredAndSortedJobs.length} jobb</span>
          </div>
        </div>
      )}
      
      {/* Show message when all jobs are loaded */}
      {!hasMoreJobs && filteredAndSortedJobs.length > 0 && (
        <div className="text-center pt-2 pb-6">
          <p className="text-white text-sm">
            Alla {filteredAndSortedJobs.length} jobb visas
          </p>
        </div>
      )}

      {/* Company Profile Dialog */}
      <CompanyProfileDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        companyId={selectedCompanyId || ''}
      />

      {/* Save Search Dialog */}
      <SaveSearchDialog
        open={saveSearchDialogOpen}
        onOpenChange={setSaveSearchDialogOpen}
        criteria={{
          search_query: searchInput || undefined,
          city: selectedCity || undefined,
          county: selectedPostalCode || undefined,
          employment_types: selectedEmploymentTypes.length > 0 ? selectedEmploymentTypes : undefined,
          category: selectedCategory !== 'all-categories' ? selectedCategory : undefined,
        }}
        onSave={saveSearch}
      />
      {/* Swipe Mode Fullscreen Overlay */}
      {isTouchCapable && swipeModeActive && (
        <SwipeFullscreen
          jobs={swipeJobs}
          appliedJobIds={appliedJobIds}
          onClose={() => setSwipeModeActive(false)}
          filterState={{
            searchInput,
            onSearchInputChange: setSearchInput,
            selectedCity,
            onLocationChange: (loc) => { setSelectedPostalCode(''); setSelectedCity(loc); },
            selectedCategory,
            onCategoryChange: (val) => { setSelectedCategory(val); setSelectedSubcategories([]); },
            selectedEmploymentTypes,
            onEmploymentTypesChange: setSelectedEmploymentTypes,
            sortBy,
            onSortChange: setSortBy,
            onClearAll: () => {
              setSearchInput('');
              setSelectedCity('');
              setSelectedPostalCode('');
              setSelectedCategory('all-categories');
              setSelectedSubcategories([]);
              setSelectedEmploymentTypes([]);
              setSortBy('newest');
            },
            activeFilterCount:
              (searchInput ? 1 : 0) +
              (selectedCity ? 1 : 0) +
              (selectedCategory !== 'all-categories' ? 1 : 0) +
              (selectedEmploymentTypes.length > 0 ? 1 : 0) +
              (sortBy !== 'newest' ? 1 : 0),
          }}
        />
      )}

      {/* Bekräftelsedialog för att avspara jobb */}
      <AlertDialog open={!!jobToUnsave} onOpenChange={(open) => { if (!open) setJobToUnsave(null); }}>
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
              {jobToUnsave && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">"{jobToUnsave.title}"</span>? Denna åtgärd går inte att ångra.
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
                confirmUnsave();
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
});

SearchJobs.displayName = 'SearchJobs';

export default SearchJobs;

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, Briefcase, Building, Building2, ChevronDown, Star, Sparkles } from 'lucide-react';
import { SwipeFullscreen } from '@/components/SwipeFullscreen';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { getTimeRemaining } from '@/lib/date';
import { StatsGrid } from '@/components/StatsGrid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { preloadImages } from '@/lib/serviceWorkerManager';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { useOptimizedJobSearch } from '@/hooks/useOptimizedJobSearch';
import { useSavedSearches, SearchCriteria } from '@/hooks/useSavedSearches';
import { SaveSearchDialog } from '@/components/SaveSearchDialog';
import { useBatchPrefetchReviews, useBatchPrefetchCompanyProfiles } from '@/hooks/useCompanyReviewsCache';
import { DesktopJobCard } from '@/components/search/DesktopJobCard';
import { SearchFiltersPanel } from '@/components/search/SearchFiltersPanel';

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

const SearchJobs = () => {
  const navigate = useNavigate();
  // toast and blurHandlers removed — no longer needed after filter extraction
  const queryClient = useQueryClient();
  const { preloadedTotalJobs, preloadedUniqueCompanies, preloadedNewThisWeek, user } = useAuth();
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  
  const { savedSearches, saveSearch, deleteSearch, hasActiveFilters, totalNewMatches, clearNewMatches } = useSavedSearches();
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);
  const isTouchCapable = useTouchCapable();
  const isMobile = useIsMobile();
  const [swipeModeActive, setSwipeModeActive] = useState(false);

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
    staleTime: 60000,
    gcTime: Infinity,
  });
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most-views'>('newest');
  const [selectedPostalCode, setSelectedPostalCode] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [isPostalCodeValid, setIsPostalCodeValid] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>([]);
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

  // Realtime hanteras redan av useOptimizedJobSearch — ingen dubbel prenumeration behövs

  // Sort jobs (filtering is now done in database for performance)
  const filteredAndSortedJobs = useMemo(() => {
    // Jobs are already filtered by the database - just sort here
    const result = [...jobs];

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
  }, [jobs, sortBy]);

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
    location: job.location,
    employment_type: job.employment_type,
    job_image_url: job.job_image_url,
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

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(20);
  }, [searchInput, selectedCity, selectedCategory, selectedSubcategories, selectedEmploymentTypes, sortBy]);

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
  }, []);

  const handleLocationChange = (location: string, postalCode?: string) => {
    setSelectedCity(location);
    if (postalCode) {
      setSelectedPostalCode(postalCode);
    }
  };

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
      />

      {/* Company Suggestion Card - LinkedIn style */}
      {matchingCompany && searchInput.trim() && (
        <button
          onClick={() => {
            setSelectedCompanyId(matchingCompany.id);
            setCompanyDialogOpen(true);
          }}
          className="w-full text-left"
        >
          <Card className="bg-white/5 backdrop-blur-sm border-white/20 transition-all duration-300 hover:bg-white/10 hover:border-white/30 cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarImage src={matchingCompany.logo || ''} alt={matchingCompany.name} />
                  <AvatarFallback className="bg-white/20 text-white text-lg font-bold" delayMs={150}>
                    {matchingCompany.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-white flex-shrink-0" />
                    <span className="text-xs text-white uppercase tracking-wide">Företag</span>
                  </div>
                  <h3 className="text-base font-semibold text-white truncate mt-1">
                    {matchingCompany.name} - {matchingCompany.jobCount} aktiv{matchingCompany.jobCount !== 1 ? 'a' : 't'} jobb
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span>Se företagsprofil och recensioner</span>
                    {matchingCompany.avgRating && matchingCompany.reviewCount > 0 && (
                      <span className="flex items-center gap-1 text-white">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        {matchingCompany.avgRating.toFixed(1)} ({matchingCompany.reviewCount})
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 text-white -rotate-90 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </button>
      )}


      {/* Result indicator — only shown when no results */}
      {searchInput && filteredAndSortedJobs.length === 0 && !isLoading && (
        <div className="text-sm text-white mb-4 text-center">
          <span>Inga jobb matchar din sökning</span>
        </div>
      )}

      <div ref={listTopRef} />

      {/* Jobs Card List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Jobbsökresultat</h2>
          <div className="flex items-center gap-4 text-xs text-white md:hidden">
            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1 font-semibold"><Briefcase className="h-3 w-3" />{activeJobCount}</span>
              <span className="text-[9px] text-white leading-tight">Aktiva jobb</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1 font-semibold"><Building className="h-3 w-3" />{uniqueCompanyCount}</span>
              <span className="text-[9px] text-white leading-tight">Antal företag</span>
            </div>
          </div>
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
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => setSwipeModeActive(true)}
                  className="h-11 px-6 flex items-center gap-2 bg-white/10 border border-white/20 rounded-full text-white font-medium active:scale-95 transition-all hover:bg-white/15"
                >
                  <Sparkles className="w-4 h-4" />
                  Swipe Mode
                </button>
              </div>
            )}

            {/* Job Cards */}
            <div className={isMobile ? "grid grid-cols-1 gap-4" : "space-y-4"}>
              {displayedJobs.map((job) => {
                const { text: timeText, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
                
                // Mobile: use image cards (ReadOnlyMobileJobCard style)
                if (isMobile) {
                  return (
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
                        company_name: job.company_name,
                      }}
                      hasApplied={appliedJobIds.has(job.id)}
                    />
                  );
                }
                
                // Desktop: extracted memoized component
                return (
                  <DesktopJobCard
                    key={job.id}
                    job={job}
                    hasApplied={appliedJobIds.has(job.id)}
                    isJobSaved={isJobSaved(job.id)}
                    onToggleSave={toggleSaveJob}
                    onOpenCompanyProfile={(employerId) => {
                      setSelectedCompanyId(employerId);
                      setCompanyDialogOpen(true);
                    }}
                  />
                );
              })}
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
      {!hasMoreJobs && filteredAndSortedJobs.length > 20 && (
        <div className="text-center py-6">
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
        />
      )}
    </div>
  );
};

export default SearchJobs;

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Eye, MapPin, TrendingUp, Users, Briefcase, Heart, Calendar, Building, Building2, Clock, X, ChevronDown, Check, Search, ArrowUpDown, Star, Timer, CheckCircle, Bookmark, Bell, Sparkles } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { JobSwipeMode } from '@/components/JobSwipeMode';
import { useIsMobile } from '@/hooks/use-mobile';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { SEARCH_EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { formatDateShortSv, getTimeRemaining } from '@/lib/date';
import { StatsGrid } from '@/components/StatsGrid';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import LocationSearchInput from '@/components/LocationSearchInput';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { preloadImages } from '@/lib/serviceWorkerManager';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { useBlurHandlers } from '@/hooks/useBlurHandlers';
import { useOptimizedJobSearch } from '@/hooks/useOptimizedJobSearch';
import { useSavedSearches, SearchCriteria } from '@/hooks/useSavedSearches';
import { SaveSearchDialog } from '@/components/SaveSearchDialog';
import { SavedSearchesDropdown } from '@/components/SavedSearchesDropdown';
import { useBatchPrefetchReviews, useBatchPrefetchCompanyProfiles } from '@/hooks/useCompanyReviewsCache';

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

const SearchJobs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { preloadedTotalJobs, preloadedUniqueCompanies, preloadedNewThisWeek, user } = useAuth();
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  const blurHandlers = useBlurHandlers();
  const { savedSearches, saveSearch, deleteSearch, hasActiveFilters, totalNewMatches, clearNewMatches } = useSavedSearches();
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);
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

  const employmentTypes = SEARCH_EMPLOYMENT_TYPES;

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

  // Realtime-prenumeration för live-uppdatering av jobb
  useEffect(() => {
    const channel = supabase
      .channel('search-jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_postings' },
        () => {
          // Invalidera och hämta ny data när jobb ändras
          queryClient.invalidateQueries({ queryKey: ['optimized-job-search'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  // Använd cachade värden från AuthProvider för omedelbar visning
  // Filter to only count non-expired jobs
  const activeJobs = useMemo(() => 
    jobs.filter(j => !getTimeRemaining(j.created_at, j.expires_at).isExpired),
    [jobs]
  );
  
  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Aktiva jobb', value: activeJobs.length, loading: false, cacheKey: 'search_active_jobs' },
    { icon: TrendingUp, title: 'Aktiva annonser', value: activeJobs.filter(j => j.is_active).length, loading: false, cacheKey: 'search_active_ads' },
    { icon: Building, title: 'Unika företag', value: new Set(activeJobs.map(j => j.company_name)).size, loading: false, cacheKey: 'search_unique_companies' },
    { icon: Users, title: 'Nya denna vecka', value: activeJobs.filter(j => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(j.created_at) > weekAgo;
    }).length, loading: false, cacheKey: 'search_new_this_week' },
  ], [activeJobs]);

  const sortLabels = {
    newest: 'Nyast först',
    oldest: 'Äldst först',
    'most-views': 'Mest visade',
  };

  const handleLocationChange = (location: string, postalCode?: string) => {
    setSelectedCity(location);
    if (postalCode) {
      setSelectedPostalCode(postalCode);
    }
  };

  return (
     <div className="space-y-4 responsive-container-wide animate-fade-in">
      <div className="flex justify-center items-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Sök Jobb</h1>
      </div>

      <StatsGrid stats={statsCards} />

      {/* Filters Card */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardContent className="p-4 space-y-4">
          {/* Search Field with Save Search Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-white flex items-center gap-2">
                <Search className="h-3 w-3" />
                Sök jobb
              </Label>
              {/* Save Search Button - shows when filters are active */}
              {hasActiveFilters({
                search_query: searchInput,
                city: selectedCity,
                county: selectedPostalCode,
                employment_types: selectedEmploymentTypes,
                category: selectedCategory !== 'all-categories' ? selectedCategory : undefined,
              }) && (
                <button
                  onClick={() => setSaveSearchDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 h-7 px-2 text-xs text-white rounded-md transition-all duration-200 md:hover:bg-white/10 active:scale-95"
                >
                  <Bookmark className="h-3.5 w-3.5 text-white" />
                  <span className="hidden sm:inline">Spara sökning</span>
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                placeholder="Sök efter jobbtitel, företag, plats..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-4 pr-10 bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/10 rounded p-1 transition-colors"
                  aria-label="Rensa sökning"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Saved Searches Dropdown */}
            <SavedSearchesDropdown
              savedSearches={savedSearches}
              totalNewMatches={totalNewMatches}
              onApplySearch={handleApplySavedSearch}
              onDeleteSearch={deleteSearch}
              onClearNewMatches={clearNewMatches}
            />
          </div>

          {/* Expand/Collapse Filters Button */}
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-white"
          >
            <span>{filtersExpanded ? 'Dölj filter' : 'Visa filter'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${filtersExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Collapsible Filter Section */}
          <div className={`space-y-4 overflow-hidden transition-all duration-300 ${filtersExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Location Filter - Postal Code OR City */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  Plats
                </Label>
                <LocationSearchInput
                  value={selectedPostalCode || selectedCity}
                  onLocationChange={handleLocationChange}
                  onPostalCodeChange={setSelectedPostalCode}
                />
              </div>

              {/* Yrkesområde Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Briefcase className="h-3 w-3" />
                  Yrkesområde
                </Label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-full h-[44px] flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                      aria-label="Välj yrkesområde"
                    >
                      <Briefcase className="h-4 w-4 text-white flex-shrink-0" />
                      <span className="text-sm text-white flex-1 truncate">
                        {selectedCategory === 'all-categories'
                          ? 'Alla yrkesområden'
                          : OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.label || 'Välj område'
                        }
                      </span>
                      {selectedCategory !== 'all-categories' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCategory('all-categories');
                            setSelectedSubcategories([]);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors"
                          aria-label="Rensa yrkesområde"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-80 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md shadow-lg text-white max-h-80 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedCategory('all-categories');
                        setSelectedSubcategories([]);
                      }}
                      className="cursor-pointer hover:bg-white/10 text-white font-medium"
                    >
                      Alla yrkesområden
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/20" />
                    {OCCUPATION_CATEGORIES.map((category, index) => (
                      <React.Fragment key={category.value}>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCategory(category.value);
                            setSelectedSubcategories([]);
                          }}
                          className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                        >
                          <span>{category.label}</span>
                          {selectedCategory === category.value && (
                            <Check className="h-4 w-4 text-white" />
                          )}
                        </DropdownMenuItem>
                        {index < OCCUPATION_CATEGORIES.length - 1 && (
                          <DropdownMenuSeparator className="bg-white/20" />
                        )}
                      </React.Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Subcategories Dropdown - shown only when category is selected */}
            {selectedCategory && selectedCategory !== 'all-categories' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  Specifik roll inom {OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.label}
                </Label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-full h-[44px] flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                      aria-label="Välj specifik roll"
                    >
                      <Users className="h-4 w-4 text-white flex-shrink-0" />
                      <span className="text-sm text-white flex-1 truncate">
                        {selectedSubcategories.length === 0
                          ? 'Alla roller'
                          : selectedSubcategories.length === 1
                          ? selectedSubcategories[0]
                          : `${selectedSubcategories.length} roller valda`
                        }
                      </span>
                      <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-80 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md shadow-lg text-white max-h-80 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={() => setSelectedSubcategories([])}
                      className="cursor-pointer hover:bg-white/10 text-white font-medium"
                    >
                      Alla roller
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/20" />
                    {OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.subcategories.map((subcat, index, array) => (
                      <React.Fragment key={subcat}>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedSubcategories(prev => 
                              prev.includes(subcat) 
                                ? prev.filter(s => s !== subcat)
                                : [...prev, subcat]
                            );
                          }}
                          className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                        >
                          <span>{subcat}</span>
                          {selectedSubcategories.includes(subcat) && (
                            <Check className="h-4 w-4 text-white" />
                          )}
                        </DropdownMenuItem>
                        {index < array.length - 1 && (
                          <DropdownMenuSeparator className="bg-white/20" />
                        )}
                      </React.Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Show selected roles as badges */}
                {selectedSubcategories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSubcategories.map((subcat) => (
                      <Badge 
                        key={subcat}
                        variant="secondary"
                        className="bg-white/10 text-white flex items-center gap-1 cursor-pointer transition-all duration-300 md:hover:bg-white/20 md:hover:text-white"
                      >
                        {subcat}
                        <X 
                          className="h-3 w-3" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubcategories(prev => prev.filter(s => s !== subcat));
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employment Type Filter and Sort */}
              <div className="space-y-2 md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Employment Type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Anställning
                    </Label>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="w-full h-[44px] flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                          aria-label="Välj anställningstyp"
                        >
                          <Clock className="h-4 w-4 text-white flex-shrink-0" />
                          <span className="text-sm text-white flex-1 truncate">
                            {selectedEmploymentTypes.length === 0 
                              ? 'Alla anställningar' 
                              : selectedEmploymentTypes.length === 1
                              ? '1 vald'
                              : `${selectedEmploymentTypes.length} valda`
                            }
                          </span>
                          <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-72 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md shadow-lg text-white max-h-80 overflow-y-auto">
                        <DropdownMenuItem
                          onClick={() => setSelectedEmploymentTypes([])}
                          className="cursor-pointer hover:bg-white/10 text-white font-medium"
                        >
                          Alla anställningar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/20" />
                        {employmentTypes.map((type, index) => (
                          <React.Fragment key={type.value}>
                            <DropdownMenuItem
                              onClick={() => {
                                const isSelected = selectedEmploymentTypes.includes(type.value);
                                if (isSelected) {
                                  setSelectedEmploymentTypes(prev => prev.filter(t => t !== type.value));
                                } else {
                                  setSelectedEmploymentTypes(prev => [...prev, type.value]);
                                }
                              }}
                              className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                            >
                              <span>{type.label}</span>
                              {selectedEmploymentTypes.includes(type.value) && (
                                <Check className="h-4 w-4 text-white" />
                              )}
                            </DropdownMenuItem>
                            {index < employmentTypes.length - 1 && (
                              <DropdownMenuSeparator className="bg-white/20" />
                            )}
                          </React.Fragment>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white flex items-center gap-2">
                      <ArrowUpDown className="h-3 w-3" />
                      Sortering
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="w-full h-[44px] flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                          aria-label="Välj sortering"
                        >
                          <ArrowUpDown className="h-4 w-4 text-white flex-shrink-0" />
                          <span className="text-sm text-white flex-1 truncate">{sortLabels[sortBy]}</span>
                          <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="bottom" avoidCollisions={false} className="w-[200px] z-[10000] bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md shadow-lg text-white">
                        <DropdownMenuItem 
                          onClick={() => setSortBy('newest')}
                          className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                        >
                          <span>{sortLabels.newest}</span>
                          {sortBy === 'newest' && <Check className="h-4 w-4 text-white" />}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/20" />
                        <DropdownMenuItem 
                          onClick={() => setSortBy('oldest')}
                          className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                        >
                          <span>{sortLabels.oldest}</span>
                          {sortBy === 'oldest' && <Check className="h-4 w-4 text-white" />}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/20" />
                        <DropdownMenuItem 
                          onClick={() => setSortBy('most-views')}
                          className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                        >
                          <span>{sortLabels['most-views']}</span>
                          {sortBy === 'most-views' && <Check className="h-4 w-4 text-white" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Show selected employment types as badges */}
                {selectedEmploymentTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedEmploymentTypes.map((type) => (
                      <Badge 
                        key={type}
                        variant="secondary"
                        className="bg-white/10 text-white flex items-center gap-1 cursor-pointer transition-all duration-300 md:hover:bg-white/20 md:hover:text-white"
                      >
                        {employmentTypes.find(t => t.value === type)?.label}
                        <X 
                          className="h-3 w-3" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmploymentTypes(prev => prev.filter(t => t !== type));
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Clear all filters button */}
            <div className="pt-2 flex justify-center">
              <button 
                className="h-9 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 rounded-full px-5 text-xs text-white/70 hover:text-white transition-all duration-300 focus:outline-none"
                onClick={() => {
                  setSelectedPostalCode('');
                  setSelectedCity('');
                  setSelectedEmploymentTypes([]);
                  setSelectedCategory('all-categories');
                  setSelectedSubcategories([]);
                  setSearchInput('');
                }}
              >
                Rensa alla filter
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

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


      {/* Result indicator */}
      {searchInput && (
        <div className="text-sm text-white mb-4">
          {filteredAndSortedJobs.length === 0 ? (
            <span>Inga jobb matchar din sökning</span>
          ) : (
            <span>
              Visar {filteredAndSortedJobs.length} av {jobs.length} jobb
            </span>
          )}
        </div>
      )}

      <div ref={listTopRef} />

      {/* Jobs Card List */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-white">Jobbsökresultat</h2>
        
        {isLoading ? (
          // Skeleton cards
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
            <div className="md:hidden flex justify-center mb-4">
              <Button
                onClick={() => setSwipeModeActive(true)}
                className="bg-gradient-to-r from-parium-blue to-blue-600 hover:from-parium-blue/90 hover:to-blue-600/90 text-white font-medium shadow-lg shadow-parium-blue/25 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Swipe Mode
              </Button>
            </div>

            {/* Job Cards */}
            <div className="space-y-4">
              {displayedJobs.map((job) => {
                const { text: timeText, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
                
                return (
                  <Card 
                    key={job.id}
                    onClick={() => navigate(`/job-view/${job.id}`)}
                    className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer group"
                  >
                    <CardContent className="p-4 min-h-[120px] relative">
                      {/* Already applied badge - top right corner */}
                      {appliedJobIds.has(job.id) && (
                        <Badge variant="glass" className="absolute top-3 right-3 bg-green-500/20 text-green-300 border-green-500/30 text-xs px-2.5 py-1">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Redan sökt
                        </Badge>
                      )}
                      
                      <div className="flex items-start justify-between gap-4">
                        <div className={`flex-1 min-w-0 ${appliedJobIds.has(job.id) ? 'max-w-[calc(100%-100px)]' : ''}`}>
                          {/* Job Title */}
                          <TruncatedText 
                            text={job.title}
                            className="text-lg font-semibold text-white truncate group-hover:text-white transition-colors block break-all"
                          />

                          {/* Company - clickable to open profile */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (job.employer_id) {
                                setSelectedCompanyId(job.employer_id);
                                setCompanyDialogOpen(true);
                              }
                            }}
                            className="flex items-center gap-2 mt-1 text-white hover:text-white/80 transition-colors"
                          >
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate underline-offset-2 hover:underline">
                              {job.company_name || 'Okänt företag'}
                            </span>
                          </button>

                          {/* Meta info */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-white">
                            {job.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{job.location}</span>
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
                              <span>{formatDateShortSv(job.created_at)}</span>
                            </div>
                            {/* Antal sökande badge */}
                            <Badge variant="glass" className="text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50">
                              <Users className="h-3 w-3 mr-1" />
                              {job.applications_count || 0} sökande
                            </Badge>
                            {/* Days remaining badge */}
                            {isExpired ? (
                              <Badge variant="glass" className="bg-red-500/20 text-white border-red-500/30 text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/30 hover:border-red-500/50">
                                Utgången
                              </Badge>
                            ) : (
                              <Badge variant="glass" className="text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50">
                                <Timer className="h-3 w-3 mr-1" />
                                {timeText} kvar
                              </Badge>
                            )}
                            {/* Save job button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSaveJob(job.id);
                              }}
                              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border backdrop-blur-[2px] transition-all duration-300 group-hover:backdrop-brightness-90 ${
                                isJobSaved(job.id)
                                  ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50'
                                  : 'bg-white/10 text-white border-white/25 hover:bg-white/15 hover:border-white/50'
                              }`}
                            >
                              <Heart className={`h-3 w-3 ${isJobSaved(job.id) ? 'fill-red-300' : ''}`} />
                              {isJobSaved(job.id) ? 'Sparad' : 'Spara'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Infinite Scroll Trigger */}
      <div ref={loadMoreTriggerRef} className="h-1" />
      
      {/* Loading indicator when fetching more */}
      {hasMoreJobs && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            <span>Laddar fler jobb...</span>
          </div>
        </div>
      )}
      
      {/* Show message when all jobs are loaded */}
      {!hasMoreJobs && filteredAndSortedJobs.length > 20 && (
        <div className="text-center py-4">
          <p className="text-white/60 text-sm">
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
      {/* Swipe Mode Overlay */}
      {isMobile && swipeModeActive && (
        <JobSwipeMode
          jobs={filteredAndSortedJobs.map(job => ({
            id: job.id,
            title: job.title,
            company_name: job.company_name,
            location: job.location,
            employment_type: job.employment_type,
            job_image_url: job.job_image_url,
            views_count: job.views_count,
            applications_count: job.applications_count,
          }))}
          appliedJobIds={appliedJobIds}
          onClose={() => setSwipeModeActive(false)}
        />
      )}
    </div>
  );
};

export default SearchJobs;

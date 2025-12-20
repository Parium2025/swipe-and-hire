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
import { Eye, MapPin, TrendingUp, Users, Briefcase, Heart, Calendar, Building, Building2, Clock, X, ChevronDown, Check, Search, ArrowUpDown, Star, Timer, CheckCircle } from 'lucide-react';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { SEARCH_EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { createSmartSearchConditions, expandSearchTerms } from '@/lib/smartSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  
  // Lazy loading state
  const [displayCount, setDisplayCount] = useState(10);
  const initialLoadSize = 20; // Load first 20 jobs
  const loadMoreSize = 10; // Load 10 more each time
  const listTopRef = useRef<HTMLDivElement>(null);

  const employmentTypes = SEARCH_EMPLOYMENT_TYPES;

  // Use React Query with lazy loading - load only what's needed
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-jobs', selectedCity, selectedCategory, selectedSubcategories, selectedEmploymentTypes],
    queryFn: async () => {
      let query: any = supabase
        .from('job_postings')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Apply smart search
      if (searchInput) {
        const smartSearchConditions = createSmartSearchConditions(searchInput);
        query = query.or(smartSearchConditions);
      }

      // Apply subcategory filter
      if (selectedSubcategories.length > 0) {
        selectedSubcategories.forEach((subcategory, index) => {
          if (index === 0) {
            query = query.ilike('title', `%${subcategory}%`);
          }
        });
      } else if (selectedCategory && selectedCategory !== 'all-categories') {
        const category = OCCUPATION_CATEGORIES.find(cat => cat.value === selectedCategory);
        if (category) {
          if (category.keywords.length === 1) {
            const cleanKeyword = category.keywords[0].replace(/[%_]/g, '\\$&');
            query = query.or(`title.ilike.%${cleanKeyword}%,description.ilike.%${cleanKeyword}%`);
          } else {
            let hasFilter = false;
            category.keywords.forEach((keyword) => {
              const cleanKeyword = keyword.replace(/[%_]/g, '\\$&');
              if (!hasFilter) {
                query = query.or(`title.ilike.%${cleanKeyword}%,description.ilike.%${cleanKeyword}%`);
                hasFilter = true;
              }
            });
          }
        }
      }

      // Apply location filter (city, postal code, county, or municipality)
      if (selectedCity) {
        // Check if selectedCity is a county (ends with "län")
        if (selectedCity.endsWith(' län')) {
          query = query.eq('workplace_county', selectedCity);
        } else {
          // Search in city, municipality, county, and location fields
          query = query.or(`workplace_city.ilike.%${selectedCity}%,workplace_municipality.ilike.%${selectedCity}%,workplace_county.ilike.%${selectedCity}%,location.ilike.%${selectedCity}%`);
        }
      }

      // Apply employment type filter
      if (selectedEmploymentTypes.length > 0) {
        const employmentCodes = selectedEmploymentTypes.map(type => {
          const foundType = SEARCH_EMPLOYMENT_TYPES.find(t => t.value === type);
          return foundType?.code || type;
        });
        query = query.in('employment_type', employmentCodes);
      }

      // Load initial batch - faster page load
      const { data, error } = await query.limit(initialLoadSize);
      
      if (error) throw error;
      
      // Fetch company names and logos separately to avoid deep type instantiation
      const employerIds = [...new Set((data || []).map((job: any) => job.employer_id).filter(Boolean))] as string[];
      let companyData: Record<string, { name: string; logo?: string; avgRating?: number; reviewCount?: number }> = {};
      
      if (employerIds.length > 0) {
        // Fetch profiles and reviews in parallel
        const [profilesRes, reviewsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('user_id, company_name, company_logo_url')
            .in('user_id', employerIds),
          supabase
            .from('company_reviews')
            .select('company_id, rating')
            .in('company_id', employerIds)
        ]);
        
        // Calculate average ratings per company
        const ratingsMap: Record<string, { total: number; count: number }> = {};
        if (reviewsRes.data) {
          reviewsRes.data.forEach(review => {
            if (!ratingsMap[review.company_id]) {
              ratingsMap[review.company_id] = { total: 0, count: 0 };
            }
            ratingsMap[review.company_id].total += review.rating;
            ratingsMap[review.company_id].count++;
          });
        }
        
        if (profilesRes.data) {
          companyData = profilesRes.data.reduce((acc, p) => {
            if (p.company_name) {
              const ratingData = ratingsMap[p.user_id];
              acc[p.user_id] = {
                name: p.company_name,
                logo: p.company_logo_url || undefined,
                avgRating: ratingData ? ratingData.total / ratingData.count : undefined,
                reviewCount: ratingData?.count || 0
              };
            }
            return acc;
          }, {} as Record<string, { name: string; logo?: string; avgRating?: number; reviewCount?: number }>);
        }
      }
      
      return (data || []).map((job: any) => ({
        ...job,
        company_name: companyData[job.employer_id]?.name || 'Okänt företag',
        company_logo_url: companyData[job.employer_id]?.logo,
        company_avg_rating: companyData[job.employer_id]?.avgRating,
        company_review_count: companyData[job.employer_id]?.reviewCount || 0,
        views_count: job.views_count || 0,
        applications_count: job.applications_count || 0,
      }));
    },
    staleTime: 0, // Hämta i bakgrunden vid återbesök
    gcTime: Infinity, // Behåll cache permanent under sessionen
    refetchOnWindowFocus: false, // Lägg inte om bilder när man kommer tillbaka
    refetchOnMount: 'always', // Uppdatera i bakgrunden vid navigation
  });

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
          queryClient.invalidateQueries({ queryKey: ['public-jobs'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    // Filter out expired jobs first
    let filtered = jobs.filter(job => !getTimeRemaining(job.created_at, job.expires_at).isExpired);

    // Search filter
    if (searchInput) {
      const searchLower = searchInput.toLowerCase();
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(searchLower) ||
        job.company_name.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.location.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'most-views':
        filtered.sort((a, b) => b.views_count - a.views_count);
        break;
    }

    return filtered;
  }, [jobs, searchInput, sortBy]);

  // Display jobs with lazy loading
  const displayedJobs = useMemo(() => {
    return filteredAndSortedJobs.slice(0, displayCount);
  }, [filteredAndSortedJobs, displayCount]);

  const hasMoreJobs = displayCount < filteredAndSortedJobs.length;

  // Find matching companies for smart search suggestion
  const matchingCompany = useMemo(() => {
    if (!searchInput.trim() || searchInput.length < 2) return null;
    
    const searchLower = searchInput.toLowerCase().trim();
    
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
  }, [jobs, searchInput]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(10);
  }, [searchInput, selectedCity, selectedCategory, selectedSubcategories, selectedEmploymentTypes, sortBy]);

  const handleLoadMore = () => {
    setDisplayCount(prev => Math.min(prev + loadMoreSize, filteredAndSortedJobs.length));
  };

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
    { icon: Briefcase, title: 'Aktiva jobb', value: activeJobs.length, loading: false },
    { icon: TrendingUp, title: 'Aktiva annonser', value: activeJobs.filter(j => j.is_active).length, loading: false },
    { icon: Building, title: 'Unika företag', value: new Set(activeJobs.map(j => j.company_name)).size, loading: false },
    { icon: Users, title: 'Nya denna vecka', value: activeJobs.filter(j => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(j.created_at) > weekAgo;
    }).length, loading: false },
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
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12 animate-fade-in">
      <div className="flex justify-center items-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Sök Jobb</h1>
      </div>

      <StatsGrid stats={statsCards} />

      {/* Filters Card */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardContent className="p-4 space-y-4">
          {/* Search Field - Always visible */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white flex items-center gap-2">
              <Search className="h-3 w-3" />
              Sök jobb
            </Label>
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
                    <Button
                      variant="outline"
                      className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-sm"
                    >
                      <span className="truncate">
                        {selectedCategory === 'all-categories'
                          ? 'Alla yrkesområden'
                          : OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.label || 'Välj område'
                        }
                      </span>
                      {selectedCategory !== 'all-categories' ? (
                        <span
                          role="button"
                          aria-label="Rensa yrkesområde"
                          tabIndex={0}
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCategory('all-categories');
                            setSelectedSubcategories([]);
                          }}
                          className="ml-2 inline-flex items-center justify-center rounded p-1 md:hover:bg-white/10"
                        >
                          <X className="h-4 w-4 text-white" />
                        </span>
                      ) : (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      )}
                    </Button>
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
                    <Button
                      variant="outline"
                      className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-sm"
                    >
                      <span className="truncate">
                        {selectedSubcategories.length === 0
                          ? 'Alla roller'
                          : selectedSubcategories.length === 1
                          ? selectedSubcategories[0]
                          : `${selectedSubcategories.length} roller valda`
                        }
                      </span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
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
                        <Button
                          variant="outline"
                          className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-sm"
                        >
                          <span className="truncate">
                            {selectedEmploymentTypes.length === 0 
                              ? 'Alla typer' 
                              : `${selectedEmploymentTypes.length} valda`
                            }
                          </span>
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-72 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md shadow-lg text-white max-h-80 overflow-y-auto">
                        <DropdownMenuItem
                          onClick={() => setSelectedEmploymentTypes([])}
                          className="cursor-pointer hover:bg-white/10 text-white font-medium"
                        >
                          Alla typer
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
                        <Button 
                          variant="outline" 
                          className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-sm"
                        >
                          <span className="truncate">{sortLabels[sortBy]}</span>
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        </Button>
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
            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white"
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
              </Button>
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
                  {matchingCompany.logo ? (
                    <AvatarImage src={matchingCompany.logo} alt={matchingCompany.name} />
                  ) : null}
                  <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
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
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <span>Se företagsprofil och recensioner</span>
                    {matchingCompany.avgRating && matchingCompany.reviewCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
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

      {/* Jobs Table/Cards */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardHeader className="hidden md:block md:p-4">
          <CardTitle className="text-sm text-white">Jobbsökresultat</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                <p className="text-sm text-white">Söker jobb...</p>
              </div>
            </div>
          ) : filteredAndSortedJobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white">Inga jobb hittades</p>
            </div>
          ) : (
            <>
              {/* Desktop: Table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 transition-all duration-300 md:hover:bg-white/10">
                      <TableHead className="text-white">Titel</TableHead>
                      <TableHead className="text-white">Företag</TableHead>
                      <TableHead className="text-white">Plats</TableHead>
                      <TableHead className="text-white">Publicerad</TableHead>
                      <TableHead className="text-white">Åtgärder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedJobs.map((job) => (
                       <TableRow 
                        key={job.id} 
                        className="group border-white/10 cursor-pointer transition-all duration-300 md:hover:bg-white/10"
                        onClick={() => navigate(`/job-view/${job.id}`)}
                      >
                        <TableCell>
                          <JobTitleCell title={job.title} employmentType={job.employment_type} />
                        </TableCell>
                        <TableCell>
                          <TruncatedText 
                            text={job.company_name} 
                            className="text-sm text-white truncate max-w-[120px] block"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-white" />
                            <TruncatedText 
                              text={job.location} 
                              className="text-sm text-white truncate max-w-[100px] block"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-sm text-white">
                              <Calendar className="h-3 w-3" />
                              {formatDateShortSv(job.created_at)}
                            </div>
                            {job.applications_count > 0 && (
                              <Badge variant="glass" className="text-xs transition-all duration-300 md:group-hover:backdrop-brightness-90 md:hover:bg-white/15 md:hover:border-white/50">
                                <Users className="h-3 w-3 mr-1" />
                                {job.applications_count} sökande
                              </Badge>
                            )}
                            {appliedJobIds.has(job.id) && (
                              <Badge variant="glass" className="bg-green-500/20 text-green-300 border-green-500/30 text-xs transition-all duration-300 md:group-hover:backdrop-brightness-90 md:hover:bg-green-500/30 md:hover:border-green-500/50">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Redan sökt
                              </Badge>
                            )}
                            {(() => {
                              const { text, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
                              if (isExpired) {
                                return (
                                  <Badge variant="secondary" className="bg-red-500/20 text-white border-red-500/30 text-xs hover:bg-red-500/30 hover:border-red-500/50 transition-all duration-300">
                                    Utgången
                                  </Badge>
                                );
                              }
                              return (
                                <Badge
                                  variant="glass"
                                  className="text-xs transition-all duration-300 md:group-hover:backdrop-brightness-90 md:hover:bg-white/15 md:hover:border-white/50 md:hover:backdrop-blur-sm md:hover:backdrop-brightness-110"
                                >
                                  <Timer className="h-3 w-3 mr-1" />
                                  {text} kvar
                                </Badge>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="glass"
                              size="sm"
                              className="h-7 px-3 text-xs md:group-hover:backdrop-brightness-90 md:hover:backdrop-brightness-110"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/job-view/${job.id}`);
                              }}
                            >
                              Ansök
                            </Button>
                            <Button 
                              variant="glass"
                              size="icon"
                              className="h-7 w-7 md:group-hover:backdrop-brightness-90 md:hover:backdrop-brightness-110"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSaveJob(job.id);
                              }}
                            >
                              <Heart className={`h-3 w-3 text-white ${isJobSaved(job.id) ? 'fill-red-400 text-red-400' : ''}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Card view */}
              <div className="md:hidden">
                <ScrollArea className="h-[calc(100vh-420px)]">
                  <div className="space-y-2 px-2 py-2">
                    {displayedJobs.map((job) => (
                      <ReadOnlyMobileJobCard
                        key={job.id}
                        job={job as any}
                        hasApplied={appliedJobIds.has(job.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Load More Button */}
      {hasMoreJobs && (
        <div className="flex justify-center py-4">
          <Button
            onClick={handleLoadMore}
            className="bg-white/10 border border-white/20 text-white transition-all duration-300 md:hover:bg-white/20 md:hover:text-white"
          >
            Ladda fler jobb ({displayCount} av {filteredAndSortedJobs.length})
          </Button>
        </div>
      )}
      
      {/* Show message when all jobs are loaded */}
      {!hasMoreJobs && filteredAndSortedJobs.length > 10 && (
        <div className="text-center py-4">
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
    </div>
  );
};

export default SearchJobs;

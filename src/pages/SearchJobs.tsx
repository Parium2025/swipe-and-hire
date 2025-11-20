import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Eye, MapPin, TrendingUp, Users, Briefcase, Heart, Calendar, Building, Clock, X, ChevronDown, Check, Search, ArrowUpDown } from 'lucide-react';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { SEARCH_EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { createSmartSearchConditions, expandSearchTerms } from '@/lib/smartSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { formatDateShortSv } from '@/lib/date';
import { StatsGrid } from '@/components/StatsGrid';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import LocationSearchInput from '@/components/LocationSearchInput';
import { useQuery } from '@tanstack/react-query';
import { preloadImages } from '@/lib/serviceWorkerManager';

interface Job {
  id: string;
  title: string;
  company_name: string;
  location: string;
  workplace_city?: string;
  workplace_postal_code?: string;
  employment_type: string;
  salary_min?: number;
  salary_max?: number;
  description: string;
  created_at: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  job_image_url?: string;
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
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most-views'>('newest');
  const [selectedPostalCode, setSelectedPostalCode] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [isPostalCodeValid, setIsPostalCodeValid] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>([]);
  
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
      
      // Fetch company names separately to avoid deep type instantiation
      const employerIds = [...new Set((data || []).map((job: any) => job.employer_id).filter(Boolean))] as string[];
      let companyNames: Record<string, string> = {};
      
      if (employerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, company_name')
          .in('user_id', employerIds);
        
        if (profiles) {
          companyNames = profiles.reduce((acc, p) => {
            if (p.company_name) acc[p.user_id] = p.company_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }
      
      return (data || []).map((job: any) => ({
        ...job,
        company_name: companyNames[job.employer_id] || 'Okänt företag',
        views_count: job.views_count || 0,
        applications_count: job.applications_count || 0,
      }));
    },
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes - länge cache för bilder
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour - behåll bildurls längre
    refetchOnWindowFocus: false, // Lägg inte om bilder när man kommer tillbaka
    refetchOnMount: false, // Använd cache när möjligt
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

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = [...jobs];

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

  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Jobb hittade', value: jobs.length, loading: false },
    { icon: TrendingUp, title: 'Aktiva annonser', value: jobs.filter(j => j.is_active).length, loading: false },
    { icon: Building, title: 'Unika företag', value: new Set(jobs.map(j => j.company_name)).size, loading: false },
    { icon: Users, title: 'Nya denna vecka', value: jobs.filter(j => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(j.created_at) > weekAgo;
    }).length, loading: false },
  ], [jobs]);

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
      <div className="flex justify-center items-center mb-4">
        <h1 className="text-2xl font-semibold text-white">Sök Jobb</h1>
      </div>

      <StatsGrid stats={statsCards} />

      {/* Filters Card */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Field */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium text-white flex items-center gap-2">
                <Search className="h-3 w-3" />
                Sök jobb
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                <Input
                  placeholder="Sök efter jobbtitel, företag, plats..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
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
                    className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-sm"
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
                <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-80 bg-slate-700/95 backdrop-blur-md border-slate-500/30 text-white max-h-80 overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedCategory('all-categories');
                      setSelectedSubcategories([]);
                    }}
                    className="cursor-pointer hover:bg-slate-700/70 text-white font-medium"
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
                        className="cursor-pointer hover:bg-slate-700/70 text-white flex items-center justify-between"
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
                    className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-sm"
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
                <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-80 bg-slate-700/95 backdrop-blur-md border-slate-500/30 text-white max-h-80 overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => setSelectedSubcategories([])}
                    className="cursor-pointer hover:bg-slate-700/70 text-white font-medium"
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
                        className="cursor-pointer hover:bg-slate-700/70 text-white flex items-center justify-between"
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
                        className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-sm"
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
                    <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-72 bg-slate-700/95 backdrop-blur-md border-slate-500/30 text-white max-h-80 overflow-y-auto">
                      <DropdownMenuItem
                        onClick={() => setSelectedEmploymentTypes([])}
                        className="cursor-pointer hover:bg-slate-700/70 text-white font-medium"
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
                            className="cursor-pointer hover:bg-slate-700/70 text-white flex items-center justify-between"
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
                        className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white justify-between text-sm"
                      >
                        <span className="truncate">{sortLabels[sortBy]}</span>
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="bottom" avoidCollisions={false} className="w-[200px] z-[10000] bg-slate-700/95 backdrop-blur-md border-slate-500/30 text-white">
                      <DropdownMenuItem 
                        onClick={() => setSortBy('newest')}
                        className="cursor-pointer hover:bg-slate-700/70 text-white flex items-center justify-between"
                      >
                        <span>{sortLabels.newest}</span>
                        {sortBy === 'newest' && <Check className="h-4 w-4 text-white" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/20" />
                      <DropdownMenuItem 
                        onClick={() => setSortBy('oldest')}
                        className="cursor-pointer hover:bg-slate-700/70 text-white flex items-center justify-between"
                      >
                        <span>{sortLabels.oldest}</span>
                        {sortBy === 'oldest' && <Check className="h-4 w-4 text-white" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/20" />
                      <DropdownMenuItem 
                        onClick={() => setSortBy('most-views')}
                        className="cursor-pointer hover:bg-slate-700/70 text-white flex items-center justify-between"
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
              className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white"
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
        </CardContent>
      </Card>


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
                <p className="text-sm text-white/70">Söker jobb...</p>
              </div>
            </div>
          ) : filteredAndSortedJobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/70">Inga jobb hittades</p>
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
                        className="border-white/10 cursor-pointer transition-all duration-300 md:hover:bg-white/10"
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
                            <MapPin className="h-3 w-3 text-white/60" />
                            <TruncatedText 
                              text={job.location} 
                              className="text-sm text-white truncate max-w-[100px] block"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-white">
                            <Calendar className="h-3 w-3" />
                            {formatDateShortSv(job.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline"
                              size="sm" 
                              className="h-8 px-3 text-xs bg-white/5 border-white/20 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white"
                               onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/job-view/${job.id}`);
                              }}
                            >
                              Ansök
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 bg-white/5 border-white/20 transition-all duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                toast({ title: "Sparad!", description: "Jobbet har sparats till dina favoriter" });
                              }}
                            >
                              <Heart className="h-3 w-3" />
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
          <p className="text-white/60 text-sm">
            Alla {filteredAndSortedJobs.length} jobb visas
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchJobs;

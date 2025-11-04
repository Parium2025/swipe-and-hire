import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
import LocationSearchInput from '@/components/LocationSearchInput';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from '@tanstack/react-query';

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isParsingSearch, setIsParsingSearch] = useState(false);
  const [parsedSearch, setParsedSearch] = useState<{jobTitle: string; location: string; employmentType: string} | null>(null);

  // Populära sökningar baserat på vanliga jobb och städer
  const popularSearches = useMemo(() => [
    // Lager & Logistik
    "Lagerarbetare Stockholm",
    "Lagerarbetare Göteborg",
    "Lagerarbetare Malmö",
    "Truckförare Stockholm",
    "Truckförare Göteborg",
    "Lastbilschaufför Stockholm",
    "Lastbilschaufför Göteborg",
    "Logistik Helsingborg",
    "Terminalarbetare Stockholm",
    
    // Försäljning & Service
    "Försäljare Stockholm",
    "Försäljare Göteborg",
    "Butikssäljare Malmö",
    "Butiksbiträde Stockholm",
    "Kassör Göteborg",
    "Kundtjänst Stockholm",
    "Kundservice Göteborg",
    "Säljare Malmö",
    
    // Restaurang & Hotell
    "Servitör Stockholm",
    "Kock Göteborg",
    "Kock Stockholm",
    "Restaurangbiträde Malmö",
    "Bartender Stockholm",
    "Hotellreceptionist Stockholm",
    "Städare Göteborg",
    
    // Bygg & Hantverk
    "Snickare Stockholm",
    "Elektriker Göteborg",
    "Byggnadsarbetare Stockholm",
    "Målare Malmö",
    "VVS Göteborg",
    "Plåtslagare Stockholm",
    
    // Vård & Omsorg
    "Undersköterska Stockholm",
    "Vårdbiträde Göteborg",
    "Sjuksköterska Malmö",
    "Personlig assistent Stockholm",
    "Hemtjänst Göteborg",
    "Barnskötare Stockholm",
    
    // Kontorsarbete
    "Administratör Stockholm",
    "Ekonomiassistent Göteborg",
    "Receptionist Stockholm",
    "Kontorsassistent Malmö",
    "Redovisningsekonom Göteborg",
    
    // IT & Tech
    "Utvecklare Stockholm",
    "Systemadministratör Göteborg",
    "IT-tekniker Stockholm",
    "Support Malmö",
    
    // Industri & Produktion
    "Produktionsarbetare Stockholm",
    "Maskinoperatör Göteborg",
    "Processoperatör Malmö",
    "Svetsar Stockholm",
    "Industriarbetare Göteborg",
    
    // Transport
    "Taxiförare Stockholm",
    "Bussförare Göteborg",
    "Distributör Malmö",
    "Chaufför Stockholm",
    
    // Städer utan specifikt yrke
    "Jobb Stockholm",
    "Jobb Göteborg", 
    "Jobb Malmö",
    "Jobb Uppsala",
    "Jobb Västerås",
    "Jobb Örebro",
    "Jobb Linköping",
    "Jobb Helsingborg",
    "Jobb Norrköping",
    "Jobb Jönköping",
    
    // Anställningstyper
    "Heltid Stockholm",
    "Deltid Göteborg",
    "Vikariat Malmö",
    "Sommarjobb Stockholm",
    "Extrajobb Göteborg",
  ], []);
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const listTopRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);

  const employmentTypes = SEARCH_EMPLOYMENT_TYPES;

  // Use React Query for background caching and instant data
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-jobs', selectedCity, selectedCategory, selectedSubcategories, selectedEmploymentTypes],
    queryFn: async () => {
      let query = supabase
        .from('job_postings')
        .select(`
          *,
          profiles!job_postings_employer_id_fkey(company_name)
        `)
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

      // Apply location filter (city or postal code)
      if (selectedCity) {
        query = query.or(`workplace_city.ilike.%${selectedCity}%,location.ilike.%${selectedCity}%`);
      }

      // Apply employment type filter
      if (selectedEmploymentTypes.length > 0) {
        const employmentCodes = selectedEmploymentTypes.map(type => {
          const foundType = SEARCH_EMPLOYMENT_TYPES.find(t => t.value === type);
          return foundType?.code || type;
        });
        query = query.in('employment_type', employmentCodes);
      }

      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      
      return (data || []).map(job => ({
        ...job,
        company_name: job.profiles?.company_name || 'Okänt företag',
        views_count: job.views_count || 0,
        applications_count: job.applications_count || 0,
      }));
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes - fresh data
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: true, // Refresh when user comes back to tab
    refetchOnMount: 'always', // Always check for fresh data
  });

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

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedJobs.length / pageSize));
  const pageJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedJobs.slice(start, start + pageSize);
  }, [filteredAndSortedJobs, page]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page]);

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

  // AI-powered smart search
  const handleSmartSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchInput('');
      setParsedSearch(null);
      setSelectedCity('');
      setSelectedCategory('all-categories');
      setSelectedEmploymentTypes([]);
      return;
    }

    setIsParsingSearch(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-job-search', {
        body: { query }
      });

      if (error) {
        console.error('Error parsing search:', error);
        toast({
          title: "Sökningen misslyckades",
          description: "Försök igen eller använd avancerade filter.",
          variant: "destructive"
        });
        setSearchInput(query);
        return;
      }

      console.log('Parsed search result:', data);
      setParsedSearch(data);

      // Apply parsed filters
      if (data.jobTitle) {
        setSearchInput(data.jobTitle);
      }
      if (data.location) {
        setSelectedCity(data.location);
      }
      if (data.employmentType) {
        const matchedType = SEARCH_EMPLOYMENT_TYPES.find(t => 
          t.label.toLowerCase().includes(data.employmentType.toLowerCase())
        );
        if (matchedType) {
          setSelectedEmploymentTypes([matchedType.value]);
        }
      }

      toast({
        title: "Sökning tolkad!",
        description: `Visar ${data.jobTitle || 'alla jobb'}${data.location ? ` i ${data.location}` : ''}`,
      });

    } catch (error) {
      console.error('Smart search error:', error);
      setSearchInput(query);
    } finally {
      setIsParsingSearch(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12">
      <div className="flex justify-center items-center mb-4">
        <h1 className="text-xl md:text-2xl font-semibold text-white">Sök Jobb</h1>
      </div>

      <StatsGrid stats={statsCards} />

      {/* Smart Search Bar - Desktop */}
      <div className="hidden md:block space-y-4">
        <Card className="bg-white/5 backdrop-blur-sm border-white/20 p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
              <Input
                placeholder="Skriv vad du söker... T.ex: 'Lastbilschaufför i Stockholm' eller 'Lagerarbete Göteborg'"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSmartSearch(searchInput);
                  }
                }}
                className="pl-12 pr-4 h-14 text-lg bg-white/5 border-white/10 text-white placeholder:text-white/50"
                disabled={isParsingSearch}
              />
              {isParsingSearch && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            <Button
              onClick={() => handleSmartSearch(searchInput)}
              disabled={isParsingSearch}
              size="lg"
              className="h-14 px-8 bg-white text-primary hover:bg-white/90 font-semibold"
            >
              {isParsingSearch ? 'Tolkar...' : 'Sök jobb'}
            </Button>
          </div>
          {parsedSearch && (
            <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <span>Söker efter:</span>
              {parsedSearch.jobTitle && (
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                  💼 {parsedSearch.jobTitle}
                </Badge>
              )}
              {parsedSearch.location && (
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                  📍 {parsedSearch.location}
                </Badge>
              )}
              {parsedSearch.employmentType && (
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                  ⏰ {parsedSearch.employmentType}
                </Badge>
              )}
            </div>
          )}
        </Card>

        {/* Populära sökningar - Desktop */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/20 p-4">
          <h3 className="text-sm font-medium text-white/70 mb-3">Populära sökningar:</h3>
          <div className="flex flex-wrap gap-2">
            {popularSearches.map((search, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput(search);
                  handleSmartSearch(search);
                }}
                className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/40 text-xs transition-all"
              >
                {search}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      {/* Smart Search Bar - Mobile */}
      <div className="md:hidden space-y-3">
        <Card className="bg-white/5 backdrop-blur-sm border-white/20 p-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Vad söker du? T.ex: 'Lager Stockholm'"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSmartSearch(searchInput);
                  }
                }}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/50"
                disabled={isParsingSearch}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleSmartSearch(searchInput)}
                disabled={isParsingSearch}
                className="flex-1 bg-white text-primary hover:bg-white/90 font-semibold"
              >
                {isParsingSearch ? 'Tolkar...' : 'Sök'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white/5 border-white/10 text-white"
                  >
                    <ArrowUpDown className="h-4 w-4 mr-1" />
                    {sortLabels[sortBy]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800/95 backdrop-blur-md border-white/20">
                  <DropdownMenuItem onClick={() => setSortBy('newest')} className="text-white hover:bg-white/10">
                    {sortLabels.newest}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('oldest')} className="text-white hover:bg-white/10">
                    {sortLabels.oldest}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('most-views')} className="text-white hover:bg-white/10">
                    {sortLabels['most-views']}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {parsedSearch && (
              <div className="flex flex-wrap gap-2">
                {parsedSearch.jobTitle && (
                  <Badge variant="secondary" className="bg-white/10 text-white text-xs">
                    💼 {parsedSearch.jobTitle}
                  </Badge>
                )}
                {parsedSearch.location && (
                  <Badge variant="secondary" className="bg-white/10 text-white text-xs">
                    📍 {parsedSearch.location}
                  </Badge>
                )}
                {parsedSearch.employmentType && (
                  <Badge variant="secondary" className="bg-white/10 text-white text-xs">
                    ⏰ {parsedSearch.employmentType}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Populära sökningar - Mobile */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/20 p-3">
          <h3 className="text-xs font-medium text-white/70 mb-2">Populära sökningar:</h3>
          <ScrollArea className="h-[120px]">
            <div className="flex flex-wrap gap-1.5 pr-4">
              {popularSearches.slice(0, 40).map((search, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchInput(search);
                    handleSmartSearch(search);
                  }}
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10 text-xs h-7 px-2"
                >
                  {search}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Advanced Filters - Collapsible */}
      <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white">
            Avancerade filter
            <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="bg-white/5 backdrop-blur-sm border-white/20 mt-2">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Location Filter - Postal Code OR City */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    Plats
                  </Label>
                  <LocationSearchInput
                    onLocationChange={handleLocationChange}
                    onPostalCodeChange={setSelectedPostalCode}
                    jobs={jobs}
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
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-80 bg-slate-700/95 backdrop-blur-md border-slate-500/30 text-white max-h-80 overflow-y-auto">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedCategory('all-categories');
                          setSelectedSubcategories([]);
                        }}
                        className="cursor-pointer hover:bg-slate-700/70 text-white font-medium border-b border-slate-600/30"
                      >
                        Alla yrkesområden
                      </DropdownMenuItem>
                      {OCCUPATION_CATEGORIES.map((category) => (
                        <DropdownMenuItem
                          key={category.value}
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
                        className="cursor-pointer hover:bg-slate-700/70 text-white font-medium border-b border-slate-600/30"
                      >
                        Alla roller
                      </DropdownMenuItem>
                      {OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.subcategories.map((subcat) => (
                        <DropdownMenuItem
                          key={subcat}
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

            {/* Employment Type Filter */}
            <div className="space-y-2 mt-4">
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
                    className="cursor-pointer hover:bg-slate-700/70 text-white"
                  >
                    Alla typer
                  </DropdownMenuItem>
                  {employmentTypes.map((type) => (
                    <DropdownMenuItem
                      key={type.value}
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
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Clear all filters button - moved outside grid */}
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
        </CollapsibleContent>
      </Collapsible>

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
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8 text-white/40" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Inga jobb hittades</h3>
              <p className="text-white/60 text-center max-w-md mb-6">
                {searchInput || selectedCity || selectedCategory !== 'all-categories' || selectedEmploymentTypes.length > 0
                  ? 'Prova att justera dina filter eller sök efter något annat.'
                  : 'Det finns inga aktiva jobbannonser just nu. Kom tillbaka senare!'}
              </p>
              {(searchInput || selectedCity || selectedCategory !== 'all-categories' || selectedEmploymentTypes.length > 0) && (
                <Button
                  onClick={() => {
                    setSearchInput('');
                    setSelectedCity('');
                    setSelectedPostalCode('');
                    setSelectedCategory('all-categories');
                    setSelectedSubcategories([]);
                    setSelectedEmploymentTypes([]);
                  }}
                  variant="outline"
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Rensa alla filter
                </Button>
              )}
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
                    {pageJobs.map((job) => (
                       <TableRow 
                        key={job.id} 
                        className="border-white/10 cursor-pointer transition-all duration-300 md:hover:bg-white/10"
                        onClick={() => navigate(`/job-details/${job.id}`)}
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
                                navigate(`/job-details/${job.id}`);
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
                    {pageJobs.map((job) => (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer transition-all duration-300 md:hover:bg-white/10 md:hover:text-white'}
              />
            </PaginationItem>
            
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    onClick={() => setPage(pageNum)}
                    isActive={page === pageNum}
                    className="cursor-pointer transition-all duration-300 md:hover:bg-white/10 md:hover:text-white"
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            
            {totalPages > 5 && page < totalPages - 2 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer transition-all duration-300 md:hover:bg-white/10 md:hover:text-white'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default SearchJobs;

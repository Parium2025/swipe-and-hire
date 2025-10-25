import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Users, Briefcase, MapPin, Tag, Phone, Building2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { CandidateFilters, FilterOption } from '@/types/candidateFilters';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CandidatesAdvancedFiltersProps {
  filters: CandidateFilters;
  onFiltersChange: (filters: CandidateFilters) => void;
  stats: {
    total: number;
    new: number;
    reviewing: number;
    accepted: number;
    rejected: number;
  };
}

export const CandidatesAdvancedFilters = ({ 
  filters, 
  onFiltersChange,
  stats 
}: CandidatesAdvancedFiltersProps) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<FilterOption[]>([]);
  const [cities, setCities] = useState<FilterOption[]>([]);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [occupations, setOccupations] = useState<FilterOption[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<FilterOption[]>([]);

  // Fetch filter options from database
  useEffect(() => {
    if (!user) return;

    const fetchFilterOptions = async () => {
      // Fetch jobs for this employer's organization
      const { data: jobsData } = await supabase
        .from('job_postings')
        .select('id, title, workplace_city')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (jobsData) {
        setJobs(jobsData.map(job => ({
          label: `${job.title}${job.workplace_city ? ` - ${job.workplace_city}` : ''}`,
          value: job.id,
        })));

        // Extract unique cities
        const uniqueCities = [...new Set(jobsData
          .map(job => job.workplace_city)
          .filter(Boolean)
        )] as string[];
        setCities(uniqueCities.map(city => ({ label: city, value: city })));
      }

      // Fetch unique categories, occupations, employment types
      const { data: metaData } = await supabase
        .from('job_postings')
        .select('category, occupation, employment_type')
        .eq('is_active', true);

      if (metaData) {
        const uniqueCategories = [...new Set(metaData.map(d => d.category).filter(Boolean))] as string[];
        const uniqueOccupations = [...new Set(metaData.map(d => d.occupation).filter(Boolean))] as string[];
        const uniqueEmploymentTypes = [...new Set(metaData.map(d => d.employment_type).filter(Boolean))] as string[];

        setCategories(uniqueCategories.map(c => ({ 
          label: c.charAt(0).toUpperCase() + c.slice(1), 
          value: c 
        })));
        setOccupations(uniqueOccupations.map(o => ({ label: o, value: o })));
        setEmploymentTypes(uniqueEmploymentTypes.map(t => ({ 
          label: t === 'full_time' ? 'Heltid' : t === 'part_time' ? 'Deltid' : t, 
          value: t 
        })));
      }
    };

    fetchFilterOptions();
  }, [user]);

  const updateFilter = (key: keyof CandidateFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: keyof CandidateFilters, value: string) => {
    const currentArray = filters[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(v => v !== value)
      : [...currentArray, value];
    updateFilter(key, newArray);
  };

  const statusFilters = [
    { id: 'pending', label: 'Nya ansökningar', count: stats.new, icon: Briefcase },
    { id: 'reviewing', label: 'Under granskning', count: stats.reviewing, icon: Clock },
    { id: 'accepted', label: 'Accepterade', count: stats.accepted, icon: CheckCircle },
    { id: 'rejected', label: 'Avvisade', count: stats.rejected, icon: XCircle },
  ];

  const activeFilterCount = 
    filters.status.length + 
    filters.jobIds.length + 
    filters.cities.length + 
    filters.categories.length + 
    filters.occupations.length + 
    filters.employmentTypes.length +
    (filters.phone ? 1 : 0) +
    (filters.location ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Header with active filter count */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Filter
        </h3>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="bg-primary/20 text-primary">
            {activeFilterCount} aktiva
          </Badge>
        )}
      </div>

      <Accordion type="multiple" defaultValue={['status', 'search']} className="w-full">
        {/* Search & Contact Info */}
        <AccordionItem value="search">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Kandidatinfo
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div>
              <Label htmlFor="phone" className="text-xs text-muted-foreground">Telefonnummer</Label>
              <Input
                id="phone"
                type="text"
                placeholder="Sök på telefon..."
                value={filters.phone}
                onChange={(e) => updateFilter('phone', e.target.value)}
                className="h-9 text-sm bg-white/5 border-white/20"
              />
            </div>
            <div>
              <Label htmlFor="location" className="text-xs text-muted-foreground">Plats/Stad</Label>
              <Input
                id="location"
                type="text"
                placeholder="Sök på plats..."
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
                className="h-9 text-sm bg-white/5 border-white/20"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Status Filter */}
        <AccordionItem value="status">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Status för kandidat
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            {statusFilters.map((status) => {
              const Icon = status.icon;
              const isSelected = filters.status.includes(status.id);
              
              return (
                <div
                  key={status.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary/20 border border-primary/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                  onClick={() => toggleArrayFilter('status', status.id)}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isSelected} />
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{status.label}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {status.count}
                  </Badge>
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>

        {/* Jobs Filter */}
        {jobs.length > 0 && (
          <AccordionItem value="jobs">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Jobb ({filters.jobIds.length > 0 ? filters.jobIds.length : 'alla'})
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 max-h-64 overflow-y-auto">
              {jobs.map((job) => (
                <div
                  key={job.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer"
                  onClick={() => toggleArrayFilter('jobIds', job.value)}
                >
                  <Checkbox checked={filters.jobIds.includes(job.value)} />
                  <span className="text-sm">{job.label}</span>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Cities Filter */}
        {cities.length > 0 && (
          <AccordionItem value="cities">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Arbetsplatser ({filters.cities.length > 0 ? filters.cities.length : 'alla'})
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              {cities.map((city) => (
                <div
                  key={city.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer"
                  onClick={() => toggleArrayFilter('cities', city.value)}
                >
                  <Checkbox checked={filters.cities.includes(city.value)} />
                  <span className="text-sm">{city.label}</span>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Categories Filter */}
        {categories.length > 0 && (
          <AccordionItem value="categories">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Kategori
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer"
                  onClick={() => toggleArrayFilter('categories', category.value)}
                >
                  <Checkbox checked={filters.categories.includes(category.value)} />
                  <span className="text-sm">{category.label}</span>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Occupations Filter */}
        {occupations.length > 0 && (
          <AccordionItem value="occupations">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Roll/Yrke
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 max-h-64 overflow-y-auto">
              {occupations.map((occupation) => (
                <div
                  key={occupation.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer"
                  onClick={() => toggleArrayFilter('occupations', occupation.value)}
                >
                  <Checkbox checked={filters.occupations.includes(occupation.value)} />
                  <span className="text-sm">{occupation.label}</span>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Employment Types Filter */}
        {employmentTypes.length > 0 && (
          <AccordionItem value="employmentTypes">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Anställningstyp
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              {employmentTypes.map((type) => (
                <div
                  key={type.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer"
                  onClick={() => toggleArrayFilter('employmentTypes', type.value)}
                >
                  <Checkbox checked={filters.employmentTypes.includes(type.value)} />
                  <span className="text-sm">{type.label}</span>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
};

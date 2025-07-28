import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Search, MapPin, Clock, Building, Filter, Heart, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Job {
  id: string;
  title: string;
  company_name: string;
  location: string;
  employment_type: string;
  salary_min?: number;
  salary_max?: number;
  description: string;
  created_at: string;
}

const SearchJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all-locations');
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('all-types');

  // Job categories - like AF but better organized
  const jobCategories = [
    { value: 'it', label: 'IT & Data', keywords: ['utvecklare', 'programmerare', 'IT', 'data', 'systemadministratör', 'webb'] },
    { value: 'consulting', label: 'Konsultuppdrag', keywords: ['konsult', 'rådgivare', 'expert', 'specialist'] },
    { value: 'warehouse', label: 'Lager & Logistik', keywords: ['lager', 'logistik', 'transport', 'distribution'] },
    { value: 'sales', label: 'Försäljning', keywords: ['försäljning', 'sales', 'säljare', 'account'] },
    { value: 'marketing', label: 'Marknadsföring', keywords: ['marketing', 'marknadsföring', 'reklam', 'kommunikation'] },
    { value: 'finance', label: 'Ekonomi & Finans', keywords: ['ekonomi', 'redovisning', 'finans', 'controller'] },
    { value: 'healthcare', label: 'Vård & Omsorg', keywords: ['sjuksköterska', 'läkare', 'vård', 'omsorg'] },
    { value: 'education', label: 'Utbildning', keywords: ['lärare', 'utbildning', 'skola', 'universitet'] },
    { value: 'construction', label: 'Bygg & Anläggning', keywords: ['bygg', 'snickare', 'elektriker', 'anläggning'] },
    { value: 'service', label: 'Service & Kundtjänst', keywords: ['kundtjänst', 'service', 'support', 'reception'] }
  ];

  const locations = [
    'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 
    'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå'
  ];

  const employmentTypes = [
    { value: 'Heltid', label: 'Heltid' },
    { value: 'Deltid', label: 'Deltid' },
    { value: 'Konsult', label: 'Konsultuppdrag' },
    { value: 'Praktik', label: 'Praktik' },
    { value: 'Tillfällig', label: 'Vikariat' }
  ];

  const fetchJobs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('job_postings')
        .select(`
          *,
          profiles!job_postings_employer_id_fkey(company_name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Apply search filters
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      if (selectedLocation && selectedLocation !== 'all-locations') {
        query = query.ilike('location', `%${selectedLocation}%`);
      }

      if (selectedEmploymentType && selectedEmploymentType !== 'all-types') {
        query = query.eq('employment_type', selectedEmploymentType);
      }

      // Apply category filter
      if (selectedCategory && selectedCategory !== 'all-categories') {
        const category = jobCategories.find(cat => cat.value === selectedCategory);
        if (category) {
          const keywordConditions = category.keywords.map(keyword => 
            `title.ilike.%${keyword}%,description.ilike.%${keyword}%`
          ).join(',');
          query = query.or(keywordConditions);
        }
      }

      const { data, error } = await query.limit(20);
      
      if (error) throw error;
      
      // Transform the data to match our Job interface
      const transformedJobs = (data || []).map(job => ({
        ...job,
        company_name: job.profiles?.company_name || 'Okänt företag'
      }));
      
      setJobs(transformedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [searchTerm, selectedLocation, selectedCategory, selectedEmploymentType]);

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

  const handleQuickCategory = (category: string) => {
    setSelectedCategory(category);
    setSearchTerm('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sök Jobb</h1>
        <p className="text-muted-foreground">
          Hitta ditt nästa drömjobb med våra smarta sökverktyg
        </p>
      </div>

      {/* Quick Category Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Populära kategorier</CardTitle>
          <CardDescription>Klicka för att snabbt hitta jobb inom dessa områden</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {jobCategories.slice(0, 6).map((category) => (
              <Button
                key={category.value}
                variant={selectedCategory === category.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickCategory(category.value)}
                className="flex items-center gap-2"
              >
                <Building className="h-4 w-4" />
                {category.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Sökfilter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Term */}
            <div className="space-y-2">
              <Label htmlFor="search">Sökord</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Jobbtitel, företag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>Plats</Label>
              <Select value={selectedLocation} onValueChange={(value) => setSelectedLocation(value === 'all-locations' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj plats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-locations">Alla platser</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value === 'all-categories' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-categories">Alla kategorier</SelectItem>
                  {jobCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employment Type */}
            <div className="space-y-2">
              <Label>Anställningsform</Label>
              <Select value={selectedEmploymentType} onValueChange={(value) => setSelectedEmploymentType(value === 'all-types' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-types">Alla typer</SelectItem>
                  {employmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="flex justify-between items-center pt-2">
            <p className="text-sm text-muted-foreground">
              {jobs.length} jobb hittades
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedLocation('all-locations');
                setSelectedCategory('all-categories');
                setSelectedEmploymentType('all-types');
              }}
            >
              Rensa filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job Results */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Söker jobb...</p>
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">Inga jobb hittades med dina sökkriterier.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Prova att ändra dina filter eller sökord.
              </p>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {job.company_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {job.employment_type}
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-3 line-clamp-2">
                      {job.description.substring(0, 150)}...
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-green-700 border-green-200">
                        {formatSalary(job.salary_min, job.salary_max)}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Publicerad {new Date(job.created_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <Button size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ansök
                    </Button>
                    <Button variant="outline" size="sm">
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SearchJobs;
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Clock, Building, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Job {
  id: string;
  title: string;
  employer_id: string;
  location: string;
  employment_type: string;
  salary_min?: number;
  salary_max?: number;
  description: string;
  created_at: string;
  category?: string;
  company_name?: string;
}

interface JobStats {
  total_jobs: number;
  total_positions: number;
}

const SearchJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all-locations');
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [jobStats, setJobStats] = useState<JobStats>({ total_jobs: 0, total_positions: 0 });

  // Simplified job categories
  const jobCategories = [
    { value: 'administration', label: 'Administration, Ekonomi, Juridik' },
    { value: 'construction', label: 'Bygg och Anläggning' },
    { value: 'management', label: 'Chefer och Verksamhetsledare' },
    { value: 'it', label: 'Data/IT' },
    { value: 'sales', label: 'Försäljning, Marknadsföring' },
    { value: 'crafts', label: 'Hantverksyrken' },
    { value: 'restaurant', label: 'Hotell, Restaurang' },
    { value: 'healthcare', label: 'Hälso- och Sjukvård' },
    { value: 'industry', label: 'Industriell Tillverkning' },
    { value: 'logistics', label: 'Transport och Logistik' },
    { value: 'creative', label: 'Kultur, Media, Design' },
    { value: 'education', label: 'Pedagogiskt Arbete' },
    { value: 'technical', label: 'Teknik, Forskning' }
  ];

  // Swedish cities
  const locations = [
    'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 
    'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås', 
    'Eskilstuna', 'Södertälje', 'Karlstad', 'Växjö', 'Halmstad', 'Sundsvall'
  ];

  // Fetch job statistics
  const fetchJobStats = async () => {
    try {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title', { count: 'exact' })
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching job stats:', error);
        return;
      }

      setJobStats({
        total_jobs: data?.length || 0,
        total_positions: data?.length || 0
      });
    } catch (error) {
      console.error('Error fetching job stats:', error);
    }
  };

  // Fetch jobs with search and filters
  const fetchJobs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('job_postings')
        .select(`
          id,
          title,
          location,
          employment_type,
          salary_min,
          salary_max,
          description,
          created_at,
          category,
          employer_id,
          profiles!job_postings_employer_id_fkey(company_name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (searchTerm.trim()) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      if (selectedLocation && selectedLocation !== 'all-locations') {
        query = query.ilike('location', `%${selectedLocation}%`);
      }

      if (selectedCategory && selectedCategory !== 'all-categories') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching jobs:', error);
        return;
      }

      const jobsWithCompanyName = data?.map(job => ({
        ...job,
        company_name: job.profiles?.company_name || 'Företag'
      })) || [];

      setJobs(jobsWithCompanyName);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = () => {
    fetchJobs();
  };

  // Initialize data
  useEffect(() => {
    fetchJobStats();
    fetchJobs();
  }, [searchTerm, selectedLocation, selectedCategory]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Idag';
    if (diffDays === 2) return 'Igår';
    if (diffDays <= 7) return `${diffDays - 1} dagar sedan`;
    return date.toLocaleDateString('sv-SE');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Parium
          </h1>
          <p className="text-white/80 text-lg">
            Jobböskare: Fredrik Andits
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Main Search Section */}
        <div className="mb-8">
          <div className="bg-white/10 backdrop-blur-sm border-white/20 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Hitta ditt nästa steg
            </h2>
            <p className="text-white/80 text-center mb-8">
              Enkel, smart och snabb jobbsökning. Välj kategori eller sök fritt - vi hjälper dig hitta rätt.
            </p>
            
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/50" />
              <Input
                placeholder="Sök på ett eller flera ord"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 text-lg bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 hover:bg-white/15 focus:bg-white/15 transition-colors rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button 
                onClick={handleSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-green-500 hover:bg-green-600 text-white font-semibold px-8 h-10"
              >
                Sök
              </Button>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="h-12 bg-white/10 border-white/20 text-white">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedLocation === 'all-locations' ? 'Ort' : selectedLocation || 'Ort'}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-500 text-white">
                  <SelectItem value="all-locations">Alla orter</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-12 bg-white/10 border-white/20 text-white">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span>{selectedCategory === 'all-categories' ? 'Yrke' : selectedCategory ? jobCategories.find(cat => cat.value === selectedCategory)?.label : 'Yrke'}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-500 text-white">
                  <SelectItem value="all-categories">Alla yrken</SelectItem>
                  {jobCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="mb-8">
          <div className="bg-white/10 backdrop-blur-sm border-white/20 rounded-lg p-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">
                {jobStats.total_jobs.toLocaleString()} annonser med {jobStats.total_positions.toLocaleString()} jobb
              </h3>
              <p className="text-white/70">
                Hittade annonser på Parium
              </p>
            </div>
          </div>
        </div>

        {/* Job Results */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <p className="text-white/70 mt-4">Söker jobb...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-sm border-white/20 rounded-lg p-8 text-center">
              <p className="text-white/70 text-lg">Inga jobb hittades</p>
              <p className="text-white/50 mt-2">Prova att ändra dina sökkriterier</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div 
                key={job.id} 
                className="bg-white/10 backdrop-blur-sm border-white/20 rounded-lg p-6 hover:bg-white/15 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-green-400 border-green-400 text-xs">
                        Ny
                      </Badge>
                      <h3 className="text-xl font-semibold text-white">
                        {job.title}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-white/70">
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          <span>{job.company_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{job.location}</span>
                        </div>
                        {job.employment_type && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{job.employment_type}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-white/80 text-sm line-clamp-2">
                        {job.description}
                      </p>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-white/60 text-sm">
                          Publicerad {formatDate(job.created_at)}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-white border-white/30 hover:bg-white/20"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Spara
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchJobs;
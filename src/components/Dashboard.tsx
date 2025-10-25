import { memo, useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Users, Eye, TrendingUp, MapPin, Calendar, Search, ArrowUpDown } from 'lucide-react';
import { useOrganizationJobsData } from '@/hooks/useOrganizationJobsData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { formatDateShortSv } from '@/lib/date';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { expandSearchTerms } from '@/lib/smartSearch';

const Dashboard = memo(() => {
  const { jobs, stats, isLoading, invalidateJobs } = useOrganizationJobsData();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc'>('newest');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];
    
    // Filter based on search term
    if (searchTerm.trim()) {
      const expandedTerms = expandSearchTerms(searchTerm);
      result = result.filter(job => {
        const searchableText = [
          job.title,
          job.location,
          job.employment_type,
          job.description,
          job.workplace_city,
          job.employer_profile?.first_name,
          job.employer_profile?.last_name
        ].filter(Boolean).join(' ').toLowerCase();
        
        return expandedTerms.some(term => 
          searchableText.includes(term.toLowerCase())
        );
      });
    }
    
    // Sort
    switch (sortBy) {
      case 'oldest':
        return result.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'title-asc':
        return result.sort((a, b) => 
          a.title.localeCompare(b.title, 'sv')
        );
      case 'title-desc':
        return result.sort((a, b) => 
          b.title.localeCompare(a.title, 'sv')
        );
      case 'newest':
      default:
        return result.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [jobs, searchTerm, sortBy]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12">
      <div className="text-center">
        <h1 className="text-xl md:text-2xl font-semibold text-white">Dashboard</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-2">
        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4">
            <Briefcase className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white">Totalt annonser</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalJobs}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4">
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white">Aktiva</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.activeJobs}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4">
            <Eye className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white">Totala visningar</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalViews}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4">
            <Users className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white">Ansökningar</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalApplications}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col md:flex-row gap-2">
        {/* Search field */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
          <Input
            placeholder="Sök efter titel, plats, anställningstyp, rekryterare..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/60"
          />
        </div>
        
        {/* Sort menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full md:w-auto md:min-w-[180px] bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              {sortBy === 'newest' && 'Nyast först'}
              {sortBy === 'oldest' && 'Äldst först'}
              {sortBy === 'title-asc' && 'Titel A-Ö'}
              {sortBy === 'title-desc' && 'Titel Ö-A'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end"
            className="w-[200px]"
          >
            <DropdownMenuItem onClick={() => setSortBy('newest')}>
              Nyast först
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('oldest')}>
              Äldst först
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('title-asc')}>
              Titel A-Ö
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('title-desc')}>
              Titel Ö-A
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Result indicator */}
      {searchTerm && (
        <div className="text-sm text-white">
          Visar {filteredAndSortedJobs.length} av {jobs.length} annonser
        </div>
      )}

      {/* Jobs Table */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardHeader className="p-6 md:p-4">
          <CardTitle className="text-sm text-white text-center md:text-left">
            Utlagda jobb av {profile?.company_name || 'ditt företag'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
          
          {/* Desktop: Table view */}
          <div className="hidden md:block overflow-x-auto -mx-2">
            <Table>
              <TableHeader>
                <TableRow className="border-white/20 hover:bg-white/5">
                  <TableHead className="text-white font-semibold text-sm px-2">Titel</TableHead>
                  <TableHead className="text-white font-semibold text-sm px-2">Status</TableHead>
                  <TableHead className="text-white font-semibold text-sm text-center px-2">Visningar</TableHead>
                  <TableHead className="text-white font-semibold text-sm text-center px-2">Ansökningar</TableHead>
                  <TableHead className="text-white font-semibold text-sm px-2">Plats</TableHead>
                  <TableHead className="text-white font-semibold text-sm px-2">Rekryterare</TableHead>
                  <TableHead className="text-white font-semibold text-sm px-2">Skapad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-white/60 py-8 text-sm">
                      Laddar...
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center !text-white py-8 font-medium text-sm">
                      {searchTerm ? 'Inga annonser matchar din sökning' : 'Inga jobbannonser än. Skapa din första annons!'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedJobs.map((job) => (
                    <TableRow 
                      key={job.id}
                      className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => navigate(`/job-details/${job.id}`)}
                    >
                      <TableCell className="font-medium text-white px-2 py-2">
                        <JobTitleCell title={job.title} employmentType={job.employment_type} />
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <Badge 
                          variant={job.is_active ? "default" : "secondary"}
                          className={`text-sm whitespace-nowrap ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                        >
                          {job.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center px-2 py-2">
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-sm">
                          {job.views_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center px-2 py-2">
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-sm">
                          {job.applications_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white px-2 py-2">
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin size={12} className="flex-shrink-0" />
                          <TruncatedText text={job.location} className="break-words leading-tight" />
                        </div>
                      </TableCell>
                      <TableCell className="text-white px-2 py-2">
                        <TruncatedText 
                          text={job.employer_profile?.first_name && job.employer_profile?.last_name
                            ? `${job.employer_profile.first_name} ${job.employer_profile.last_name}`
                            : '-'}
                          className="text-sm truncate max-w-[150px] block"
                        />
                      </TableCell>
                      <TableCell className="text-white px-2 py-2">
                        <div className="flex items-center gap-1 text-sm whitespace-nowrap min-w-[110px]">
                          <Calendar size={12} />
                          {formatDateShortSv(job.created_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: Card list view */}
          <div className="block md:hidden">
            {isLoading ? (
              <div className="text-center text-white/60 py-8 text-sm">
                Laddar...
              </div>
            ) : filteredAndSortedJobs.length === 0 ? (
              <div className="text-center text-white py-8 font-medium text-sm">
                {searchTerm ? 'Inga annonser matchar din sökning' : 'Inga jobbannonser än. Skapa din första annons!'}
              </div>
            ) : (
              <div className="rounded-none bg-transparent ring-0 shadow-none">
                <ScrollArea className="h-[calc(100vh-280px)] min-h-[320px]">
                  <div className="space-y-2 px-2 py-2 pb-24">
                    {filteredAndSortedJobs.map((job) => (
                      <ReadOnlyMobileJobCard
                        key={job.id}
                        job={job}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;

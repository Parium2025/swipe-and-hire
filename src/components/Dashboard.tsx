import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Users, Eye, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { useJobsData } from '@/hooks/useJobsData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { formatDateShortSv } from '@/lib/date';
import { StatsGrid } from '@/components/StatsGrid';
import { JobSearchBar } from '@/components/JobSearchBar';
import { useJobFiltering } from '@/hooks/useJobFiltering';

const Dashboard = memo(() => {
  const { jobs, stats, recruiters, isLoading } = useJobsData();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const {
    searchInput,
    setSearchInput,
    searchTerm,
    sortBy,
    setSortBy,
    selectedRecruiterId,
    setSelectedRecruiterId,
    filteredAndSortedJobs,
  } = useJobFiltering(jobs);

  const statsCards = useMemo(() => [
    { icon: Briefcase, title: 'Totalt annonser', value: stats.totalJobs, loading: false },
    { icon: TrendingUp, title: 'Aktiva annonser', value: stats.activeJobs, loading: false },
    { icon: Eye, title: 'Totala visningar', value: stats.totalViews, loading: false },
    { icon: Users, title: 'Ansökningar', value: stats.totalApplications, loading: false },
  ], [stats]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12">
      <div className="text-center">
        <h1 className="text-xl md:text-2xl font-semibold text-white">Dashboard</h1>
      </div>

      <StatsGrid stats={statsCards} />

      <JobSearchBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        sortBy={sortBy}
        onSortChange={setSortBy}
        recruiters={recruiters}
        selectedRecruiterId={selectedRecruiterId}
        onRecruiterChange={setSelectedRecruiterId}
        placeholder="Sök efter titel, plats, anställningstyp, rekryterare..."
        companyName={profile?.company_name}
      />

      {searchTerm && (
        <div className="text-sm text-white">
          Visar {filteredAndSortedJobs.length} av {jobs.length} annonser
        </div>
      )}

      <Card className="bg-white/5 backdrop-blur-sm border-0">
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
                        job={job as any}
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

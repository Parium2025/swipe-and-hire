import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Users, Eye, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { useJobsData } from '@/hooks/useJobsData';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';

const Dashboard = memo(() => {
  const { jobs, stats, isLoading, invalidateJobs } = useJobsData();
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12">
      <div className="flex justify-between items-center">
        <div className="flex-1"></div>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
        </div>
        <div className="flex-1 flex justify-end">
          <CreateJobSimpleDialog 
            onJobCreated={() => {
              invalidateJobs();
            }}
          />
        </div>
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
            <CardTitle className="text-xs md:text-sm font-medium text-white">Aktiva annonser</CardTitle>
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


      {/* Jobs Table */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardHeader className="p-6 md:p-4">
          <CardTitle className="text-sm text-white">
            Utlagda jobb av {profile?.company_name || 'ditt företag'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
          <div className="overflow-x-auto -mx-2">
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
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center !text-white py-8 font-medium text-sm">
                      Inga jobbannonser än. Skapa din första annons!
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
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
                        <div className="flex items-center gap-1 text-sm whitespace-nowrap">
                          <Calendar size={12} />
                          {new Date(job.created_at).toLocaleDateString('sv-SE', { 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;

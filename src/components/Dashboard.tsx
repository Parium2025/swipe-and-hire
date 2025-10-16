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

const Dashboard = memo(() => {
  const { jobs, stats, isLoading, invalidateJobs } = useJobsData();
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Dashboard</h1>
        <CreateJobSimpleDialog 
          onJobCreated={() => {
            invalidateJobs();
          }}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-white">
              Totalt annonser
            </CardTitle>
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 text-white/70" />
          </CardHeader>
          <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4">
            <div className="text-xl sm:text-2xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalJobs}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-white">
              Aktiva annonser
            </CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-white/70" />
          </CardHeader>
          <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4">
            <div className="text-xl sm:text-2xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.activeJobs}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-white">
              Totala visningar
            </CardTitle>
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-white/70" />
          </CardHeader>
          <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4">
            <div className="text-xl sm:text-2xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalViews}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-white">
              Ansökningar
            </CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-white/70" />
          </CardHeader>
          <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4">
            <div className="text-xl sm:text-2xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalApplications}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <CardTitle className="text-base sm:text-lg md:text-xl text-white">
            Utlagda jobb av {profile?.company_name || 'ditt företag'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 md:px-6 pb-3 sm:pb-4">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/20 hover:bg-white/5">
                  <TableHead className="text-white font-semibold text-xs sm:text-sm px-2 sm:px-4">Titel</TableHead>
                  <TableHead className="text-white font-semibold text-xs sm:text-sm px-2 sm:px-4 hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-white font-semibold text-xs sm:text-sm text-center px-2 sm:px-4 hidden md:table-cell">Ansökningar</TableHead>
                  <TableHead className="text-white font-semibold text-xs sm:text-sm text-center px-2 sm:px-4 hidden md:table-cell">Visningar</TableHead>
                  <TableHead className="text-white font-semibold text-xs sm:text-sm px-2 sm:px-4 hidden lg:table-cell">Plats</TableHead>
                  <TableHead className="text-white font-semibold text-xs sm:text-sm px-2 sm:px-4 hidden lg:table-cell">Skapad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-white/60 py-8 text-xs sm:text-sm">
                      Laddar...
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center !text-white py-8 font-medium text-xs sm:text-sm">
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
                      <TableCell className="font-medium text-white px-2 sm:px-4 py-3 sm:py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs sm:text-sm md:text-base line-clamp-2">{job.title}</span>
                          {job.employment_type && (
                            <Badge variant="outline" className="w-fit text-[10px] sm:text-xs bg-white/5 text-white border-white/20">
                              {getEmploymentTypeLabel(job.employment_type)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 py-3 sm:py-4 hidden sm:table-cell">
                        <Badge 
                          variant={job.is_active ? "default" : "secondary"}
                          className={`text-xs whitespace-nowrap ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                        >
                          {job.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center px-2 sm:px-4 py-3 sm:py-4 hidden md:table-cell">
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                          {job.applications_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center px-2 sm:px-4 py-3 sm:py-4 hidden md:table-cell">
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                          {job.views_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white px-2 sm:px-4 py-3 sm:py-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs sm:text-sm">
                          <MapPin size={12} className="sm:w-3.5 sm:h-3.5" />
                          <span className="truncate max-w-[120px]">{job.location}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-white px-2 sm:px-4 py-3 sm:py-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <Calendar size={12} className="sm:w-3.5 sm:h-3.5" />
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

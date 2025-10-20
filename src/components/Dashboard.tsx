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
import { useIsMobile } from '@/hooks/use-mobile';

const Dashboard = memo(() => {
  const { jobs, stats, isLoading, invalidateJobs } = useJobsData();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 md:p-4">
            <Briefcase className="h-4 w-4 md:h-4 md:w-4 text-white flex-shrink-0" />
            <CardTitle className="text-xs md:text-xs font-medium text-white">Totalt annonser</CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
            <div className="text-xl md:text-xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalJobs}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 md:p-4">
            <TrendingUp className="h-4 w-4 md:h-4 md:w-4 text-white flex-shrink-0" />
            <CardTitle className="text-xs md:text-xs font-medium text-white">Aktiva annonser</CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
            <div className="text-xl md:text-xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.activeJobs}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 md:p-4">
            <Eye className="h-4 w-4 md:h-4 md:w-4 text-white flex-shrink-0" />
            <CardTitle className="text-xs md:text-xs font-medium text-white">Totala visningar</CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
            <div className="text-xl md:text-xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalViews}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 md:p-4">
            <Users className="h-4 w-4 md:h-4 md:w-4 text-white flex-shrink-0" />
            <CardTitle className="text-xs md:text-xs font-medium text-white">Ansökningar</CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
            <div className="text-xl md:text-xl font-bold text-white transition-all duration-300">
              {isLoading ? '...' : stats.totalApplications}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Jobs Table */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardHeader className="px-3 md:px-4 py-3 md:py-4">
          <CardTitle className="text-sm md:text-base text-white">
            Utlagda jobb av {profile?.company_name || 'ditt företag'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-3 pb-3 md:pb-4">
          <div className="overflow-x-auto -mx-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            <Table>
              <TableHeader>
                <TableRow className="border-white/20 hover:bg-white/5">
                  <TableHead className="text-white font-semibold text-xs px-2">Titel</TableHead>
                  <TableHead className="text-white font-semibold text-xs px-2">Status</TableHead>
                  <TableHead className="text-white font-semibold text-xs text-center px-2">Ansökningar</TableHead>
                  {!isMobile && <TableHead className="text-white font-semibold text-xs text-center px-2">Visningar</TableHead>}
                  {!isMobile && <TableHead className="text-white font-semibold text-xs px-2">Plats</TableHead>}
                  <TableHead className="text-white font-semibold text-xs px-2">Skapad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 4 : 6} className="text-center text-white/60 py-8 text-xs">
                      Laddar...
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 4 : 6} className="text-center !text-white py-8 font-medium text-xs">
                      Inga jobbannonser än. Skapa din första annons!
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow 
                      key={job.id}
                      className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors touch-manipulation"
                      onClick={() => navigate(`/job-details/${job.id}`)}
                    >
                      <TableCell className="font-medium text-white px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs line-clamp-2">{job.title}</span>
                          {job.employment_type && (
                            <Badge variant="outline" className="w-fit text-[10px] bg-white/5 text-white border-white/20">
                              {getEmploymentTypeLabel(job.employment_type)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-3">
                        <Badge 
                          variant={job.is_active ? "default" : "secondary"}
                          className={`text-xs whitespace-nowrap ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                        >
                          {job.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center px-2 py-3">
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                          {job.applications_count || 0}
                        </Badge>
                      </TableCell>
                      {!isMobile && (
                        <TableCell className="text-center px-2 py-3">
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                            {job.views_count || 0}
                          </Badge>
                        </TableCell>
                      )}
                      {!isMobile && (
                        <TableCell className="text-white px-2 py-3">
                          <div className="flex items-center gap-1 text-xs">
                            <MapPin size={12} />
                            <span className="truncate max-w-[120px]">{job.location}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-white px-2 py-3">
                        <div className="flex items-center gap-1 text-xs whitespace-nowrap">
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

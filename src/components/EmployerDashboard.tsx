import { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { Eye, MessageCircle, MapPin, Calendar, Edit, Trash2, AlertTriangle, Briefcase, TrendingUp, Users } from 'lucide-react';
import EditJobDialog from '@/components/EditJobDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobsData, type JobPosting } from '@/hooks/useJobsData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EmployerDashboard = memo(() => {
  const navigate = useNavigate();
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('job_postings')
        .update({ is_active: !currentStatus })
        .eq('id', jobId);

      if (error) {
        toast({
          title: "Fel vid uppdatering",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Status uppdaterad",
        description: `Annonsen är nu ${!currentStatus ? 'aktiv' : 'inaktiv'}.`
      });

      invalidateJobs();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte uppdatera annonsens status.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (job: JobPosting) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      const { error } = await supabase
        .from('job_postings')
        .delete()
        .eq('id', jobToDelete.id);

      if (error) {
        toast({
          title: "Fel vid borttagning",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Annons borttagen",
        description: "Jobbannonsen har tagits bort."
      });

      setDeleteDialogOpen(false);
      setJobToDelete(null);
      invalidateJobs();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte ta bort annonsen.",
        variant: "destructive"
      });
    }
  };

  const handleEditJob = (job: JobPosting) => {
    console.log('[MyJobs] Open edit for job:', { id: job.id, title: job.title });
    setEditingJob(job);
    setEditDialogOpen(true);
  };


  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return '';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return '';
  };


  return (
    <div className="space-y-4 max-w-6xl mx-auto px-12">
      <div className="flex justify-between items-center">
        <div className="flex-1"></div>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold text-white">Mina jobbannonser</h1>
        </div>
        <div className="flex-1 flex justify-end">
          {/* Spacer to match "Skapa ny annons"-knappens radhöjd på Dashboard */}
          <div className="h-10 min-w-[160px]" aria-hidden="true" />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-6 md:p-4">
            <Briefcase className="h-4 w-4 text-white" />
            <CardTitle className="text-sm font-medium text-white">Totalt annonser</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
            <div className="text-xl font-bold text-white transition-all duration-300">
              {loading ? '...' : jobs.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-6 md:p-4">
            <TrendingUp className="h-4 w-4 text-white" />
            <CardTitle className="text-sm font-medium text-white">Aktiva annonser</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
            <div className="text-xl font-bold text-white transition-all duration-300">
              {loading ? '...' : jobs.filter(job => job.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-6 md:p-4">
            <Eye className="h-4 w-4 text-white" />
            <CardTitle className="text-sm font-medium text-white">Totala visningar</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
            <div className="text-xl font-bold text-white transition-all duration-300">
              {loading ? '...' : jobs.reduce((sum, job) => sum + job.views_count, 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-6 md:p-4">
            <Users className="h-4 w-4 text-white" />
            <CardTitle className="text-sm font-medium text-white">Ansökningar</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
            <div className="text-xl font-bold text-white transition-all duration-300">
              {loading ? '...' : jobs.reduce((sum, job) => sum + job.applications_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardHeader className="p-6 md:p-4">
          <CardTitle className="text-sm text-white">
            Mina jobbannonser
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
                  <TableHead className="text-white font-semibold text-sm px-2">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-white/60 py-8 text-sm">
                      Laddar...
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center !text-white py-8 font-medium text-sm">
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
                          <TruncatedText text={job.location} className="truncate max-w-[120px]" />
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
                      <TableCell className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={job.is_active}
                            onCheckedChange={() => toggleJobStatus(job.id, job.is_active)}
                            onClick={(e) => e.stopPropagation()}
                            className="scale-75"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditJob(job);
                            }}
                            className="h-7 px-2 bg-white/10 border-white/20 text-white hover:bg-white/20 text-[10px]"
                          >
                            <Edit size={12} />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(job);
                            }}
                            className="h-7 px-2 bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 text-[10px]"
                          >
                            <Trash2 size={12} />
                          </Button>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-white/20 text-white max-w-md w-[28rem] p-6 bg-gradient-to-br from-[hsl(215,100%,12%)] to-[hsl(215,90%,15%)] backdrop-blur-md rounded-xl shadow-2xl">
          <AlertDialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base font-semibold">
                Ta bort jobbannons
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {jobToDelete && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white">"{jobToDelete.title}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setJobToDelete(null);
              }}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteJob}
              className="bg-red-500 hover:bg-red-600 text-white border-0 text-sm"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditJobDialog
        job={editingJob}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onJobUpdated={invalidateJobs}
      />
    </div>
  );
});

EmployerDashboard.displayName = 'EmployerDashboard';

export default EmployerDashboard;
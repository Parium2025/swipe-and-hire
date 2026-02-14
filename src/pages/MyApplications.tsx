import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useMyApplicationsCache } from '@/hooks/useMyApplicationsCache';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { 
  Briefcase, 
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  Loader2,
  Video,
  Trash2,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { getTimeRemaining } from '@/lib/date';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import CandidateInterviewCard from '@/components/CandidateInterviewCard';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';
import { toast } from 'sonner';

interface Application {
  id: string;
  job_id: string;
  status: string;
  applied_at: string;
  created_at: string;
  job_postings: {
    id: string;
    title: string;
    location: string | null;
    employment_type: string | null;
    workplace_city: string | null;
    workplace_county: string | null;
    is_active: boolean | null;
    created_at: string;
    expires_at: string | null;
    deleted_at: string | null;
    applications_count: number | null;
    views_count: number | null;
    job_image_url: string | null;
    positions_count: number | null;
    profiles: {
      company_name: string | null;
      company_logo_url: string | null;
    } | null;
  } | null;
}

const getStatusLabel = (status: string, isExpiredOrDeleted: boolean) => {
  if (isExpiredOrDeleted) {
    return 'Utgången';
  }
  switch (status) {
    case 'pending':
    case 'reviewed':
    case 'offered':
      return 'Under granskning';
    case 'hired':
      return 'Anställd';
    case 'rejected':
      return 'Nekad';
    case 'interview':
      return 'Intervju';
    default:
      return 'Under granskning';
  }
};

const getStatusIcon = (status: string, isExpiredOrDeleted: boolean) => {
  if (isExpiredOrDeleted) {
    return <Clock className="h-3 w-3" />;
  }
  switch (status) {
    case 'pending':
    case 'reviewed':
    case 'offered':
      return <Hourglass className="h-3 w-3" />;
    case 'hired':
      return <CheckCircle2 className="h-3 w-3" />;
    case 'rejected':
      return <XCircle className="h-3 w-3" />;
    case 'interview':
      return <Calendar className="h-3 w-3" />;
    default:
      return <Hourglass className="h-3 w-3" />;
  }
};

const getStatusBadgeClasses = (status: string, isExpiredOrDeleted: boolean) => {
  if (isExpiredOrDeleted) {
    return 'bg-red-500/20 text-red-300 border-red-500/30';
  }
  switch (status) {
    case 'pending':
    case 'reviewed':
    case 'offered':
      return 'bg-amber-500/80 text-white border-0';
    case 'hired':
      return 'bg-green-500/80 text-white border-0';
    case 'rejected':
      return 'bg-red-500/80 text-white border-0';
    case 'interview':
      return 'bg-purple-500/80 text-white border-0';
    default:
      return 'bg-amber-500/80 text-white border-0';
  }
};


const MyApplications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [applicationToRemove, setApplicationToRemove] = useState<{ id: string; title: string } | null>(null);
  
  // Get candidate's interviews
  const { interviews, isLoading: interviewsLoading } = useCandidateInterviews();

  // Use cached applications hook for instant load + realtime sync
  const { applications, isLoading, error, deleteApplication } = useMyApplicationsCache();

  const handleDeleteClick = (jobId: string, jobTitle: string) => {
    // Find the application by job_id
    const app = applications?.find(a => a.job_postings?.id === jobId);
    if (app) {
      setApplicationToRemove({ id: app.id, title: jobTitle });
    }
  };

  const confirmRemoveApplication = async () => {
    if (!applicationToRemove) return;
    
    const applicationId = applicationToRemove.id;
    setApplicationToRemove(null);
    
    try {
      await deleteApplication(applicationId);
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
      toast.success('Ansökan borttagen');
    } catch (err) {
      console.error('Error removing application:', err);
      toast.error('Kunde inte ta bort ansökan');
    }
  };

  if (isLoading) {
    return (
       <div className="responsive-container-wide animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Mina Ansökningar</h1>
          <p className="text-sm text-white">Dina inskickade jobbansökningar</p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
       <div className="responsive-container-wide animate-fade-in">
        <div className="text-center py-12 text-red-400">
          Något gick fel vid hämtning av ansökningar
        </div>
      </div>
    );
  }

  return (
     <div className="responsive-container-wide animate-fade-in space-y-8">
      {/* Interviews Section */}
      {interviews && interviews.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-secondary/20 border border-secondary/30">
              <Video className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Kommande intervjuer</h2>
              <p className="text-sm text-white/70">
                {interviews.length === 1 ? '1 inbokad intervju' : `${interviews.length} inbokade intervjuer`}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {interviews.map((interview: any) => (
              <CandidateInterviewCard key={interview.id} interview={interview} />
            ))}
          </div>
        </section>
      )}

      {/* Applications Section */}
      <section>
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Mina Ansökningar</h1>
          <p className="text-sm text-white">Dina inskickade jobbansökningar</p>
        </div>

        {!applications || applications.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8 text-center">
              <Briefcase className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Inga ansökningar än</h3>
              <p className="text-white mb-4">
                När du söker jobb kommer dina ansökningar att visas här
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => {
              const job = application.job_postings;
              if (!job) return null;

              const company = job.profiles;
              const location = job.workplace_city || job.location || '';

              const timeInfo = getTimeRemaining(job.created_at, job.expires_at);
              const isExpiredOrDeleted = !!(job.deleted_at || timeInfo.isExpired);

              const companyName = company?.company_name || 'Okänt företag';

              // Build status badge
              const statusBadgeEl = (
                <Badge className={`text-[11px] px-2 py-0.5 flex items-center gap-1 ${getStatusBadgeClasses(application.status, isExpiredOrDeleted)}`}>
                  {getStatusIcon(application.status, isExpiredOrDeleted)}
                  {getStatusLabel(application.status, isExpiredOrDeleted)}
                </Badge>
              );

              return (
                <ReadOnlyMobileJobCard
                  key={application.id}
                  job={{
                    id: job.id,
                    title: job.title,
                    location,
                    employment_type: job.employment_type || undefined,
                    is_active: job.is_active ?? true,
                    views_count: job.views_count ?? 0,
                    applications_count: job.applications_count ?? 0,
                    created_at: job.created_at,
                    expires_at: job.expires_at || undefined,
                    job_image_url: job.job_image_url || undefined,
                    company_name: companyName,
                    positions_count: job.positions_count || undefined,
                  }}
                  onDeleteClick={handleDeleteClick}
                  statusBadge={statusBadgeEl}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!applicationToRemove} onOpenChange={(open) => { if (!open) setApplicationToRemove(null); }}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort ansökan
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {applicationToRemove && (
                <>
                  Är du säker på att du vill ta bort din ansökan för <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">"{applicationToRemove.title}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRemoveApplication();
              }}
              variant="destructiveSoft"
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </div>
  );
};

export default MyApplications;
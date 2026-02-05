import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useMyApplicationsCache } from '@/hooks/useMyApplicationsCache';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  MapPin, 
  Calendar, 
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  Building2,
  Loader2,
  Timer,
  Users,
  Video,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { getTimeRemaining, formatDateShortSv } from '@/lib/date';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import CandidateInterviewCard from '@/components/CandidateInterviewCard';
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
    profiles: {
      company_name: string | null;
      company_logo_url: string | null;
    } | null;
  } | null;
}

const getStatusLabel = (status: string, isExpiredOrDeleted: boolean) => {
  if (isExpiredOrDeleted) {
    return 'Avslutad';
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
    return <Clock className="h-3.5 w-3.5" />;
  }
  switch (status) {
    case 'pending':
    case 'reviewed':
    case 'offered':
      return <Hourglass className="h-3.5 w-3.5" />;
    case 'hired':
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'rejected':
      return <XCircle className="h-3.5 w-3.5" />;
    case 'interview':
      return <Calendar className="h-3.5 w-3.5" />;
    default:
      return <Hourglass className="h-3.5 w-3.5" />;
  }
};

const getStatusColor = (status: string, isExpiredOrDeleted: boolean) => {
  if (isExpiredOrDeleted) {
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30 hover:bg-gray-500/30 transition-colors';
  }
  switch (status) {
    case 'pending':
    case 'reviewed':
    case 'offered':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 transition-colors';
    case 'hired':
      return 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30 transition-colors';
    case 'rejected':
      return 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 transition-colors';
    case 'interview':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30 transition-colors';
    default:
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 transition-colors';
  }
};


const MyApplications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [applicationToRemove, setApplicationToRemove] = useState<{ id: string; title: string } | null>(null);
  
  // Get candidate's interviews
  const { interviews, isLoading: interviewsLoading } = useCandidateInterviews();

  // Use cached applications hook for instant load + realtime sync
  const { applications, isLoading, error, deleteApplication } = useMyApplicationsCache();

  const handleApplicationClick = (application: Application) => {
    if (application.job_postings?.id) {
      navigate(`/job-view/${application.job_postings.id}`);
    }
  };

  const handleRemoveClick = (applicationId: string, jobTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setApplicationToRemove({ id: applicationId, title: jobTitle });
  };

  const confirmRemoveApplication = async () => {
    if (!applicationToRemove) return;
    
    const applicationId = applicationToRemove.id;
    setApplicationToRemove(null);
    setRemovingIds(prev => new Set(prev).add(applicationId));
    
    try {
      await deleteApplication(applicationId);
      
      // Invalidate the count query
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
      
      toast.success('Ansökan borttagen');
    } catch (err) {
      console.error('Error removing application:', err);
      toast.error('Kunde inte ta bort ansökan');
    } finally {
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
       <div className="responsive-container animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Mina Ansökningar</h1>
          <p className="text-sm text-white">Dina inskickade jobbansökningar</p>
        </div>
        
        {/* Skeleton cards */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Skeleton className="h-6 w-3/4 bg-white/10 mb-3" />
                    <Skeleton className="h-4 w-1/2 bg-white/10 mb-3" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-24 bg-white/10" />
                      <Skeleton className="h-4 w-20 bg-white/10" />
                      <Skeleton className="h-4 w-28 bg-white/10" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-28 bg-white/10 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
       <div className="responsive-container animate-fade-in">
        <div className="text-center py-12 text-red-400">
          Något gick fel vid hämtning av ansökningar
        </div>
      </div>
    );
  }

  return (
     <div className="responsive-container animate-fade-in space-y-8">
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
        <div className="text-center mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Mina Ansökningar</h1>
        </div>

        {!applications || applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white/5 border border-white/10 rounded-lg">
            <Briefcase className="h-12 w-12 text-white mb-4" />
            <p className="text-white text-center mb-2">Inga ansökningar än</p>
            <p className="text-white text-sm text-center">
              När du söker jobb kommer dina ansökningar att visas här
            </p>
          </div>
        ) : (
          <div className="space-y-4">
          {applications.map((application) => {
            const job = application.job_postings;
            const company = job?.profiles;
            const location = job?.workplace_city 
              ? `${job.workplace_city}${job.workplace_county ? `, ${job.workplace_county}` : ''}`
              : job?.location;
            
            // Check if job is expired or deleted
            const timeInfo = job ? getTimeRemaining(job.created_at, job.expires_at) : { isExpired: false, text: '' };
            const isExpiredOrDeleted = !!(job?.deleted_at || timeInfo.isExpired);
            const isRemoving = removingIds.has(application.id);

            return (
              <Card 
                key={application.id}
                onClick={() => handleApplicationClick(application)}
                className={`bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer group ${
                  isRemoving ? 'opacity-50' : ''
                }`}
              >
                <CardContent className="p-4 min-h-[120px]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Job Title */}
                      <h3 className="text-lg font-semibold text-white truncate group-hover:text-white transition-colors">
                        {job?.title || 'Okänt jobb'}
                      </h3>

                      {/* Company */}
                      <div className="flex items-center gap-2 mt-1 text-white">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {company?.company_name || 'Okänt företag'}
                        </span>
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-white">
                        {location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{location}</span>
                          </div>
                        )}
                        {job?.employment_type && (
                          <div className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDateShortSv(application.applied_at || application.created_at)}</span>
                        </div>
                        {/* Antal sökande badge */}
                        {job && (
                          <Badge variant="glass" className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-brightness-110">
                            <Users className="h-3 w-3 mr-1" />
                            {job.applications_count ?? 0} sökande
                          </Badge>
                        )}
                        {/* Days remaining badge - only show if not deleted and not expired */}
                        {job && !job.deleted_at && !timeInfo.isExpired && (
                          <Badge variant="glass" className="text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-brightness-110">
                            <Timer className="h-3 w-3 mr-1" />
                            {timeInfo.text} kvar
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Status Badge and Delete Button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Only show status badge if NOT expired or deleted */}
                      {!isExpiredOrDeleted && (
                        <Badge 
                          variant="glass"
                          className={`flex items-center gap-1.5 px-2.5 py-1 border whitespace-nowrap transition-all duration-300 group-hover:backdrop-brightness-90 hover:backdrop-brightness-110 ${getStatusColor(application.status, isExpiredOrDeleted)}`}
                        >
                          {getStatusIcon(application.status, isExpiredOrDeleted)}
                          {getStatusLabel(application.status, isExpiredOrDeleted)}
                        </Badge>
                      )}
                      
                      {/* For expired jobs (not deleted), show Utgången badge */}
                      {!job?.deleted_at && timeInfo.isExpired && (
                        <Badge variant="glass" className="bg-red-500/20 text-white border-red-500/30 text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/30 hover:border-red-500/50 hover:backdrop-brightness-110">
                          Utgången
                        </Badge>
                      )}
                      
                      {/* For deleted jobs, show Borttagen badge */}
                      {job?.deleted_at && (
                        <Badge variant="glass" className="bg-gray-500/20 text-white border-gray-500/30 text-xs px-2.5 py-1 transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-gray-500/30 hover:border-gray-500/50 hover:backdrop-brightness-110">
                          Borttagen
                        </Badge>
                      )}
                      
                      {/* Delete button - only show for expired or deleted jobs */}
                      {isExpiredOrDeleted && (
                        <button
                          onClick={(e) => handleRemoveClick(application.id, job?.title || 'Okänt jobb', e)}
                          disabled={isRemoving}
                          className="inline-flex items-center justify-center rounded-full border h-8 w-8 bg-white/5 backdrop-blur-[2px] border-white/20 text-white transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 hover:backdrop-brightness-110 disabled:opacity-50 flex-shrink-0 active:scale-95"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
        )}
      </section>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!applicationToRemove} onOpenChange={() => setApplicationToRemove(null)}>
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
              onClick={() => setApplicationToRemove(null)}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveApplication}
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

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Video
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { getTimeRemaining } from '@/lib/date';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import CandidateInterviewCard from '@/components/CandidateInterviewCard';

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
    applications_count: number | null;
    profiles: {
      company_name: string | null;
      company_logo_url: string | null;
    } | null;
  } | null;
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Under granskning';
    case 'reviewed':
      return 'Granskad';
    case 'hired':
      return 'Anställd';
    case 'rejected':
      return 'Nekad';
    case 'interview':
      return 'Intervju';
    default:
      return status;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Hourglass className="h-3.5 w-3.5" />;
    case 'reviewed':
      return <Clock className="h-3.5 w-3.5" />;
    case 'hired':
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'rejected':
      return <XCircle className="h-3.5 w-3.5" />;
    case 'interview':
      return <Calendar className="h-3.5 w-3.5" />;
    default:
      return <Clock className="h-3.5 w-3.5" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 transition-colors';
    case 'reviewed':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30 transition-colors';
    case 'hired':
      return 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30 transition-colors';
    case 'rejected':
      return 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 transition-colors';
    case 'interview':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30 transition-colors';
    default:
      return 'bg-white/20 text-white border-white/30 hover:bg-white/30 transition-colors';
  }
};


const MyApplications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Get candidate's interviews
  const { interviews, isLoading: interviewsLoading } = useCandidateInterviews();

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ['my-applications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          job_id,
          status,
          applied_at,
          created_at,
          job_postings (
            id,
            title,
            location,
            employment_type,
            workplace_city,
            workplace_county,
            is_active,
            created_at,
            expires_at,
            applications_count,
            profiles:employer_id (
              company_name,
              company_logo_url
            )
          )
        `)
        .eq('applicant_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Application[];
    },
    enabled: !!user,
  });

  // Real-time prenumeration för applications_count uppdateringar
  useEffect(() => {
    const channel = supabase
      .channel('my-applications-count')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_postings'
        },
        (payload) => {
          // Uppdatera cache med nya applications_count
          queryClient.setQueryData(['my-applications', user?.id], (oldData: Application[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(application => {
              if (application.job_postings && application.job_postings.id === payload.new.id) {
                return {
                  ...application,
                  job_postings: {
                    ...application.job_postings,
                    applications_count: payload.new.applications_count
                  }
                };
              }
              return application;
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const handleApplicationClick = (application: Application) => {
    if (application.job_postings?.id) {
      navigate(`/job-view/${application.job_postings.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-3 md:px-6 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Mina Ansökningar</h1>
          <p className="text-sm text-white">Dina inskickade jobbansökningar</p>
        </div>
        
        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
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
      <div className="max-w-4xl mx-auto px-3 md:px-6 animate-fade-in">
        <div className="text-center py-12 text-red-400">
          Något gick fel vid hämtning av ansökningar
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 animate-fade-in space-y-8">
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
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Mina Ansökningar</h1>
          <p className="text-sm text-white">Dina inskickade jobbansökningar</p>
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

            return (
              <Card 
                key={application.id}
                onClick={() => handleApplicationClick(application)}
                className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer group"
              >
                <CardContent className="p-4">
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
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-white">
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
                          <span>
                            Sökt {format(new Date(application.applied_at || application.created_at), 'yyyy-MM-dd', { locale: sv })}
                          </span>
                        </div>
                        {/* Antal sökande badge */}
                        {job && (
                          <Badge variant="glass" className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-brightness-110">
                            <Users className="h-3 w-3 mr-1" />
                            {job.applications_count ?? 0} sökande
                          </Badge>
                        )}
                        {/* Days remaining badge */}
                        {job && (() => {
                          const { text, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
                          if (isExpired) {
                            return (
                              <Badge variant="glass" className="bg-red-500/20 text-white border-red-500/30 text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/30 hover:border-red-500/50 hover:backdrop-brightness-110">
                                Utgången
                              </Badge>
                            );
                          }
                          return (
                            <Badge variant="glass" className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-brightness-110">
                              <Timer className="h-3 w-3 mr-1" />
                              {text} kvar
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <Badge 
                      variant="glass"
                      className={`flex items-center gap-1.5 px-2.5 py-1 border whitespace-nowrap transition-all duration-300 group-hover:backdrop-brightness-90 hover:backdrop-brightness-110 ${getStatusColor(application.status)}`}
                    >
                      {getStatusIcon(application.status)}
                      {getStatusLabel(application.status)}
                    </Badge>
                  </div>

                  {/* Job inactive warning */}
                  {job && !job.is_active && (
                    <div className="mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-amber-300 text-sm">
                        Denna annons är inte längre aktiv
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        )}
      </section>
    </div>
  );
};

export default MyApplications;

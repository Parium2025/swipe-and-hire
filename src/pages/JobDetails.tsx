import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { 
  Clock, 
  MapPin, 
  Mail, 
  Phone, 
  FileText,
  MoreVertical,
  CheckCircle,
  X,
  Users,
  Eye,
  Play
} from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EmployerLayout from '@/components/EmployerLayout';

interface JobApplication {
  id: string;
  applicant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  age: number;
  location: string;
  bio: string;
  cv_url: string;
  employment_status: string;
  availability: string;
  applied_at: string;
  status: 'pending' | 'reviewing' | 'interview' | 'offered' | 'hired' | 'rejected';
  custom_answers: any;
  viewed_at: string | null;
  // Profile media from RPC
  profile_image_url: string | null;
  video_url: string | null;
  is_profile_video: boolean;
}

interface JobPosting {
  id: string;
  title: string;
  location: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
}

const JobDetails = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId || !user) return;
    fetchJobData();
  }, [jobId, user]);

  const fetchJobData = async () => {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('job_postings')
        .select('*')
        .eq('id', jobId)
        .eq('employer_id', user?.id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch applications
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('job_applications')
        .select('*')
        .eq('job_id', jobId)
        .order('applied_at', { ascending: false });

      if (applicationsError) throw applicationsError;
      
      // Fetch profile media for each applicant using RPC
      const applicationsWithMedia = await Promise.all(
        (applicationsData || []).map(async (app) => {
          const { data: mediaData } = await supabase.rpc('get_applicant_profile_media', {
            p_applicant_id: app.applicant_id,
            p_employer_id: user?.id
          });
          
          const media = (mediaData?.[0] || {}) as {
            profile_image_url?: string;
            video_url?: string;
            is_profile_video?: boolean;
          };
          return {
            ...app,
            profile_image_url: media.profile_image_url || null,
            video_url: media.video_url || null,
            is_profile_video: media.is_profile_video || false,
          };
        })
      );
      
      setApplications(applicationsWithMedia as JobApplication[]);
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) throw error;

      toast({
        title: 'Status uppdaterad',
        description: 'Ansökningsstatus har uppdaterats.',
      });

      fetchJobData();
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'reviewing':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'interview':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'offered':
        return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'hired':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'rejected':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      default:
        return 'bg-white/10 text-white border-white/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Inkorg';
      case 'reviewing': return 'Granskar';
      case 'interview': return 'Intervju';
      case 'offered': return 'Erbjuden';
      case 'hired': return 'Anställd';
      case 'rejected': return 'Avvisad';
      default: return status;
    }
  };

  const filterApplicationsByStatus = (status: string) => {
    return applications.filter(app => app.status === status);
  };

  const markApplicationAsViewed = async (applicationId: string) => {
    try {
      await supabase
        .from('job_applications')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', applicationId)
        .is('viewed_at', null);
      
      // Update local state
      setApplications(prev => prev.map(app => 
        app.id === applicationId ? { ...app, viewed_at: new Date().toISOString() } : app
      ));
    } catch (error) {
      console.error('Error marking as viewed:', error);
    }
  };

  // Wrapper component for CandidateAvatar with inline video playback
  const SmallCandidateAvatarWrapper = ({ application }: { application: JobApplication }) => {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const hasVideo = application.is_profile_video && application.video_url;
    
    return (
      <div 
        className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 relative [&>*:first-child]:h-7 [&>*:first-child]:w-7 md:[&>*:first-child]:h-8 md:[&>*:first-child]:w-8 [&_.h-10]:h-7 [&_.w-10]:w-7 md:[&_.h-10]:h-8 md:[&_.w-10]:w-8 [&_.ring-2]:ring-1"
        onClick={hasVideo ? (e) => {
          // Prevent opening profile dialog when clicking on video - let ProfileVideo handle playback
          e.stopPropagation();
        } : undefined}
      >
        <CandidateAvatar
          profileImageUrl={application.profile_image_url}
          videoUrl={application.video_url}
          isProfileVideo={application.is_profile_video}
          firstName={application.first_name}
          lastName={application.last_name}
          onPlayingChange={setIsVideoPlaying}
        />
        {/* Large play overlay for video avatars - hidden when video is playing */}
        {hasVideo && !isVideoPlaying && (
          <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center pointer-events-none">
            <Play className="h-3 w-3 md:h-4 md:w-4 text-white drop-shadow-lg fill-white" />
          </div>
        )}
      </div>
    );
  };

  const ApplicationCard = ({ application }: { application: JobApplication }) => {
    const isUnread = !application.viewed_at;
    
    const handleClick = () => {
      if (isUnread) {
        markApplicationAsViewed(application.id);
      }
      // Here you could open a profile dialog
    };
    
    return (
      <Card 
        className="bg-white/5 backdrop-blur-sm border-white/20 mb-2 cursor-pointer hover:bg-white/10 transition-colors"
        onClick={handleClick}
      >
        <CardContent className="p-2 md:p-3">
          <div className="flex items-start gap-2 md:gap-3 relative">
            {/* Unread indicator */}
            {isUnread && (
              <div className="absolute right-0 top-0">
                <div className="h-2 w-2 rounded-full bg-fuchsia-500" />
              </div>
            )}
            <SmallCandidateAvatarWrapper application={application} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5 md:mb-1">
                <h4 className="text-white font-semibold text-xs md:text-sm truncate">
                  {application.first_name} {application.last_name}
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 md:h-8 md:w-8 p-0 text-white hover:bg-white/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md shadow-lg">
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); updateApplicationStatus(application.id, 'reviewing'); }}
                      className="text-white hover:bg-white/10"
                    >
                      Flytta till Granskar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); updateApplicationStatus(application.id, 'interview'); }}
                      className="text-white hover:bg-white/10"
                    >
                      Flytta till Intervju
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); updateApplicationStatus(application.id, 'offered'); }}
                      className="text-white hover:bg-white/10"
                    >
                      Flytta till Erbjuden
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); updateApplicationStatus(application.id, 'hired'); }}
                      className="text-white hover:bg-white/10"
                    >
                      Flytta till Anställd
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); updateApplicationStatus(application.id, 'rejected'); }}
                      className="text-red-300 hover:bg-red-500/10"
                    >
                      Avvisa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-0.5 md:space-y-1 text-xs md:text-sm text-white">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(application.applied_at).toLocaleDateString('sv-SE')}</span>
                </div>
                {application.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{application.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return null; // Return nothing while loading for smooth fade-in
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Jobbet hittades inte</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12 py-4 pb-safe min-h-screen animate-fade-in">
        {/* Job Title and Stats */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3 md:p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <TruncatedText 
                text={job.title}
                className="text-xl font-bold text-white mb-2 two-line-ellipsis block"
              />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-white">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </div>
                <Badge
                  className={`text-sm whitespace-nowrap cursor-pointer transition-colors ${
                    job.is_active
                      ? "bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30"
                      : "bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30"
                  }`}
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('job_postings')
                        .update({ is_active: !job.is_active })
                        .eq('id', jobId);

                      if (error) throw error;

                      toast({
                        title: job.is_active ? 'Jobb inaktiverat' : 'Jobb aktiverat',
                        description: job.is_active ? 'Jobbet är nu inaktivt.' : 'Jobbet är nu aktivt.',
                      });

                      fetchJobData();
                    } catch (error: any) {
                      toast({
                        title: 'Fel',
                        description: error.message,
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  {job.is_active ? 'Aktiv' : 'Inaktiv'}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-white h-8 w-8 p-0 hover:bg-transparent focus-visible:ring-0 focus:outline-none"
            >
              <X className="h-7 w-7" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="bg-white/5 rounded-lg p-2 md:p-3">
              <div className="flex items-center gap-1 md:gap-2 text-white text-xs md:text-sm mb-1">
                <Eye className="h-3 w-3 md:h-4 md:w-4" />
                Visningar
              </div>
              <div className="text-lg md:text-xl font-bold text-white">{job.views_count}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 md:p-3">
              <div className="flex items-center gap-1 md:gap-2 text-white text-xs md:text-sm mb-1">
                <Users className="h-3 w-3 md:h-4 md:w-4" />
                Ansökningar
              </div>
              <div className="text-lg md:text-xl font-bold text-white">{job.applications_count}</div>
            </div>
          </div>
        </div>

        {/* Kanban View */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          {/* Inkorg */}
          <div className="bg-white/5 rounded-lg p-2 md:p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Inkorg</h3>
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40">
                {filterApplicationsByStatus('pending').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('pending').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>

          {/* Granskar */}
          <div className="bg-white/5 rounded-lg p-2 md:p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Granskar</h3>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/40">
                {filterApplicationsByStatus('reviewing').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('reviewing').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>

          {/* Intervju */}
          <div className="bg-white/5 rounded-lg p-2 md:p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Intervju</h3>
              <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/40">
                {filterApplicationsByStatus('interview').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('interview').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>

          {/* Erbjuden */}
          <div className="bg-white/5 rounded-lg p-2 md:p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Erbjuden</h3>
              <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/40">
                {filterApplicationsByStatus('offered').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('offered').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>

          {/* Anställd */}
          <div className="bg-white/5 rounded-lg p-2 md:p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Anställd</h3>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                {filterApplicationsByStatus('hired').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('hired').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>
        </div>
      </div>
  );
};

export default JobDetails;

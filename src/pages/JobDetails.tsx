import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { 
  Clock, 
  X,
  Users,
  Eye,
  Play,
  Star,
  ArrowDown,
  Trash2,
  Phone as PhoneIcon,
  Calendar,
  Gift,
  PartyPopper,
  Inbox,
  MapPin
} from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, differenceInHours } from 'date-fns';
import EmployerLayout from '@/components/EmployerLayout';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';

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
  profile_image_url: string | null;
  video_url: string | null;
  is_profile_video: boolean;
  rating: number;
}

// Format time in compact way like MyCandidates
const formatCompactTime = (date: string | null) => {
  if (!date) return null;
  const now = new Date();
  const d = new Date(date);
  const days = differenceInDays(now, d);
  const hours = differenceInHours(now, d);
  
  if (days >= 1) {
    return `${days}dag`;
  }
  return `${hours}tim`;
};

const STATUS_ICONS = {
  pending: Inbox,
  reviewing: Eye,
  interview: Calendar,
  offered: Gift,
  hired: PartyPopper,
};

// Star rating component - read-only for cards
const StarRating = ({ rating = 0, maxStars = 5 }: { rating?: number; maxStars?: number }) => {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxStars }).map((_, i) => (
        <Star 
          key={i}
          className={`h-2.5 w-2.5 ${
            i < rating 
              ? 'text-yellow-400 fill-yellow-400' 
              : 'text-white/30'
          }`}
        />
      ))}
    </div>
  );
};

interface JobPosting {
  id: string;
  title: string;
  location: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
}

type ApplicationStatus = 'pending' | 'reviewing' | 'interview' | 'offered' | 'hired' | 'rejected';

const STATUS_ORDER: ApplicationStatus[] = ['pending', 'reviewing', 'interview', 'offered', 'hired'];

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string }> = {
  pending: { label: 'Inkorg', color: 'bg-yellow-500/20 ring-1 ring-inset ring-yellow-500/50 text-yellow-300' },
  reviewing: { label: 'Granskar', color: 'bg-blue-500/20 ring-1 ring-inset ring-blue-500/50 text-blue-300' },
  interview: { label: 'Intervju', color: 'bg-purple-500/20 ring-1 ring-inset ring-purple-500/50 text-purple-300' },
  offered: { label: 'Erbjuden', color: 'bg-green-500/20 ring-1 ring-inset ring-green-500/50 text-green-300' },
  hired: { label: 'Anställd', color: 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-500/50 text-emerald-300' },
  rejected: { label: 'Avvisad', color: 'bg-red-500/20 ring-1 ring-inset ring-red-500/50 text-red-300' },
};

const JobDetails = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [myCandidatesMap, setMyCandidatesMap] = useState<Map<string, string>>(new Map()); // applicant_id -> my_candidate_id

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const collisionDetectionStrategy = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCorners(args);
  }, []);

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
      
      // Fetch my_candidates ratings and IDs for this recruiter
      const { data: myCandidatesData } = await supabase
        .from('my_candidates')
        .select('id, applicant_id, rating')
        .eq('recruiter_id', user?.id);
      
      const ratingsByApplicant = new Map<string, number>();
      const candidateIdsMap = new Map<string, string>();
      (myCandidatesData || []).forEach(mc => {
        ratingsByApplicant.set(mc.applicant_id, mc.rating || 0);
        candidateIdsMap.set(mc.applicant_id, mc.id);
      });
      setMyCandidatesMap(candidateIdsMap);

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
            rating: ratingsByApplicant.get(app.applicant_id) || 0,
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
    // Optimistic update - move card immediately
    const previousApplications = [...applications];
    setApplications(prev => prev.map(app => 
      app.id === applicationId 
        ? { ...app, status: newStatus as JobApplication['status'] } 
        : app
    ));

    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) {
        // Revert on error
        setApplications(previousApplications);
        throw error;
      }
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateCandidateRating = async (applicantId: string, newRating: number) => {
    const myCandidateId = myCandidatesMap.get(applicantId);
    if (!myCandidateId) {
      toast({ title: 'Info', description: 'Lägg först till kandidaten i din lista för att ge betyg' });
      return;
    }
    setApplications(prev => prev.map(app => app.applicant_id === applicantId ? { ...app, rating: newRating } : app));
    if (selectedApplication?.applicant_id === applicantId) {
      setSelectedApplication(prev => prev ? { ...prev, rating: newRating } : null);
    }
    try {
      const { error } = await supabase.from('my_candidates').update({ rating: newRating }).eq('id', myCandidateId);
      if (error) throw error;
    } catch {
      toast({ title: 'Fel', description: 'Kunde inte uppdatera betyg', variant: 'destructive' });
      fetchJobData();
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

  const ApplicationCardContent = ({ application, isDragging, onOpenProfile }: { application: JobApplication; isDragging?: boolean; onOpenProfile?: () => void }) => {
    const isUnread = !application.viewed_at;
    const appliedTime = formatCompactTime(application.applied_at);
    
    const handleClick = () => {
      if (isUnread) {
        markApplicationAsViewed(application.id);
      }
      onOpenProfile?.();
    };
    
    return (
      <div 
        className={`bg-white/5 ring-1 ring-inset ring-white/10 rounded-md px-2 py-1.5 transition-all cursor-grab active:cursor-grabbing group relative ${
          isDragging ? 'ring-2 ring-inset ring-primary/50 bg-white/10' : 'hover:ring-white/30 hover:bg-white/[0.08]'
        }`}
        onClick={handleClick}
      >
        {/* Unread indicator dot */}
        {isUnread && (
          <div className="absolute right-1.5 top-1.5">
            <div className="h-2 w-2 rounded-full bg-fuchsia-500" />
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <SmallCandidateAvatarWrapper application={application} />
          
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-fuchsia-400 font-medium text-xs truncate hover:underline">
              {application.first_name} {application.last_name}
            </p>
            <StarRating rating={application.rating} />
            {appliedTime && (
              <div className="flex items-center gap-1.5 mt-0.5 text-white/70 text-[10px]">
                <span className="flex items-center gap-0.5">
                  <ArrowDown className="h-2.5 w-2.5" />
                  {appliedTime}
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {appliedTime}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Sortable wrapper for application cards
  const SortableApplicationCard = ({ application, onOpenProfile }: { application: JobApplication; onOpenProfile: () => void }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: application.id });

    const style = {
      transform: transform ? CSS.Transform.toString(transform) : undefined,
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <ApplicationCardContent application={application} isDragging={isDragging} onOpenProfile={onOpenProfile} />
      </div>
    );
  };

  // Droppable status column - matching MyCandidates style
  const StatusColumn = ({ status, isOver }: { status: ApplicationStatus; isOver?: boolean }) => {
    const config = STATUS_CONFIG[status];
    const apps = filterApplicationsByStatus(status);
    const Icon = STATUS_ICONS[status] || Inbox;
    
    const { setNodeRef } = useDroppable({
      id: status,
    });

    return (
      <div 
        ref={setNodeRef}
        className={`flex-1 min-w-[220px] max-w-[280px] transition-all ${isOver ? 'scale-[1.02]' : ''}`}
      >
        <div className={`rounded-md ${config.color} px-2 py-1.5 mb-2 transition-all ${isOver ? 'ring-2 ring-inset ring-primary' : ''}`}>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" />
            <span className="font-medium text-xs">{config.label}</span>
            <span className="ml-auto bg-white/20 text-white/90 text-[10px] px-1.5 py-0.5 rounded-full">
              {apps.length}
            </span>
          </div>
        </div>

        <div 
          className={`space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto p-1 pr-2 min-h-[100px] rounded-lg transition-colors ${
            isOver ? 'bg-white/10' : ''
          }`}
        >
          <SortableContext items={apps.map(a => a.id)} strategy={verticalListSortingStrategy}>
            {apps.map((app) => (
              <SortableApplicationCard 
                key={app.id} 
                application={app} 
                onOpenProfile={() => {
                  setSelectedApplication(app);
                  setDialogOpen(true);
                }}
              />
            ))}
          </SortableContext>

          {isOver && apps.length > 0 && (
            <div className="text-center py-2 text-xs text-white font-medium">
              Släpp här
            </div>
          )}

          {apps.length === 0 && (
            <div className={`text-center py-8 text-xs transition-all ${isOver ? 'text-white font-medium' : 'text-white/60'}`}>
              {isOver ? 'Släpp här' : 'Inga kandidater i detta steg'}
            </div>
          )}
        </div>
      </div>
    );
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const resolveOverStatus = (overRawId?: string): ApplicationStatus | null => {
    if (!overRawId) return null;

    if (STATUS_ORDER.includes(overRawId as ApplicationStatus)) {
      return overRawId as ApplicationStatus;
    }

    const overApp = applications.find((a) => a.id === overRawId);
    if (overApp && STATUS_ORDER.includes(overApp.status as ApplicationStatus)) {
      return overApp.status as ApplicationStatus;
    }

    return null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overRawId = event.over?.id as string | undefined;
    const status = resolveOverStatus(overRawId);
    setOverId(status);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const applicationId = active.id as string;
    const overRawId = over.id as string;
    const targetStatus = resolveOverStatus(overRawId);

    if (!targetStatus) return;

    const application = applications.find((a) => a.id === applicationId);
    if (application && application.status !== targetStatus) {
      updateApplicationStatus(applicationId, targetStatus);
    }
  };

  const activeApplication = activeId ? applications.find(a => a.id === activeId) : null;

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

        {/* Kanban View with Drag and Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2">
            {STATUS_ORDER.map((status) => (
              <StatusColumn 
                key={status} 
                status={status} 
                isOver={overId === status}
              />
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay modifiers={[snapCenterToCursor]}>
            {activeApplication ? (
              <div className="opacity-90">
                <ApplicationCardContent application={activeApplication} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Candidate Profile Dialog */}
        <CandidateProfileDialog
          application={selectedApplication ? {
            id: selectedApplication.id,
            job_id: jobId || '',
            applicant_id: selectedApplication.applicant_id,
            first_name: selectedApplication.first_name,
            last_name: selectedApplication.last_name,
            email: selectedApplication.email,
            phone: selectedApplication.phone,
            location: selectedApplication.location,
            bio: selectedApplication.bio,
            cv_url: selectedApplication.cv_url,
            age: selectedApplication.age,
            employment_status: selectedApplication.employment_status,
            work_schedule: null,
            availability: selectedApplication.availability,
            custom_answers: selectedApplication.custom_answers,
            status: selectedApplication.status,
            applied_at: selectedApplication.applied_at,
            updated_at: selectedApplication.applied_at,
            job_title: job?.title || 'Okänt jobb',
            profile_image_url: selectedApplication.profile_image_url,
            video_url: selectedApplication.video_url,
            is_profile_video: selectedApplication.is_profile_video,
          } as ApplicationData : null}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setTimeout(() => setSelectedApplication(null), 300);
            }
          }}
          onStatusUpdate={() => {
            fetchJobData();
          }}
          candidateRating={selectedApplication?.rating}
          onRatingChange={(rating) => {
            if (selectedApplication) {
              updateCandidateRating(selectedApplication.applicant_id, rating);
            }
          }}
        />
      </div>
  );
};

export default JobDetails;

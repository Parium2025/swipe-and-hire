import { useState, useMemo, useEffect, useCallback } from 'react';
import { STAGE_CONFIG, CandidateStage, MyCandidateData } from '@/hooks/useMyCandidatesData';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  Trash2, 
  Phone, 
  Calendar, 
  UserCheck,
  Gift,
  PartyPopper,
  Search,
  X,
  Star,
  ArrowDown,
  Clock,
  Play
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow, differenceInDays, differenceInHours } from 'date-fns';
import { sv } from 'date-fns/locale';
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
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';

const STAGE_ICONS = {
  to_contact: Phone,
  interview: Calendar,
  offer: Gift,
  hired: PartyPopper,
};

const STAGE_ORDER: CandidateStage[] = ['to_contact', 'interview', 'offer', 'hired'];

interface CandidateCardProps {
  candidate: MyCandidateData;
  onRemove: () => void;
  onOpenProfile: () => void;
  isDragging?: boolean;
}

// Format time in compact way like Teamtailor
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

// Star rating component - read-only for cards
const StarRating = ({ 
  rating = 0, 
  maxStars = 5, 
}: { 
  rating?: number; 
  maxStars?: number; 
}) => {
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

// Wrapper component for CandidateAvatar with inline video playback
const SmallCandidateAvatar = ({ candidate }: { candidate: MyCandidateData }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const hasVideo = candidate.is_profile_video && candidate.video_url;
  
  return (
    <div 
      className="h-8 w-8 flex-shrink-0 relative [&>*:first-child]:h-8 [&>*:first-child]:w-8 [&_.h-10]:h-8 [&_.w-10]:w-8 [&_.ring-2]:ring-1"
      onClick={hasVideo ? (e) => {
        // Prevent opening profile dialog when clicking on video - let ProfileVideo handle playback
        e.stopPropagation();
      } : undefined}
    >
      <CandidateAvatar
        profileImageUrl={candidate.profile_image_url}
        videoUrl={candidate.video_url}
        isProfileVideo={candidate.is_profile_video}
        firstName={candidate.first_name}
        lastName={candidate.last_name}
        onPlayingChange={setIsVideoPlaying}
      />
      {/* Large play overlay for video avatars - hidden when video is playing */}
      {hasVideo && !isVideoPlaying && (
        <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center pointer-events-none">
          <Play className="h-4 w-4 text-white drop-shadow-lg fill-white" />
        </div>
      )}
    </div>
  );
};

const CandidateCardContent = ({ 
  candidate, 
  onRemove, 
  onOpenProfile,
  isDragging,
}: CandidateCardProps) => {
  const initials = `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase() || '?';
  const isUnread = !candidate.viewed_at;
  const appliedTime = formatCompactTime(candidate.applied_at);
  
  return (
    <div 
      className={`bg-white/5 ring-1 ring-inset ring-white/10 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing group relative
        transition-all duration-200 ease-out
        ${isDragging 
          ? 'ring-2 ring-inset ring-primary/50 bg-white/10 scale-[1.02] shadow-lg shadow-primary/20' 
          : 'hover:ring-white/30 hover:bg-white/[0.08] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20'
        }`}
      onClick={onOpenProfile}
    >
      {/* Unread indicator dot - shows if application hasn't been viewed */}
      {isUnread && (
        <div className="absolute right-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <SmallCandidateAvatar candidate={candidate} />
        
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-fuchsia-400 font-medium text-xs truncate group-hover:text-fuchsia-300 transition-colors">
            {candidate.first_name} {candidate.last_name}
          </p>
          <StarRating rating={candidate.rating} />
          {appliedTime && (
            <div className="flex items-center gap-1.5 mt-0.5 text-white/70 text-[10px] group-hover:text-white/80 transition-colors">
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

      {/* Remove button - shows on hover with smooth animation */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute right-1 bottom-1 h-5 w-5 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded 
          opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
};

// Sortable wrapper for the card - entire card is draggable
const SortableCandidateCard = (props: CandidateCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.candidate.id });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? undefined : transition, // No transition while dragging to avoid flicker
    opacity: isDragging ? 0 : 1, // Fully hide while dragging (DragOverlay shows the visual)
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateCardContent 
        {...props} 
        isDragging={isDragging}
      />
    </div>
  );
};

interface StageColumnProps {
  stage: CandidateStage;
  candidates: MyCandidateData[];
  onMoveCandidate: (id: string, stage: CandidateStage) => void;
  onRemoveCandidate: (candidate: MyCandidateData) => void;
  onOpenProfile: (candidate: MyCandidateData) => void;
  isOver?: boolean;
}

const StageColumn = ({ stage, candidates, onMoveCandidate, onRemoveCandidate, onOpenProfile, isOver }: StageColumnProps) => {
  const config = STAGE_CONFIG[stage];
  const Icon = STAGE_ICONS[stage];

  const { setNodeRef } = useDroppable({
    id: stage,
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
            {candidates.length}
          </span>
        </div>
      </div>

      <div 
        className={`relative space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto p-1 pr-2 min-h-[100px] rounded-lg transition-colors ${
          isOver ? 'bg-white/10' : ''
        }`}
      >
        <SortableContext items={candidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {candidates.map(candidate => (
            <SortableCandidateCard
              key={candidate.id}
              candidate={candidate}
              onRemove={() => onRemoveCandidate(candidate)}
              onOpenProfile={() => onOpenProfile(candidate)}
            />
          ))}
        </SortableContext>

        {candidates.length === 0 && !isOver && (
          <div className="text-center py-8 text-xs text-white">
            Inga kandidater i detta steg
          </div>
        )}

        {/* Drop indicator (always centered, regardless of list length) */}
        {isOver && (
          <div className="pointer-events-none absolute inset-1 flex items-center justify-center">
            <div className="rounded-md bg-white/10 backdrop-blur-sm ring-1 ring-inset ring-white/20 px-4 py-3 text-xs font-medium text-white">
              Släpp här
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MyCandidates = () => {
  const { user } = useAuth();
  
  // Local state for candidates - like JobDetails pattern
  const [candidates, setCandidates] = useState<MyCandidateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedCandidate, setSelectedCandidate] = useState<MyCandidateData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [allCandidateApplications, setAllCandidateApplications] = useState<ApplicationData[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [candidateToRemove, setCandidateToRemove] = useState<MyCandidateData | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStageFilter, setActiveStageFilter] = useState<CandidateStage | 'all'>('all');

  // Fetch candidates data
  const fetchCandidates = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch my_candidates with joined application data
      const { data: myCandidates, error: mcError } = await supabase
        .from('my_candidates')
        .select('*')
        .eq('recruiter_id', user.id)
        .order('updated_at', { ascending: false });

      if (mcError) throw mcError;
      if (!myCandidates || myCandidates.length === 0) {
        setCandidates([]);
        return;
      }

      // Get application IDs to fetch related data
      const applicationIds = myCandidates.map(mc => mc.application_id);

      // Fetch job applications data
      const { data: applications, error: appError } = await supabase
        .from('job_applications')
        .select(`
          id,
          applicant_id,
          first_name,
          last_name,
          email,
          phone,
          location,
          bio,
          cv_url,
          age,
          employment_status,
          work_schedule,
          availability,
          custom_answers,
          status,
          applied_at,
          viewed_at,
          job_postings!inner(title)
        `)
        .in('id', applicationIds);

      if (appError) throw appError;

      // Create a map for quick lookup
      const appMap = new Map(applications?.map(app => [app.id, app]) || []);

      // Fetch profile media for each applicant
      const applicantIds = [...new Set(myCandidates.map(mc => mc.applicant_id))];
      const profileMediaMap: Record<string, { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null }> = {};

      await Promise.all(
        applicantIds.map(async (applicantId) => {
          const { data: mediaData } = await supabase.rpc('get_applicant_profile_media', {
            p_applicant_id: applicantId,
            p_employer_id: user.id,
          });

          if (mediaData && mediaData.length > 0) {
            profileMediaMap[applicantId] = {
              profile_image_url: mediaData[0].profile_image_url,
              video_url: mediaData[0].video_url,
              is_profile_video: mediaData[0].is_profile_video,
            };
          } else {
            profileMediaMap[applicantId] = {
              profile_image_url: null,
              video_url: null,
              is_profile_video: null,
            };
          }
        })
      );

      // Combine the data
      const result: MyCandidateData[] = myCandidates.map(mc => {
        const app = appMap.get(mc.application_id);
        const media = profileMediaMap[mc.applicant_id] || { profile_image_url: null, video_url: null, is_profile_video: null };

        return {
          id: mc.id,
          recruiter_id: mc.recruiter_id,
          applicant_id: mc.applicant_id,
          application_id: mc.application_id,
          job_id: mc.job_id,
          stage: mc.stage as CandidateStage,
          notes: mc.notes,
          rating: mc.rating || 0,
          created_at: mc.created_at,
          updated_at: mc.updated_at,
          first_name: app?.first_name || null,
          last_name: app?.last_name || null,
          email: app?.email || null,
          phone: app?.phone || null,
          location: app?.location || null,
          bio: app?.bio || null,
          cv_url: app?.cv_url || null,
          age: app?.age || null,
          employment_status: app?.employment_status || null,
          work_schedule: app?.work_schedule || null,
          availability: app?.availability || null,
          custom_answers: app?.custom_answers || null,
          status: app?.status || 'pending',
          job_title: (app?.job_postings as any)?.title || null,
          profile_image_url: media.profile_image_url,
          video_url: media.video_url,
          is_profile_video: media.is_profile_video,
          applied_at: app?.applied_at || null,
          viewed_at: app?.viewed_at || null,
        };
      });

      setCandidates(result);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Kunde inte ladda kandidater');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchCandidates();
    }
  }, [user, fetchCandidates]);

  // Group candidates by stage (computed from local state)
  const candidatesByStage = useMemo(() => {
    const grouped: Record<CandidateStage, MyCandidateData[]> = {
      to_contact: [],
      interview: [],
      offer: [],
      hired: [],
    };

    candidates.forEach(candidate => {
      if (grouped[candidate.stage]) {
        grouped[candidate.stage].push(candidate);
      }
    });

    return grouped;
  }, [candidates]);

  // Stats
  const stats = useMemo(() => ({
    total: candidates.length,
    to_contact: candidatesByStage.to_contact.length,
    interview: candidatesByStage.interview.length,
    offer: candidatesByStage.offer.length,
    hired: candidatesByStage.hired.length,
  }), [candidates, candidatesByStage]);

  // Filter candidates based on search query and stage filter
  const filteredCandidatesByStage = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    const filterCandidates = (candidates: MyCandidateData[]) => {
      if (!query) return candidates;
      return candidates.filter(c => {
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
        const jobTitle = (c.job_title || '').toLowerCase();
        const notes = (c.notes || '').toLowerCase();
        return fullName.includes(query) || jobTitle.includes(query) || notes.includes(query);
      });
    };

    return {
      to_contact: filterCandidates(candidatesByStage.to_contact),
      interview: filterCandidates(candidatesByStage.interview),
      offer: filterCandidates(candidatesByStage.offer),
      hired: filterCandidates(candidatesByStage.hired),
    };
  }, [candidatesByStage, searchQuery]);

  // Get total filtered count
  const filteredTotal = useMemo(() => {
    return Object.values(filteredCandidatesByStage).reduce((sum, arr) => sum + arr.length, 0);
  }, [filteredCandidatesByStage]);

  // Stages to display based on filter
  const stagesToDisplay = useMemo(() => {
    if (activeStageFilter === 'all') return STAGE_ORDER;
    return [activeStageFilter];
  }, [activeStageFilter]);

  // Fetch all applications for the selected candidate when dialog opens
  useEffect(() => {
    const fetchAllApplications = async () => {
      if (!selectedCandidate || !user || !dialogOpen) {
        setAllCandidateApplications([]);
        return;
      }

      setLoadingApplications(true);
      try {
        const { data: orgJobs, error: jobsError } = await supabase
          .from('job_postings')
          .select('id, title, employer_id')
          .eq('employer_id', user.id);

        if (jobsError) throw jobsError;
        if (!orgJobs || orgJobs.length === 0) {
          setAllCandidateApplications([]);
          return;
        }

        const jobIds = orgJobs.map(j => j.id);

        const { data: applications, error: appError } = await supabase
          .from('job_applications')
          .select(`
            id,
            job_id,
            applicant_id,
            first_name,
            last_name,
            email,
            phone,
            location,
            bio,
            cv_url,
            age,
            employment_status,
            work_schedule,
            availability,
            custom_answers,
            status,
            applied_at,
            updated_at,
            job_postings!inner(title)
          `)
          .eq('applicant_id', selectedCandidate.applicant_id)
          .in('job_id', jobIds);

        if (appError) throw appError;

        const transformedApps: ApplicationData[] = (applications || []).map(app => ({
          id: app.id,
          job_id: app.job_id,
          applicant_id: app.applicant_id,
          first_name: app.first_name,
          last_name: app.last_name,
          email: app.email,
          phone: app.phone,
          location: app.location,
          bio: app.bio,
          cv_url: app.cv_url,
          age: app.age,
          employment_status: app.employment_status,
          work_schedule: app.work_schedule,
          availability: app.availability,
          custom_answers: app.custom_answers,
          status: app.status,
          applied_at: app.applied_at || '',
          updated_at: app.updated_at,
          job_title: (app.job_postings as any)?.title || 'Okänt jobb',
          profile_image_url: selectedCandidate.profile_image_url,
          video_url: selectedCandidate.video_url,
          is_profile_video: selectedCandidate.is_profile_video,
        }));

        setAllCandidateApplications(transformedApps);
      } catch (error) {
        console.error('Error fetching candidate applications:', error);
        setAllCandidateApplications([]);
      } finally {
        setLoadingApplications(false);
      }
    };

    fetchAllApplications();
  }, [selectedCandidate?.applicant_id, user?.id, dialogOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Custom collision detection - pointerWithin first, then closestCorners
  const collisionDetectionStrategy = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCorners(args);
  }, []);

  const activeCandidate = useMemo(() => {
    if (!activeId) return null;
    return candidates.find(c => c.id === activeId) || null;
  }, [activeId, candidates]);

  // Resolve which stage we're hovering over (works for both column and card hovers)
  const resolveOverStage = (overRawId?: string): CandidateStage | null => {
    if (!overRawId) return null;

    if (STAGE_ORDER.includes(overRawId as CandidateStage)) {
      return overRawId as CandidateStage;
    }

    const overCandidate = candidates.find((c) => c.id === overRawId);
    if (overCandidate && STAGE_ORDER.includes(overCandidate.stage as CandidateStage)) {
      return overCandidate.stage as CandidateStage;
    }

    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overRawId = event.over?.id as string | undefined;
    const stage = resolveOverStage(overRawId);
    setOverId(stage);
  };

  // Move candidate - OPTIMISTIC UPDATE like JobDetails
  const updateCandidateStage = async (candidateId: string, newStage: CandidateStage) => {
    // Optimistic update - move card immediately
    const previousCandidates = [...candidates];
    setCandidates(prev => prev.map(c => 
      c.id === candidateId 
        ? { ...c, stage: newStage } 
        : c
    ));

    try {
      const { error } = await supabase
        .from('my_candidates')
        .update({ stage: newStage })
        .eq('id', candidateId);

      if (error) {
        // Revert on error
        setCandidates(previousCandidates);
        throw error;
      }
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte flytta kandidaten');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const candidateId = active.id as string;
    const overRawId = over.id as string;
    const targetStage = resolveOverStage(overRawId);

    if (!targetStage) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate && candidate.stage !== targetStage) {
      // Update stage FIRST (optimistic update)
      updateCandidateStage(candidateId, targetStage);
      // Clear drag state after a frame to ensure optimistic update is rendered
      requestAnimationFrame(() => {
        setActiveId(null);
        setOverId(null);
      });
    } else {
      setActiveId(null);
      setOverId(null);
    }
  };

  const handleMoveCandidate = (id: string, stage: CandidateStage) => {
    updateCandidateStage(id, stage);
  };

  const handleRemoveCandidate = (candidate: MyCandidateData) => {
    setCandidateToRemove(candidate);
  };

  const confirmRemoveCandidate = async () => {
    if (candidateToRemove) {
      const idToRemove = candidateToRemove.id;
      // Optimistic remove
      setCandidates(prev => prev.filter(c => c.id !== idToRemove));
      setCandidateToRemove(null);
      
      try {
        const { error } = await supabase
          .from('my_candidates')
          .delete()
          .eq('id', idToRemove);
          
        if (error) throw error;
        toast.success('Kandidat borttagen från din lista');
      } catch (error) {
        // Refetch on error
        fetchCandidates();
        toast.error('Kunde inte ta bort kandidaten');
      }
    }
  };

  // Update rating - optimistic
  const updateCandidateRating = async (candidateId: string, newRating: number) => {
    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, rating: newRating } : c
    ));
    if (selectedCandidate?.id === candidateId) {
      setSelectedCandidate(prev => prev ? { ...prev, rating: newRating } : null);
    }

    try {
      const { error } = await supabase
        .from('my_candidates')
        .update({ rating: newRating })
        .eq('id', candidateId);
        
      if (error) throw error;
    } catch (error) {
      fetchCandidates();
      toast.error('Kunde inte uppdatera betyg');
    }
  };

  // Mark as viewed - optimistic
  const markApplicationAsViewed = async (applicationId: string) => {
    setCandidates(prev => prev.map(c => 
      c.application_id === applicationId 
        ? { ...c, viewed_at: new Date().toISOString() } 
        : c
    ));

    try {
      await supabase
        .from('job_applications')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', applicationId)
        .is('viewed_at', null);
    } catch (error) {
      console.error('Error marking as viewed:', error);
    }
  };

  const handleOpenProfile = (candidate: MyCandidateData) => {
    setSelectedCandidate(candidate);
    setDialogOpen(true);
    
    // Mark as viewed if not already
    if (!candidate.viewed_at) {
      markApplicationAsViewed(candidate.application_id);
      setSelectedCandidate(prev => prev ? { ...prev, viewed_at: new Date().toISOString() } : null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setTimeout(() => setSelectedCandidate(null), 300);
  };

  // Convert MyCandidateData to ApplicationData format for dialog
  const selectedApplicationData = useMemo(() => {
    if (!selectedCandidate) return null;
    return {
      id: selectedCandidate.application_id,
      job_id: selectedCandidate.job_id || '',
      applicant_id: selectedCandidate.applicant_id,
      first_name: selectedCandidate.first_name,
      last_name: selectedCandidate.last_name,
      email: selectedCandidate.email,
      phone: selectedCandidate.phone,
      location: selectedCandidate.location,
      bio: selectedCandidate.bio,
      cv_url: selectedCandidate.cv_url,
      age: selectedCandidate.age,
      employment_status: selectedCandidate.employment_status,
      work_schedule: selectedCandidate.work_schedule,
      availability: selectedCandidate.availability,
      custom_answers: selectedCandidate.custom_answers,
      status: selectedCandidate.status,
      applied_at: selectedCandidate.applied_at,
      updated_at: selectedCandidate.updated_at,
      job_title: selectedCandidate.job_title || 'Okänt jobb',
      profile_image_url: selectedCandidate.profile_image_url,
      video_url: selectedCandidate.video_url,
      is_profile_video: selectedCandidate.is_profile_video,
    };
  }, [selectedCandidate]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-3 md:px-12 animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
            Mina kandidater
          </h1>
          <p className="text-sm text-white/90 mt-1">
            Din personliga rekryteringspipeline
          </p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2">
          {STAGE_ORDER.map(stage => (
            <div key={stage} className="flex-1 min-w-[280px] max-w-[350px]">
              <Skeleton className="h-12 w-full bg-white/10 rounded-lg mb-3" />
              <div className="space-y-2">
                <Skeleton className="h-24 w-full bg-white/10 rounded-lg" />
                <Skeleton className="h-24 w-full bg-white/10 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-12 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
          Mina kandidater ({stats.total})
        </h1>
        <p className="text-sm text-white/90 mt-1">
          Din personliga rekryteringspipeline - dra kandidater mellan steg
        </p>
      </div>

      {/* Search and Stage Filters */}
      {stats.total > 0 && (
        <div className="mb-6 space-y-3">
          {/* Search input */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
            <Input
              placeholder="Sök på namn, jobb eller anteckningar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-white/5 border-white/20 text-white placeholder:text-white focus:border-white/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Stage filters */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setActiveStageFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                activeStageFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white hover:bg-white/10 hover:text-white'
              }`}
            >
              Alla ({stats.total})
            </button>
            {STAGE_ORDER.map(stage => {
              const config = STAGE_CONFIG[stage];
              const count = candidatesByStage[stage].length;
              return (
                <button
                  key={stage}
                  onClick={() => setActiveStageFilter(activeStageFilter === stage ? 'all' : stage)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                    activeStageFilter === stage
                      ? config.color
                      : 'bg-white/5 text-white hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {config.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Search results info */}
          {searchQuery && (
            <p className="text-center text-sm text-white">
              {filteredTotal === 0 
                ? 'Inga kandidater hittades' 
                : `Visar ${filteredTotal} av ${stats.total} kandidater`}
            </p>
          )}
        </div>
      )}

      {stats.total === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserCheck className="h-12 w-12 text-white mb-4" />
            <p className="text-white text-center">
              Du har inga kandidater i din lista än.
            </p>
            <p className="text-white text-sm text-center mt-2">
              Gå till <span className="font-medium">Kandidater</span> och lägg till kandidater du vill arbeta med.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
        >
          <div className={`flex gap-4 overflow-x-auto pb-4 pt-2 px-2 ${activeStageFilter !== 'all' ? 'justify-center' : ''}`}>
            {stagesToDisplay.map(stage => (
              <StageColumn
                key={stage}
                stage={stage}
                candidates={filteredCandidatesByStage[stage]}
                onMoveCandidate={handleMoveCandidate}
                onRemoveCandidate={handleRemoveCandidate}
                onOpenProfile={handleOpenProfile}
                isOver={overId === stage}
              />
            ))}
          </div>

          <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
            {activeCandidate ? (
              <div className="opacity-95 pointer-events-none">
                <CandidateCardContent
                  candidate={activeCandidate}
                  onRemove={() => {}}
                  onOpenProfile={() => {}}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Candidate Profile Dialog */}
      <CandidateProfileDialog
        application={selectedApplicationData as any}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onStatusUpdate={() => {}}
        allApplications={allCandidateApplications.length > 1 ? allCandidateApplications : undefined}
        candidateRating={selectedCandidate?.rating}
        onRatingChange={(rating) => {
          if (selectedCandidate) {
            updateCandidateRating(selectedCandidate.id, rating);
          }
        }}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!candidateToRemove} onOpenChange={(open) => !open && setCandidateToRemove(null)}>
        <AlertDialogContentNoFocus 
          className="bg-card-parium border-white/20"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Ta bort kandidat</AlertDialogTitle>
            <AlertDialogDescription className="text-white">
              Är du säker på att du vill ta bort{' '}
              <span className="font-medium text-white">
                {candidateToRemove?.first_name} {candidateToRemove?.last_name}
              </span>{' '}
              från din kandidatlista? Detta tar inte bort kandidatens ansökan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveCandidate}
              className="bg-red-500/80 hover:bg-red-500 text-white border-none"
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </div>
  );
};

export default MyCandidates;

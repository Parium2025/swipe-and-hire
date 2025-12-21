import { useState, useMemo, useEffect } from 'react';
import { useMyCandidatesData, STAGE_CONFIG, CandidateStage, MyCandidateData } from '@/hooks/useMyCandidatesData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Trash2, 
  Phone, 
  Calendar, 
  Briefcase,
  Users,
  Gift,
  PartyPopper
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
  DndContext,
  DragOverlay,
  closestCorners,
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

const CandidateCardContent = ({ 
  candidate, 
  onRemove, 
  onOpenProfile,
  isDragging,
}: CandidateCardProps) => {
  const initials = `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div 
      className={`bg-white/5 border border-white/10 rounded-lg p-3 transition-all cursor-grab active:cursor-grabbing group ${
        isDragging ? 'shadow-xl ring-2 ring-primary/50 bg-white/10' : 'hover:border-white/30 hover:bg-white/[0.08]'
      }`}
    >
      <div className="flex items-start gap-3" onClick={onOpenProfile}>
        <Avatar className="h-10 w-10 ring-2 ring-white/20">
          {candidate.profile_image_url ? (
            <AvatarImage src={candidate.profile_image_url} alt={`${candidate.first_name} ${candidate.last_name}`} />
          ) : null}
          <AvatarFallback className="bg-white/20 text-white text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">
            {candidate.first_name} {candidate.last_name}
          </p>
          {candidate.job_title && (
            <p className="text-white/70 text-xs truncate flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {candidate.job_title}
            </p>
          )}
          {candidate.applied_at && (
            <p className="text-white/50 text-xs mt-1">
              {formatDistanceToNow(new Date(candidate.applied_at), { addSuffix: true, locale: sv })}
            </p>
          )}
        </div>
      </div>

      {/* Remove button */}
      <div className="flex items-center justify-end mt-3 pt-2 border-t border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="h-7 w-7 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
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
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
  onRemoveCandidate: (id: string) => void;
  onOpenProfile: (candidate: MyCandidateData) => void;
  isOver?: boolean;
}

const StageColumn = ({ stage, candidates, onMoveCandidate, onRemoveCandidate, onOpenProfile, isOver }: StageColumnProps) => {
  const config = STAGE_CONFIG[stage];
  const Icon = STAGE_ICONS[stage];
  const stageIndex = STAGE_ORDER.indexOf(stage);

  const { setNodeRef } = useDroppable({
    id: stage,
  });

  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className={`rounded-lg border ${config.color} p-3 mb-3 transition-all ${isOver ? 'ring-2 ring-primary scale-[1.02]' : ''}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-medium text-sm">{config.label}</span>
          <span className="ml-auto bg-white/20 text-white/90 text-xs px-2 py-0.5 rounded-full">
            {candidates.length}
          </span>
        </div>
      </div>

      <div 
        ref={setNodeRef}
        className={`space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 min-h-[100px] rounded-lg transition-colors ${
          isOver ? 'bg-white/5' : ''
        }`}
      >
        <SortableContext items={candidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {candidates.map(candidate => (
            <SortableCandidateCard
              key={candidate.id}
              candidate={candidate}
              onRemove={() => onRemoveCandidate(candidate.id)}
              onOpenProfile={() => onOpenProfile(candidate)}
            />
          ))}
        </SortableContext>

        {candidates.length === 0 && (
          <div className="text-center py-8 text-white/50 text-sm">
            {isOver ? 'Släpp här' : 'Inga kandidater i detta steg'}
          </div>
        )}
      </div>
    </div>
  );
};

const MyCandidates = () => {
  const { 
    candidatesByStage, 
    candidates,
    stats, 
    isLoading, 
    moveCandidate, 
    removeCandidate 
  } = useMyCandidatesData();

  const { user } = useAuth();
  const [selectedCandidate, setSelectedCandidate] = useState<MyCandidateData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [allCandidateApplications, setAllCandidateApplications] = useState<ApplicationData[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);

  // Fetch all applications for the selected candidate when dialog opens
  useEffect(() => {
    const fetchAllApplications = async () => {
      if (!selectedCandidate || !user || !dialogOpen) {
        setAllCandidateApplications([]);
        return;
      }

      setLoadingApplications(true);
      try {
        // Get all jobs from the user's organization
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

        // Get all applications from this candidate for organization's jobs
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

        // Transform to ApplicationData format
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

  const activeCandidate = useMemo(() => {
    if (!activeId) return null;
    return candidates.find(c => c.id === activeId) || null;
  }, [activeId, candidates]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    if (overId && STAGE_ORDER.includes(overId as CandidateStage)) {
      setOverId(overId);
    } else {
      setOverId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const candidateId = active.id as string;
    const targetStage = over.id as string;

    // Check if dropped on a stage column
    if (STAGE_ORDER.includes(targetStage as CandidateStage)) {
      const candidate = candidates.find(c => c.id === candidateId);
      if (candidate && candidate.stage !== targetStage) {
        moveCandidate.mutate({ id: candidateId, stage: targetStage as CandidateStage });
      }
    }
  };

  const handleMoveCandidate = (id: string, stage: CandidateStage) => {
    moveCandidate.mutate({ id, stage });
  };

  const handleRemoveCandidate = (id: string) => {
    removeCandidate.mutate(id);
  };

  const handleOpenProfile = (candidate: MyCandidateData) => {
    setSelectedCandidate(candidate);
    setDialogOpen(true);
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
          <p className="text-sm text-white mt-1">
            Din personliga rekryteringspipeline
          </p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
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
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
          Mina kandidater ({stats.total})
        </h1>
        <p className="text-sm text-white mt-1">
          Din personliga rekryteringspipeline - dra kandidater mellan steg
        </p>
      </div>

      {stats.total === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-white/30 mb-4" />
            <p className="text-white text-center">
              Du har inga kandidater i din lista än.
            </p>
            <p className="text-white/70 text-sm text-center mt-2">
              Gå till <span className="font-medium">Kandidater</span> och lägg till kandidater du vill arbeta med.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGE_ORDER.map(stage => (
              <StageColumn
                key={stage}
                stage={stage}
                candidates={candidatesByStage[stage]}
                onMoveCandidate={handleMoveCandidate}
                onRemoveCandidate={handleRemoveCandidate}
                onOpenProfile={handleOpenProfile}
                isOver={overId === stage}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCandidate ? (
              <div className="opacity-90">
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
      />
    </div>
  );
};

export default MyCandidates;

import { useState, useMemo } from 'react';
import { useMyCandidatesData, STAGE_CONFIG, CandidateStage, MyCandidateData } from '@/hooks/useMyCandidatesData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Phone, 
  Calendar, 
  Briefcase,
  Users,
  UserCheck,
  Gift,
  PartyPopper
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

const STAGE_ICONS = {
  to_contact: Phone,
  interview: Calendar,
  offer: Gift,
  hired: PartyPopper,
};

const STAGE_ORDER: CandidateStage[] = ['to_contact', 'interview', 'offer', 'hired'];

interface CandidateCardProps {
  candidate: MyCandidateData;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  onOpenProfile: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

const CandidateCard = ({ 
  candidate, 
  onMoveLeft, 
  onMoveRight, 
  onRemove, 
  onOpenProfile,
  canMoveLeft, 
  canMoveRight 
}: CandidateCardProps) => {
  const initials = `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div 
      className="bg-white/5 border border-white/10 rounded-lg p-3 hover:border-white/30 transition-all cursor-pointer group"
      onClick={onOpenProfile}
    >
      <div className="flex items-start gap-3">
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

      {/* Action buttons - stop propagation to prevent opening profile */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onMoveLeft(); }}
            disabled={!canMoveLeft}
            className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onMoveRight(); }}
            disabled={!canMoveRight}
            className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="h-7 w-7 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface StageColumnProps {
  stage: CandidateStage;
  candidates: MyCandidateData[];
  onMoveCandidate: (id: string, stage: CandidateStage) => void;
  onRemoveCandidate: (id: string) => void;
  onOpenProfile: (candidate: MyCandidateData) => void;
}

const StageColumn = ({ stage, candidates, onMoveCandidate, onRemoveCandidate, onOpenProfile }: StageColumnProps) => {
  const config = STAGE_CONFIG[stage];
  const Icon = STAGE_ICONS[stage];
  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className={`rounded-lg border ${config.color} p-3 mb-3`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-medium text-sm">{config.label}</span>
          <span className="ml-auto bg-white/20 text-white/90 text-xs px-2 py-0.5 rounded-full">
            {candidates.length}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {candidates.map(candidate => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onMoveLeft={() => {
              if (stageIndex > 0) {
                onMoveCandidate(candidate.id, STAGE_ORDER[stageIndex - 1]);
              }
            }}
            onMoveRight={() => {
              if (stageIndex < STAGE_ORDER.length - 1) {
                onMoveCandidate(candidate.id, STAGE_ORDER[stageIndex + 1]);
              }
            }}
            onRemove={() => onRemoveCandidate(candidate.id)}
            onOpenProfile={() => onOpenProfile(candidate)}
            canMoveLeft={stageIndex > 0}
            canMoveRight={stageIndex < STAGE_ORDER.length - 1}
          />
        ))}

        {candidates.length === 0 && (
          <div className="text-center py-8 text-white/50 text-sm">
            Inga kandidater i detta steg
          </div>
        )}
      </div>
    </div>
  );
};

const MyCandidates = () => {
  const { 
    candidatesByStage, 
    stats, 
    isLoading, 
    moveCandidate, 
    removeCandidate 
  } = useMyCandidatesData();

  const [selectedCandidate, setSelectedCandidate] = useState<MyCandidateData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
      bio: null,
      cv_url: null,
      age: null,
      employment_status: null,
      work_schedule: null,
      availability: null,
      custom_answers: null,
      status: 'pending',
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
          Din personliga rekryteringspipeline - flytta kandidater mellan steg
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_ORDER.map(stage => (
            <StageColumn
              key={stage}
              stage={stage}
              candidates={candidatesByStage[stage]}
              onMoveCandidate={handleMoveCandidate}
              onRemoveCandidate={handleRemoveCandidate}
              onOpenProfile={handleOpenProfile}
            />
          ))}
        </div>
      )}

      {/* Candidate Profile Dialog */}
      <CandidateProfileDialog
        application={selectedApplicationData as any}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onStatusUpdate={() => {}}
      />
    </div>
  );
};

export default MyCandidates;

import { memo, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { CandidateCardFace } from './CandidateCardFace';
import { CandidateSlideActions } from './CandidateSlideActions';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface CandidateSlideProps {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  onRemoveFromList?: () => void;
  isLast: boolean;
  isVisible: boolean;
  /** Åtgärdsraden visas bara när svepvyn kan hantera åtgärderna. */
  showActions?: boolean;
  saved?: boolean;
  canUndo?: boolean;
  onSave?: () => void;
  onSkip?: () => void;
  onUndo?: () => void;
}

export const CandidateSlide = memo(function CandidateSlide({
  application,
  onOpenFullProfile,
  isLast,
  isVisible,
  showActions = false,
  saved = false,
  canUndo = false,
  onSave,
  onSkip,
  onUndo,
}: CandidateSlideProps) {
  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const videoUrl = useMediaUrl(application.video_url, 'profile-video');
  const coverImageUrl = useMediaUrl(application.cover_image_url, 'profile-image');
  const isProfileVideo = application.is_profile_video;

  // Behåll samma förvärmning som tidigare medan kandidaten är i eller nära
  // viewporten. Den vanliga kandidatprofilen kan då öppnas med färdig data.
  useCandidateSummary({
    applicantId: application.applicant_id,
    jobId: application.job_id,
    applicationId: application.id,
    cvUrl: application.cv_url,
    open: isVisible,
  });

  const { fetchNotes } = useCandidateNotes({
    applicantId: application.applicant_id,
    jobId: application.job_id,
    enabled: isVisible,
  });

  useEffect(() => {
    if (isVisible) fetchNotes();
  }, [isVisible, fetchNotes]);

  return (
    <div className="flex h-full w-full flex-col items-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+3.25rem)]">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3">
        <div className="relative flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden rounded-2xl bg-card-parium shadow-[0_18px_45px_-10px_rgba(0,0,0,0.4)]">
          <CandidateCardFace
            fullBleed
            firstName={application.first_name}
            lastName={application.last_name}
            age={application.age}
            residence={application.location}
            profileImageUrl={profileImageUrl}
            coverImageUrl={coverImageUrl}
            videoUrl={videoUrl}
            hasVideo={Boolean(isProfileVideo)}
            ctaLabel="Tryck för mer info"
            contentBottomClassName={showActions ? 'pb-24' : 'pb-6'}
            onOpen={onOpenFullProfile}
          />

          {showActions && (
            <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center">
              <CandidateSlideActions
                saved={saved}
                canUndo={canUndo}
                onUndo={onUndo}
                onSave={() => onSave?.()}
                onSkip={() => onSkip?.()}
                onOpenInfo={onOpenFullProfile}
              />
            </div>
          )}
        </div>

        {!isLast && (
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <ChevronDown className="h-4 w-4 animate-bounce fill-white text-white" />
            <span className="text-[10px] font-medium text-white">Nästa kandidat</span>
          </div>
        )}
      </div>
    </div>
  );
});

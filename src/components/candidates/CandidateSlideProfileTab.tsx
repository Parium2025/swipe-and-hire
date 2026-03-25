import { useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { Star, Mail, Phone, MapPin, Calendar, Briefcase, FileText, User, ChevronDown, ChevronUp, ChevronRight, MessageSquare, CalendarPlus, Trash2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import ProfileVideo from '@/components/ProfileVideo';
import { formatTimeAgo } from '@/lib/date';
import { CandidateSummarySection } from '@/components/candidateProfile/CandidateSummarySection';
import { SectionErrorBoundary } from '@/components/candidateProfile';
import { CvViewer } from '@/components/CvViewer';
import { BookInterviewDialog } from '@/components/BookInterviewDialog';
import { SendMessageDialog } from '@/components/SendMessageDialog';
import { toast } from 'sonner';
import { useOutreachManualActions } from '@/hooks/useOutreachManualActions';
import { MANUAL_OUTREACH_ACTIONS, type ManualOutreachActionKey } from '@/lib/outreachManualActions';
import { SectionCard, SectionLabel, employmentStatusLabels, workScheduleLabels, availabilityLabels } from './CandidateSlideConstants';
import type { ApplicationData } from '@/hooks/useApplicationsData';
import type { CandidateSummaryCacheValue } from '@/components/candidateProfile/candidateProfileCache';

interface CandidateSlideProfileTabProps {
  application: ApplicationData;
  rating: number;
  profileImageUrl: string | null;
  videoUrl: string | null;
  signedCvUrl: string | null;
  isProfileVideo: boolean;
  initials: string;
  summaryHook: {
    aiSummary: CandidateSummaryCacheValue | null;
    loadingSummary: boolean;
    generatingSummary: boolean;
  };
  onOpenFullProfile: () => void;
  onRemoveFromList?: () => void;
}

export const CandidateSlideProfileTab = memo(function CandidateSlideProfileTab({
  application,
  rating,
  profileImageUrl,
  videoUrl,
  signedCvUrl,
  isProfileVideo,
  initials,
  summaryHook,
  onOpenFullProfile,
  onRemoveFromList,
}: CandidateSlideProfileTabProps) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [bookInterviewOpen, setBookInterviewOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [sendMessagePreset, setSendMessagePreset] = useState<ManualOutreachActionKey | null>(null);
  const outreachManualActions = useOutreachManualActions(true);

  const handleOpenCv = useCallback(() => {
    if (!application.cv_url || !signedCvUrl) {
      toast.error('CV kunde inte laddas');
      return;
    }
    setCvOpen(true);
  }, [application.cv_url, signedCvUrl]);

  const hasEmploymentInfo = application.employment_status || application.availability || application.work_schedule;

  return (
    <>
      {/* Avatar / Video */}
      <div className="relative">
        {isProfileVideo && videoUrl ? (
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
            <ProfileVideo
              videoUrl={videoUrl}
              coverImageUrl={profileImageUrl || undefined}
              userInitials={initials}
              className="w-full h-full"
              showCountdown={true}
              showProgressBar={false}
            />
          </div>
        ) : (
          <Avatar className="w-28 h-28 border-4 border-white/20 shadow-xl">
            <AvatarImage src={profileImageUrl || ''} alt={`${application.first_name} ${application.last_name}`} className="object-cover" />
            <AvatarFallback className="bg-white/10 text-white text-3xl font-semibold" delayMs={200}>{initials}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Name + job + time */}
      <div className="w-full min-w-0 text-center">
        <h2 className="text-xl font-semibold text-white break-words [overflow-wrap:anywhere]">{application.first_name} {application.last_name}</h2>
        <p className="text-sm text-white mt-1 break-words [overflow-wrap:anywhere]">{application.job_title || 'Okänd tjänst'}</p>
        <span className="text-xs text-white mt-0.5 block break-words [overflow-wrap:anywhere]">{formatTimeAgo(application.applied_at)}</span>
      </div>

      {/* Star rating */}
      {rating > 0 && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`} />
          ))}
        </div>
      )}

      {/* Contact info */}
      <SectionCard className="w-full min-w-0 space-y-2">
        {application.email && (
          <div className="flex min-w-0 items-center gap-2.5">
            <Mail className="h-3.5 w-3.5 text-white shrink-0" />
            <span className="min-w-0 flex-1 text-sm text-white break-all [overflow-wrap:anywhere]">{application.email}</span>
          </div>
        )}
        {application.phone && (
          <div className="flex min-w-0 items-center gap-2.5">
            <Phone className="h-3.5 w-3.5 text-white shrink-0" />
            <span className="min-w-0 flex-1 text-sm text-white break-all [overflow-wrap:anywhere]">{application.phone}</span>
          </div>
        )}
        {application.location && (
          <div className="flex min-w-0 items-center gap-2.5">
            <MapPin className="h-3.5 w-3.5 text-white shrink-0" />
            <span className="min-w-0 flex-1 text-sm text-white break-words [overflow-wrap:anywhere]">{application.location}</span>
          </div>
        )}
        {application.age && (
          <div className="flex items-center gap-2.5">
            <Calendar className="h-3.5 w-3.5 text-white shrink-0" />
            <span className="text-sm text-white">{application.age} år</span>
          </div>
        )}
      </SectionCard>

      {/* Employment info */}
      {hasEmploymentInfo && (
        <SectionCard className="w-full min-w-0 space-y-2">
          <SectionLabel icon={Briefcase}>Anställningsinformation</SectionLabel>
          {application.employment_status && (
            <div>
              <p className="text-xs text-white">Anställningsstatus?</p>
              <p className="text-sm text-white break-words [overflow-wrap:anywhere]">Svar: {employmentStatusLabels[application.employment_status] || application.employment_status}</p>
            </div>
          )}
          {application.work_schedule && (
            <div>
              <p className="text-xs text-white">Arbetsschema</p>
              <p className="text-sm text-white break-words [overflow-wrap:anywhere]">Svar: {workScheduleLabels[application.work_schedule] || application.work_schedule}</p>
            </div>
          )}
          {application.availability && (
            <div>
              <p className="text-xs text-white">När kan du börja nytt jobb?</p>
              <p className="text-sm text-white break-words [overflow-wrap:anywhere]">Svar: {availabilityLabels[application.availability] || application.availability}</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* AI Summary */}
      <div className="w-full">
        <SectionErrorBoundary fallbackLabel="AI-sammanfattning">
          <CandidateSummarySection
            aiSummary={summaryHook.aiSummary}
            loadingSummary={summaryHook.loadingSummary}
            generatingSummary={summaryHook.generatingSummary}
            hasCvUrl={!!application.cv_url}
            signedCvUrl={signedCvUrl}
          />
        </SectionErrorBoundary>
      </div>

      {/* CV — inline viewer like desktop */}
      {application.cv_url && (
        <SectionCard className="w-full min-w-0">
          <SectionLabel icon={FileText}>CV</SectionLabel>
          <button
            onClick={handleOpenCv}
            className="w-full min-w-0 flex items-center justify-between rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10 px-3 py-2.5 text-sm text-white active:scale-[0.97] transition-all"
          >
            <div className="min-w-0 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-white shrink-0" />
              <span className="truncate">Visa CV</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-white" />
          </button>
        </SectionCard>
      )}

      {/* CV fullscreen overlay — matches desktop CandidateProfileDialog */}
      {cvOpen && signedCvUrl && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-white text-lg font-semibold">CV</h3>
            <button
              type="button"
              onClick={() => setCvOpen(false)}
              className="flex h-7 w-7 !min-h-0 !min-w-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-white transition-colors touch-manipulation md:hover:bg-white/20"
              aria-label="Stäng"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-auto px-2 pb-4">
            <CvViewer
              src={signedCvUrl}
              fileName="cv.pdf"
              height="calc(100dvh - 80px)"
              onClose={() => setCvOpen(false)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Bio / Presentation */}
      {application.bio && (
        <SectionCard className="w-full min-w-0">
          <button onClick={() => setBioExpanded(!bioExpanded)} className="w-full min-w-0 flex items-center justify-between gap-2">
            <SectionLabel icon={User}>Presentation om {application.first_name}</SectionLabel>
            {bioExpanded ? <ChevronUp className="h-3.5 w-3.5 text-white shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-white shrink-0" />}
          </button>
          {bioExpanded && (
            <p className="text-sm text-white whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed mt-2">{application.bio}</p>
          )}
        </SectionCard>
      )}

      {/* Action buttons — identical to desktop ProfileActions my-candidates variant */}
      <div className="w-full min-w-0">
        {MANUAL_OUTREACH_ACTIONS.filter((action) => outreachManualActions.hasAction(action.key)).length > 0 && (
          <div className="mb-2 space-y-2">
            <p className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">Snabbutskick</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {MANUAL_OUTREACH_ACTIONS.filter((action) => outreachManualActions.hasAction(action.key)).map((action) => (
                <Button
                  key={action.key}
                  onClick={() => {
                    setSendMessagePreset(action.key);
                    setSendMessageOpen(true);
                  }}
                  variant={action.buttonVariant}
                  size="sm"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-1">
          <Button
            onClick={() => {
              setSendMessagePreset(null);
              setSendMessageOpen(true);
            }}
            variant="glassPurple"
            size="sm"
            className="min-w-0 flex-1"
          >
            <MessageSquare className="h-4 w-4 mr-1 shrink-0" />
            <span className="whitespace-nowrap text-[clamp(9px,2.5vw,14px)]">Chatta</span>
          </Button>
          <Button
            onClick={() => setBookInterviewOpen(true)}
            variant="glassBlue"
            size="sm"
            className="min-w-0 flex-1"
          >
            <CalendarPlus className="h-4 w-4 mr-1 shrink-0" />
            <span className="whitespace-nowrap text-[clamp(9px,2.5vw,14px)]">Boka möte</span>
          </Button>
          {onRemoveFromList && (
            <Button
              onClick={onRemoveFromList}
              variant="glassRed"
              size="sm"
              className="min-w-0 flex-1"
            >
              <Trash2 className="h-4 w-4 mr-1 shrink-0" />
              <span className="whitespace-nowrap text-[clamp(9px,2.5vw,14px)]">Ta bort</span>
            </Button>
          )}
        </div>
      </div>

      {/* Direct dialogs — elevated z-index to render above SwipeViewer */}
      <BookInterviewDialog
        open={bookInterviewOpen}
        onOpenChange={setBookInterviewOpen}
        candidateId={application.applicant_id}
        candidateName={`${application.first_name || ''} ${application.last_name || ''}`.trim()}
        jobId={application.job_id}
        jobTitle={application.job_title || ''}
        applicationId={application.id}
        elevated
      />
      <SendMessageDialog
        open={sendMessageOpen}
        onOpenChange={(nextOpen) => {
          setSendMessageOpen(nextOpen);
          if (!nextOpen) setSendMessagePreset(null);
        }}
        recipientId={application.applicant_id}
        recipientName={`${application.first_name || ''} ${application.last_name || ''}`.trim()}
        jobId={application.job_id}
        applicationId={application.id}
        presetAction={sendMessagePreset}
        elevated
      />
    </>
  );
});

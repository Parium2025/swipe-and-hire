import { useState, memo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { Star, Mail, Phone, MapPin, Calendar, Briefcase, FileText, User, ChevronDown, ChevronUp, ChevronRight, MessageSquare, CalendarPlus, Activity, StickyNote, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import ProfileVideo from '@/components/ProfileVideo';
import { formatTimeAgo } from '@/lib/date';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { CandidateSummarySection } from '@/components/candidateProfile/CandidateSummarySection';
import { SectionErrorBoundary } from '@/components/candidateProfile';
import { CandidateActivityLog } from '@/components/CandidateActivityLog';
import { CandidateNotesPanel } from '@/components/candidateProfile/CandidateNotesPanel';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { CvViewer } from '@/components/CvViewer';
import { toast } from 'sonner';
import type { ApplicationData } from '@/hooks/useApplicationsData';

// ─── Label maps ────────────────────────────────────────────
const employmentStatusLabels: Record<string, string> = {
  tillsvidareanställning: 'Fast anställning',
  visstidsanställning: 'Visstidsanställning',
  provanställning: 'Provanställning',
  interim: 'Interim anställning',
  arbetssokande: 'Arbetssökande',
};
const workScheduleLabels: Record<string, string> = {
  heltid: 'Heltid', deltid: 'Deltid', timanställning: 'Timanställning',
};
const availabilityLabels: Record<string, string> = {
  omgaende: 'Omgående',
  'inom-1-manad': 'Inom 1 månad',
  'inom-3-manader': 'Inom 3 månader',
  'inom-6-manader': 'Inom 6 månader',
  'ej-aktuellt': 'Inte aktuellt just nu',
  osaker: 'Osäker',
};

type TabKey = 'profil' | 'aktivitet' | 'anteckningar';

/* ── Shared UI helpers ──────────────────────────── */
const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/[0.06] ring-1 ring-inset ring-white/10 rounded-xl p-3.5 ${className}`}>{children}</div>
);

const SectionLabel = ({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <span className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
    <Icon className="h-3 w-3" />
    {children}
  </span>
);

/* ── Tab bar ──────────────────────────────────────── */
const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'profil', label: 'Profil', icon: User },
  { key: 'aktivitet', label: 'Aktivitet', icon: Activity },
  { key: 'anteckningar', label: 'Anteckningar', icon: StickyNote },
];

interface CandidateSlideProps {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  isLast: boolean;
  isVisible: boolean;
}

export const CandidateSlide = memo(function CandidateSlide({
  application,
  rating,
  onOpenFullProfile,
  isLast,
  isVisible,
}: CandidateSlideProps) {
  const { user } = useAuth();
  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const videoUrl = useMediaUrl(application.video_url, 'profile-video');
  const signedCvUrl = useMediaUrl(application.cv_url, 'cv');
  const isProfileVideo = application.is_profile_video;
  const initials = `${(application.first_name?.[0] || '').toUpperCase()}${(application.last_name?.[0] || '').toUpperCase()}`;
  const [bioExpanded, setBioExpanded] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('profil');

  // AI summary hook — only actively polls when visible
  const summaryHook = useCandidateSummary({
    applicantId: application.applicant_id,
    jobId: application.job_id,
    applicationId: application.id,
    cvUrl: application.cv_url,
    open: isVisible,
  });

  // Notes hook
  const notesHook = useCandidateNotes({
    applicantId: application.applicant_id,
    jobId: application.job_id,
  });

  const [newNote, setNewNote] = useState('');

  // Fetch notes when tab is active
  useEffect(() => {
    if (activeTab === 'anteckningar' && isVisible) {
      notesHook.fetchNotes();
    }
  }, [activeTab, isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveNote = useCallback(() => {
    notesHook.saveNote(newNote, () => setNewNote(''));
  }, [newNote, notesHook.saveNote]);

  const handleStartEditing = useCallback((note: any) => {
    notesHook.startEditing(note);
  }, [notesHook.startEditing]);

  const handleOpenCv = useCallback(() => {
    if (!application.cv_url || !signedCvUrl) {
      toast.error('CV kunde inte laddas');
      return;
    }
    setCvOpen(true);
  }, [application.cv_url, signedCvUrl]);

  const hasEmploymentInfo = application.employment_status || application.availability || application.work_schedule;

  return (
    <div className="w-full flex flex-col items-center px-6 py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-5">

        {/* ── Tabs — sliding indicator matching desktop dialog ── */}
        <div className="w-full flex items-center border-b border-white/20 relative">
          {/* Sliding white indicator */}
          <motion.div
            className="absolute bottom-0 h-0.5 bg-white"
            initial={false}
            animate={{
              left: `calc(${TABS.findIndex(t => t.key === activeTab)} * (100% / 3))`,
              width: `calc(100% / 3)`,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 35, mass: 0.8 }}
          />
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-1.5 py-2.5 text-sm font-medium transition-colors min-w-0 ${
                  isActive ? 'text-white' : 'text-white/50'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate leading-none">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── PROFIL TAB ── */}
        {activeTab === 'profil' && (
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
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">{application.first_name} {application.last_name}</h2>
              <p className="text-sm text-white mt-1">{application.job_title || 'Okänd tjänst'}</p>
              <span className="text-xs text-white mt-0.5 block">{formatTimeAgo(application.applied_at)}</span>
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
            <SectionCard className="w-full space-y-2">
              {application.email && (
                <div className="flex items-center gap-2.5">
                  <Mail className="h-3.5 w-3.5 text-white shrink-0" />
                  <span className="text-sm text-white truncate">{application.email}</span>
                </div>
              )}
              {application.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="h-3.5 w-3.5 text-white shrink-0" />
                  <span className="text-sm text-white">{application.phone}</span>
                </div>
              )}
              {application.location && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-3.5 w-3.5 text-white shrink-0" />
                  <span className="text-sm text-white">{application.location}</span>
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
              <SectionCard className="w-full space-y-2">
                <SectionLabel icon={Briefcase}>Anställningsinformation</SectionLabel>
                {application.employment_status && (
                  <div>
                    <p className="text-xs text-white">Anställningsstatus?</p>
                    <p className="text-sm text-white">Svar: {employmentStatusLabels[application.employment_status] || application.employment_status}</p>
                  </div>
                )}
                {application.work_schedule && (
                  <div>
                    <p className="text-xs text-white">Arbetsschema</p>
                    <p className="text-sm text-white">Svar: {workScheduleLabels[application.work_schedule] || application.work_schedule}</p>
                  </div>
                )}
                {application.availability && (
                  <div>
                    <p className="text-xs text-white">När kan du börja nytt jobb?</p>
                    <p className="text-sm text-white">Svar: {availabilityLabels[application.availability] || application.availability}</p>
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
              <SectionCard className="w-full">
                <SectionLabel icon={FileText}>CV</SectionLabel>
                <button
                  onClick={handleOpenCv}
                  className="w-full flex items-center justify-between rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10 px-3 py-2.5 text-sm text-white active:scale-[0.97] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-white" />
                    <span>Visa CV</span>
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
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 touch-manipulation"
                    aria-label="Stäng"
                  >
                    <X className="h-5 w-5 text-white" />
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
              <SectionCard className="w-full">
                <button onClick={() => setBioExpanded(!bioExpanded)} className="w-full flex items-center justify-between">
                  <SectionLabel icon={User}>Presentation om {application.first_name}</SectionLabel>
                  {bioExpanded ? <ChevronUp className="h-3.5 w-3.5 text-white" /> : <ChevronDown className="h-3.5 w-3.5 text-white" />}
                </button>
                {bioExpanded && (
                  <p className="text-sm text-white whitespace-pre-wrap leading-relaxed mt-2">{application.bio}</p>
                )}
              </SectionCard>
            )}

            {/* Action buttons — glass purple & blue */}
            <div className="w-full flex items-center gap-3">
              <button
                onClick={onOpenFullProfile}
                className="flex-1 py-3 rounded-full bg-purple-500/20 backdrop-blur-sm border border-purple-500/40 text-white text-sm font-medium active:scale-[0.97] active:bg-purple-500/40 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Meddelande
              </button>
              <button
                onClick={onOpenFullProfile}
                className="flex-1 py-3 rounded-full bg-blue-500/20 backdrop-blur-sm border border-blue-500/40 text-white text-sm font-medium active:scale-[0.97] active:bg-blue-500/40 transition-all flex items-center justify-center gap-2"
              >
                <CalendarPlus className="h-4 w-4" />
                Boka möte
              </button>
            </div>
          </>
        )}

        {/* ── AKTIVITET TAB ── */}
        {activeTab === 'aktivitet' && (
          <div className="w-full">
            <SectionErrorBoundary fallbackLabel="Aktivitetslogg">
              <CandidateActivityLog applicantId={application.applicant_id} />
            </SectionErrorBoundary>
          </div>
        )}

        {/* ── ANTECKNINGAR TAB ── */}
        {activeTab === 'anteckningar' && (
          <div className="w-full">
            <SectionErrorBoundary fallbackLabel="Anteckningar">
              <CandidateNotesPanel
                notes={notesHook.notes}
                loadingNotes={notesHook.loadingNotes}
                newNote={newNote}
                onNewNoteChange={setNewNote}
                onSaveNote={handleSaveNote}
                savingNote={notesHook.savingNote}
                currentUserId={user?.id}
                onStartEditing={handleStartEditing}
                onConfirmDelete={notesHook.deleteNote}
                editingNoteId={notesHook.editingNoteId}
                editingNoteText={notesHook.editingNoteText}
                originalNoteText={notesHook.originalNoteText}
                onEditingNoteTextChange={notesHook.setEditingNoteText}
                onUpdateNote={notesHook.updateNote}
                onCancelEditing={notesHook.cancelEditing}
              />
            </SectionErrorBoundary>
          </div>
        )}

        {/* Separator / next hint */}
        {!isLast && (
          <div className="w-full pt-6 pb-2">
            <div className="w-full h-px bg-white/10" />
            <div className="flex flex-col items-center gap-1 pt-4">
              <ChevronDown className="h-4 w-4 text-white fill-white animate-bounce" />
              <span className="text-[10px] text-white font-medium">Nästa kandidat</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

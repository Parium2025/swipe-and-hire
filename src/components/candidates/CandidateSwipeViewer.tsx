import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Mail, Phone, MapPin, Calendar, Briefcase, FileText, User, ChevronDown, ChevronUp, MessageSquare, CalendarPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import ProfileVideo from '@/components/ProfileVideo';
import { formatTimeAgo } from '@/lib/date';
import type { ApplicationData } from '@/hooks/useApplicationsData';

// Employment status / availability label maps
const employmentStatusLabels: Record<string, string> = {
  tillsvidareanställning: 'Fast anställning',
  visstidsanställning: 'Visstidsanställning',
  provanställning: 'Provanställning',
  interim: 'Interim anställning',
  arbetssokande: 'Arbetssökande',
};

const workScheduleLabels: Record<string, string> = {
  heltid: 'Heltid',
  deltid: 'Deltid',
  timanställning: 'Timanställning',
};

const availabilityLabels: Record<string, string> = {
  omgaende: 'Omgående',
  'inom-1-manad': 'Inom 1 månad',
  'inom-3-manader': 'Inom 3 månader',
  'inom-6-manader': 'Inom 6 månader',
  'ej-aktuellt': 'Inte aktuellt just nu',
  osaker: 'Osäker',
};

interface CandidateSwipeViewerProps {
  applications: ApplicationData[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onOpenFullProfile: (application: ApplicationData) => void;
  getDisplayRating: (app: ApplicationData) => number;
}

/* ── Section Card ───────────────────────────────── */
const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/[0.06] ring-1 ring-inset ring-white/10 rounded-xl p-3.5 ${className}`}>
    {children}
  </div>
);

const SectionLabel = ({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <span className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
    <Icon className="h-3 w-3" />
    {children}
  </span>
);

/* ── Single Candidate Slide (Full Profile) ──────── */
const CandidateSlide = memo(function CandidateSlide({
  application,
  rating,
  onOpenFullProfile,
  isLast,
}: {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  isLast: boolean;
}) {
  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const videoUrl = useMediaUrl(application.video_url, 'profile-video');
  const isProfileVideo = application.is_profile_video;
  const initials = `${(application.first_name?.[0] || '').toUpperCase()}${(application.last_name?.[0] || '').toUpperCase()}`;
  const [bioExpanded, setBioExpanded] = useState(false);

  const hasEmploymentInfo = application.employment_status || application.availability || application.work_schedule;

  return (
    <div className="w-full flex flex-col items-center px-6 py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-5">
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
              <AvatarImage
                src={profileImageUrl || ''}
                alt={`${application.first_name} ${application.last_name}`}
                className="object-cover"
              />
              <AvatarFallback className="bg-white/10 text-white text-3xl font-semibold" delayMs={200}>
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white">
            {application.first_name} {application.last_name}
          </h2>
          <p className="text-sm text-white mt-1">
            {application.job_title || 'Okänd tjänst'}
          </p>
          <span className="text-xs text-white mt-0.5 block">
            {formatTimeAgo(application.applied_at)}
          </span>
        </div>

        {/* Star rating */}
        {rating > 0 && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-white/20'
                }`}
              />
            ))}
          </div>
        )}

        {/* Contact info */}
        <SectionCard className="w-full space-y-2">
          {application.email && (
            <div className="flex items-center gap-2.5">
              <Mail className="h-3.5 w-3.5 text-white/60 shrink-0" />
              <span className="text-sm text-white truncate">{application.email}</span>
            </div>
          )}
          {application.phone && (
            <div className="flex items-center gap-2.5">
              <Phone className="h-3.5 w-3.5 text-white/60 shrink-0" />
              <span className="text-sm text-white">{application.phone}</span>
            </div>
          )}
          {application.location && (
            <div className="flex items-center gap-2.5">
              <MapPin className="h-3.5 w-3.5 text-white/60 shrink-0" />
              <span className="text-sm text-white">{application.location}</span>
            </div>
          )}
          {application.age && (
            <div className="flex items-center gap-2.5">
              <Calendar className="h-3.5 w-3.5 text-white/60 shrink-0" />
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
                <p className="text-xs text-white/60">Anställningsstatus?</p>
                <p className="text-sm text-white">
                  Svar: {employmentStatusLabels[application.employment_status] || application.employment_status}
                </p>
              </div>
            )}
            {application.work_schedule && (
              <div>
                <p className="text-xs text-white/60">Arbetsschema</p>
                <p className="text-sm text-white">
                  Svar: {workScheduleLabels[application.work_schedule] || application.work_schedule}
                </p>
              </div>
            )}
            {application.availability && (
              <div>
                <p className="text-xs text-white/60">När kan du börja nytt jobb?</p>
                <p className="text-sm text-white">
                  Svar: {availabilityLabels[application.availability] || application.availability}
                </p>
              </div>
            )}
          </SectionCard>
        )}

        {/* CV */}
        {application.cv_url && (
          <SectionCard className="w-full">
            <SectionLabel icon={FileText}>CV</SectionLabel>
            <button
              onClick={onOpenFullProfile}
              className="w-full flex items-center justify-between rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10 px-3 py-2.5 text-sm text-white active:scale-[0.97] transition-all"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-white/60" />
                <span>Visa CV</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-white/60" />
            </button>
          </SectionCard>
        )}

        {/* Bio / Presentation */}
        {application.bio && (
          <SectionCard className="w-full">
            <button
              onClick={() => setBioExpanded(!bioExpanded)}
              className="w-full flex items-center justify-between"
            >
              <SectionLabel icon={User}>
                Presentation om {application.first_name}
              </SectionLabel>
              {bioExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-white/60" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-white/60" />
              )}
            </button>
            {bioExpanded && (
              <p className="text-sm text-white whitespace-pre-wrap leading-relaxed mt-2">
                {application.bio}
              </p>
            )}
          </SectionCard>
        )}

        {/* Action buttons */}
        <div className="w-full flex items-center gap-3">
          <button
            onClick={onOpenFullProfile}
            className="flex-1 py-3 rounded-full bg-white/10 ring-1 ring-inset ring-white/20 text-white text-sm font-medium active:scale-[0.97] transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Meddelande
          </button>
          <button
            onClick={onOpenFullProfile}
            className="flex-1 py-3 rounded-full bg-white/10 ring-1 ring-inset ring-white/20 text-white text-sm font-medium active:scale-[0.97] transition-all flex items-center justify-center gap-2"
          >
            <CalendarPlus className="h-4 w-4" />
            Boka möte
          </button>
        </div>

        {/* Separator / next hint */}
        {!isLast && (
          <div className="w-full pt-6 pb-2">
            <div className="w-full h-px bg-white/10" />
            <div className="flex flex-col items-center gap-1 pt-4 opacity-40">
              <ChevronDown className="h-4 w-4 text-white animate-bounce" />
              <span className="text-[10px] text-white">Nästa kandidat</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Missing import used in CV section
const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

/* ── Main Viewer ────────────────────────────────── */
export const CandidateSwipeViewer = memo(function CandidateSwipeViewer({
  applications,
  initialIndex,
  open,
  onClose,
  onOpenFullProfile,
  getDisplayRating,
}: CandidateSwipeViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const candidateRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll to initial candidate on open
  useEffect(() => {
    if (open && scrollRef.current && candidateRefs.current[initialIndex]) {
      candidateRefs.current[initialIndex]?.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Track current candidate via IntersectionObserver
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the most visible entry
        let maxRatio = 0;
        let maxIdx = currentIndex;
        entries.forEach(entry => {
          const idx = Number(entry.target.getAttribute('data-index'));
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            maxIdx = idx;
          }
        });
        if (maxRatio > 0) {
          setCurrentIndex(maxIdx);
        }
      },
      {
        root: scrollRef.current,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    candidateRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [open, applications.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] bg-card-parium"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <div className="py-3">
            <span className="text-xs text-white font-medium tabular-nums">
              {currentIndex + 1} / {applications.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center touch-manipulation"
            aria-label="Stäng"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <X className="h-5 w-5 text-white" />
            </div>
          </button>
        </div>

        {/* Dot indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5">
          {applications.slice(
            Math.max(0, currentIndex - 3),
            Math.min(applications.length, currentIndex + 4)
          ).map((_, i) => {
            const realIdx = Math.max(0, currentIndex - 3) + i;
            return (
              <div
                key={realIdx}
                className={`rounded-full transition-all duration-200 ${
                  realIdx === currentIndex
                    ? 'w-2 h-2 bg-white'
                    : 'w-1.5 h-1.5 bg-white/30'
                }`}
              />
            );
          })}
        </div>

        {/* Continuous scroll container */}
        <div
          ref={scrollRef}
          className="h-full w-full overflow-y-auto overscroll-contain pt-12"
          style={{
            WebkitOverflowScrolling: 'touch',
            willChange: 'scroll-position',
            contain: 'layout style',
          }}
        >
          {applications.map((app, idx) => (
            <div
              key={app.id}
              ref={(el) => { candidateRefs.current[idx] = el; }}
              data-index={idx}
              className="w-full"
            >
              <CandidateSlide
                application={app}
                rating={getDisplayRating(app)}
                onOpenFullProfile={() => onOpenFullProfile(app)}
                isLast={idx === applications.length - 1}
              />
            </div>
          ))}
          {/* Bottom padding for safe area */}
          <div className="h-[env(safe-area-inset-bottom,2rem)]" />
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});

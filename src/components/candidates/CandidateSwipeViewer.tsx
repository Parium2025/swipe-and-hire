import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Mail, Phone, MapPin, Calendar, Briefcase, FileText, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import ProfileVideo from '@/components/ProfileVideo';
import { formatTimeAgo } from '@/lib/date';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface CandidateSwipeViewerProps {
  applications: ApplicationData[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onOpenFullProfile: (application: ApplicationData) => void;
  getDisplayRating: (app: ApplicationData) => number;
}

/* ── Single Candidate Slide ─────────────────────── */
const CandidateSlide = memo(function CandidateSlide({
  application,
  rating,
  onOpenFullProfile,
}: {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
}) {
  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const videoUrl = useMediaUrl(application.video_url, 'profile-video');
  const isProfileVideo = application.is_profile_video;
  const initials = `${(application.first_name?.[0] || '').toUpperCase()}${(application.last_name?.[0] || '').toUpperCase()}`;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="h-full w-full snap-start snap-always flex flex-col items-center justify-center px-6 py-8 overflow-y-auto overscroll-contain">
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
              <AvatarFallback className="bg-white/10 text-[#FFFFFF] text-3xl font-semibold" delayMs={200}>
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#FFFFFF]">
            {application.first_name} {application.last_name}
          </h2>
          <p className="text-sm text-[#FFFFFF]/70 mt-1">
            {application.job_title || 'Okänd tjänst'}
          </p>
          <span className="text-xs text-[#FFFFFF]/50 mt-0.5 block">
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

        {/* Quick info cards */}
        <div className="w-full space-y-2">
          {/* Contact info */}
          <div className="bg-white/[0.06] ring-1 ring-inset ring-white/10 rounded-xl p-3.5 space-y-2">
            {application.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="h-3.5 w-3.5 text-[#FFFFFF]/60 shrink-0" />
                <span className="text-sm text-[#FFFFFF] truncate">{application.email}</span>
              </div>
            )}
            {application.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-3.5 w-3.5 text-[#FFFFFF]/60 shrink-0" />
                <span className="text-sm text-[#FFFFFF]">{application.phone}</span>
              </div>
            )}
            {application.location && (
              <div className="flex items-center gap-2.5">
                <MapPin className="h-3.5 w-3.5 text-[#FFFFFF]/60 shrink-0" />
                <span className="text-sm text-[#FFFFFF]">{application.location}</span>
              </div>
            )}
            {application.age && (
              <div className="flex items-center gap-2.5">
                <Calendar className="h-3.5 w-3.5 text-[#FFFFFF]/60 shrink-0" />
                <span className="text-sm text-[#FFFFFF]">{application.age} år</span>
              </div>
            )}
          </div>

          {/* Bio / Presentation */}
          {application.bio && (
            <div className="bg-white/[0.06] ring-1 ring-inset ring-white/10 rounded-xl p-3.5">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between"
              >
                <span className="text-[10px] font-semibold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Presentation
                </span>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-[#FFFFFF]/60" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-[#FFFFFF]/60" />
                )}
              </button>
              {expanded && (
                <p className="text-sm text-[#FFFFFF]/90 whitespace-pre-wrap leading-relaxed mt-2">
                  {application.bio}
                </p>
              )}
            </div>
          )}
        </div>

        {/* "Visa fullständig profil" button */}
        <button
          onClick={onOpenFullProfile}
          className="w-full py-3 rounded-full bg-white/10 ring-1 ring-inset ring-white/20 text-[#FFFFFF] text-sm font-medium active:scale-[0.97] transition-all"
        >
          Visa fullständig profil
        </button>

        {/* Scroll hint */}
        <div className="flex flex-col items-center gap-1 pt-2 opacity-40">
          <ChevronDown className="h-4 w-4 text-[#FFFFFF] animate-bounce" />
          <span className="text-[10px] text-[#FFFFFF]">Svep för nästa</span>
        </div>
      </div>
    </div>
  );
});

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

  // Scroll to initial candidate on open
  useEffect(() => {
    if (open && scrollRef.current) {
      const slideHeight = scrollRef.current.clientHeight;
      scrollRef.current.scrollTo({ top: initialIndex * slideHeight, behavior: 'instant' as ScrollBehavior });
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Track current slide via scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const slideHeight = scrollRef.current.clientHeight;
    if (slideHeight === 0) return;
    const idx = Math.round(scrollRef.current.scrollTop / slideHeight);
    setCurrentIndex(idx);
  }, []);

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
        className="fixed inset-0 z-[100] bg-background"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <div className="py-3">
            <span className="text-xs text-[#FFFFFF]/60 font-medium">
              {currentIndex + 1} / {applications.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center touch-manipulation"
            aria-label="Stäng"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <X className="h-5 w-5 text-[#FFFFFF]" />
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
                    ? 'w-2 h-2 bg-[#FFFFFF]'
                    : 'w-1.5 h-1.5 bg-[#FFFFFF]/30'
                }`}
              />
            );
          })}
        </div>

        {/* Snap scroll container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-auto snap-y snap-mandatory overscroll-contain"
          style={{
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {applications.map((app, idx) => (
            <div
              key={app.id}
              className="h-full w-full flex-shrink-0"
              style={{ height: '100dvh' }}
            >
              <CandidateSlide
                application={app}
                rating={getDisplayRating(app)}
                onOpenFullProfile={() => onOpenFullProfile(app)}
              />
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});

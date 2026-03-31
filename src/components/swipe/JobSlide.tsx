import { memo, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { Building2, MapPin, CheckCircle, Briefcase } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { supabase } from '@/integrations/supabase/client';
import type { SwipeJob } from './SwipeCard';

function resolveImageUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const { data } = supabase.storage.from('job-images').getPublicUrl(url);
  return data?.publicUrl || null;
}

interface JobSlideProps {
  job: SwipeJob;
  applied: boolean;
  isVisible: boolean;
  isLast: boolean;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onTap: () => void;
}

const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 400;
const EXIT_X = typeof window !== 'undefined' ? window.innerWidth * 1.2 : 500;

export const JobSlide = memo(function JobSlide({
  job,
  applied,
  isVisible,
  isLast,
  onSwipeRight,
  onSwipeLeft,
  onTap,
}: JobSlideProps) {
  const x = useMotionValue(0);
  const likeOpacity = useTransform(x, [0, 60, 140], [0, 0.4, 1]);
  const nopeOpacity = useTransform(x, [-140, -60, 0], [1, 0.4, 0]);
  const cardRotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.97, 1, 0.97]);
  const swipedRef = useRef(false);

  const imageUrl = resolveImageUrl(job.job_image_url);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (swipedRef.current) return;
    const { offset, velocity } = info;

    if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      swipedRef.current = true;
      animate(x, EXIT_X, { type: 'spring', stiffness: 500, damping: 30 });
      setTimeout(() => {
        onSwipeRight();
        swipedRef.current = false;
        x.set(0);
      }, 250);
      return;
    }

    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      swipedRef.current = true;
      animate(x, -EXIT_X, { type: 'spring', stiffness: 500, damping: 30 });
      setTimeout(() => {
        onSwipeLeft();
        swipedRef.current = false;
        x.set(0);
      }, 250);
      return;
    }

    animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
  }, [x, onSwipeRight, onSwipeLeft]);

  return (
    <div className="min-h-[calc(100dvh-3rem)] w-full flex flex-col snap-start snap-always">
      {/* Card area with swipe */}
      <motion.div
        className="flex-1 relative mx-3 my-2 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          x,
          rotate: cardRotate,
          scale: cardScale,
          touchAction: 'pan-y',
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        onTap={onTap}
      >
        {/* Background image */}
        <div className="absolute inset-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={job.title}
              className="w-full h-full object-cover"
              style={{
                objectPosition: `center ${(() => {
                  const v = job.image_focus_position;
                  if (!v || v === 'center') return '50%';
                  if (v === 'top') return '20%';
                  if (v === 'bottom') return '80%';
                  return `${v}%`;
                })()}`,
              }}
              loading={isVisible ? 'eager' : 'lazy'}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)] flex items-center justify-center">
              <Building2 className="w-24 h-24 text-white/10" />
            </div>
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* LIKE stamp */}
        <motion.div
          className="absolute top-8 left-6 z-20 border-4 border-green-400 rounded-lg px-4 py-1 -rotate-12 pointer-events-none"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-green-400 text-3xl font-black tracking-wider">LIKE</span>
        </motion.div>

        {/* NOPE stamp */}
        <motion.div
          className="absolute top-8 right-6 z-20 border-4 border-red-400 rounded-lg px-4 py-1 rotate-12 pointer-events-none"
          style={{ opacity: nopeOpacity }}
        >
          <span className="text-red-400 text-3xl font-black tracking-wider">NOPE</span>
        </motion.div>

        {/* Applied badge */}
        {applied && (
          <div className="absolute top-6 left-6 z-20">
            <div className="flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
              <CheckCircle className="h-3.5 w-3.5" />
              Redan sökt
            </div>
          </div>
        )}

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          <h2 className="text-2xl font-bold text-white leading-tight tracking-tight">{job.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Building2 className="w-4 h-4 text-white/80 shrink-0" />
            <span className="text-white/90 font-medium text-base">{job.company_name}</span>
          </div>
          {job.location && (
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="w-4 h-4 text-white/70 shrink-0" />
              <span className="text-white/80 text-sm">{job.location}</span>
            </div>
          )}
        {job.employment_type && (
            <div className="flex items-center gap-2 mt-1">
              <Briefcase className="w-4 h-4 text-white/70 shrink-0" />
              <span className="text-white/80 text-sm">{getEmploymentTypeLabel(job.employment_type)}</span>
            </div>
          )}

          {/* Hint */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-white/40 text-xs">← Skippa · Tryck för mer · Gilla →</span>
          </div>
        </div>
      </motion.div>

      {/* Scroll hint on last card */}
      {isLast && (
        <div className="text-center py-4">
          <span className="text-white/30 text-xs">Inga fler jobb</span>
        </div>
      )}
    </div>
  );
});

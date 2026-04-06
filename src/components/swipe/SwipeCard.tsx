import { useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { supabase } from '@/integrations/supabase/client';

export interface SwipeJob {
  id: string;
  title: string;
  company_name: string;
  location: string;
  employment_type?: string;
  job_image_url?: string;
  image_focus_position?: string;
  views_count: number;
  applications_count: number;
  created_at: string;
  expires_at?: string;
  employer_id?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
}

function resolveImageUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const { data } = supabase.storage.from('job-images').getPublicUrl(url);
  return data?.publicUrl || null;
}

interface CardProps {
  job: SwipeJob;
  isTop: boolean;
  applied: boolean;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSwipeComplete: () => void;
  onTap?: () => void;
  dragEnabled: boolean;
}

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;
const EXIT_X = typeof window !== 'undefined' ? window.innerWidth * 1.5 : 600;

export function SwipeCard({ job, isTop, applied, onSwipeRight, onSwipeLeft, onSwipeComplete, onTap, dragEnabled }: CardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [0, 80, 150], [0, 0.5, 1]);
  const nopeOpacity = useTransform(x, [-150, -80, 0], [1, 0.5, 0]);
  const scale = isTop ? 1 : 0.95;
  const yOffset = isTop ? 0 : 8;

  const imageUrl = resolveImageUrl(job.job_image_url);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { offset, velocity } = info;

    if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      animate(x, EXIT_X, { type: 'spring', stiffness: 600, damping: 30 });
      onSwipeRight();
      setTimeout(onSwipeComplete, 300);
      return;
    }

    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      animate(x, -EXIT_X, { type: 'spring', stiffness: 600, damping: 30 });
      onSwipeLeft();
      setTimeout(onSwipeComplete, 300);
      return;
    }

    animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
  }, [x, onSwipeRight, onSwipeLeft, onSwipeComplete]);

  // Detect tap (no significant drag) via onTap from framer-motion
  const handleTap = useCallback(() => {
    if (isTop && onTap) onTap();
  }, [isTop, onTap]);

  return (
    <motion.div
      className="absolute inset-4 sm:inset-6 rounded-2xl overflow-hidden shadow-2xl"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale,
        y: yOffset,
        zIndex: isTop ? 10 : 5,
        touchAction: 'none',
      }}
      drag={isTop && dragEnabled ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={isTop ? handleDragEnd : undefined}
      onTap={handleTap}
      initial={false}
      animate={{ scale, y: yOffset }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Image / placeholder */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={job.title}
            className="w-full h-full object-cover"
            style={{ objectPosition: `center ${(() => {
              const v = job.image_focus_position;
              if (!v || v === 'center') return '50%';
              if (v === 'top') return '20%';
              if (v === 'bottom') return '80%';
              return `${v}%`;
            })()}` }}
            loading="eager"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)] flex items-center justify-center">
            <span className="text-6xl font-bold text-white/15 select-none">
              {job.company_name
                ? job.company_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                : ''}
            </span>
          </div>
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* LIKE stamp */}
      {isTop && (
        <motion.div
          className="absolute top-8 left-6 z-20 border-4 border-green-400 rounded-lg px-4 py-1 -rotate-12"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-green-400 text-2xl font-black tracking-wider">SÖKA</span>
        </motion.div>
      )}

      {/* NOPE stamp */}
      {isTop && (
        <motion.div
          className="absolute top-8 right-6 z-20 border-4 border-red-400 rounded-lg px-4 py-1 rotate-12"
          style={{ opacity: nopeOpacity }}
        >
          <span className="text-red-400 text-lg font-black tracking-wider">TYCKER INTE OM</span>
        </motion.div>
      )}

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
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
        <p className="text-white/80 font-medium text-sm">{job.company_name}</p>
        <h2 className="text-xl font-bold text-white leading-snug tracking-tight mt-0.5 line-clamp-2">{job.title}</h2>
        <p className="text-white/70 text-sm mt-1.5 truncate">
          {[job.employment_type && getEmploymentTypeLabel(job.employment_type), job.location].filter(Boolean).join(' • ')}
        </p>

        {/* Tap hint */}
        {isTop && (
          <div className="mt-3 text-center">
            <span className="text-white/40 text-xs">Tryck för att se mer</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

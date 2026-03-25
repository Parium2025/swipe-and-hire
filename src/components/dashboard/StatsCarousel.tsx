import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GRADIENTS } from './dashboardConstants';

export type StatData = {
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
  link?: string;
  emptyHint?: string;
};

interface StatsCarouselProps {
  stats: StatData[];
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  /** Whether fresh data has loaded (enables emptyHint display) */
  dataReady?: boolean;
  /** Cached stats exist (enables emptyHint display as fallback) */
  hasCachedData?: boolean;
}

export const StatsCarousel = memo(({ stats, isPaused, setIsPaused, dataReady = false, hasCachedData = false }: StatsCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  // Defensive index guard
  useEffect(() => {
    if (currentIndex >= stats.length && stats.length > 0) {
      setCurrentIndex(0);
    }
  }, [stats.length, currentIndex]);

  const goNext = useCallback(() => { setCurrentIndex(prev => (prev + 1) % stats.length); }, [stats.length]);
  const goPrev = useCallback(() => { setCurrentIndex(prev => (prev - 1 + stats.length) % stats.length); }, [stats.length]);
  const swipeHandlers = useSwipeGesture({ onSwipeLeft: goNext, onSwipeRight: goPrev });

  // Auto-rotation every 10s — identical to news card
  useEffect(() => {
    if (isPaused || stats.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % stats.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [isPaused, stats.length]);

  const currentStat = stats[currentIndex];
  if (!currentStat) return null;
  const Icon = currentStat.icon;
  const showEmptyHint = currentStat.value === 0 && currentStat.emptyHint && (dataReady || hasCachedData);

  return (
    <Card
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.stats} border-0 shadow-lg dashboard-card-height touch-pan-y`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={(e) => { setIsPaused(true); swipeHandlers.onTouchStart(e); }}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={() => { swipeHandlers.onTouchEnd(); setTimeout(() => setIsPaused(false), 3000); }}
    >
      <div className="absolute inset-0 bg-white/5" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />

      <CardContent className="relative p-4 sm:p-4 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">MIN STATISTIK</span>
        </div>

        <div
          className={cn("flex-1 flex flex-col items-center justify-center text-center py-2", currentStat.link && "cursor-pointer")}
          onClick={() => currentStat.link && navigate(currentStat.link)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentIndex}
              initial={hasMountedRef.current ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
              onAnimationComplete={() => { hasMountedRef.current = true; }}
            >
              <h3 className="text-sm sm:text-base font-semibold text-white leading-snug mb-1">{currentStat.label}</h3>
              <div className="text-3xl font-bold text-white">{currentStat.value}</div>
              {showEmptyHint && (
                <p className="text-xs text-white mt-1">{currentStat.emptyHint}</p>
              )}
              {currentStat.value === 0 && !currentStat.emptyHint && (
                <p className="text-xs text-white mt-1">{currentStat.description}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="h-6 flex items-center justify-center mt-auto shrink-0">
          <div className="flex items-center gap-1.5">
            {stats.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full touch-manipulation transition-none",
                  i === currentIndex ? "bg-white" : "bg-white/30"
                )}
                aria-label={`Gå till statistik ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

StatsCarousel.displayName = 'StatsCarousel';

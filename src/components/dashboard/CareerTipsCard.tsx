import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, Newspaper, Clock, ExternalLink, Sparkles } from 'lucide-react';
import { useCareerTips } from '@/hooks/useCareerTips';
import { TruncatedText } from '@/components/TruncatedText';
import { useCardInteractionPause } from '@/hooks/useCardInteractionPause';
import { useSynchronizedRotation } from '@/hooks/useSynchronizedRotation';
import { GRADIENTS, formatTipPublishedTime } from './dashboardConstants';
import { DashboardCarouselDots } from './DashboardCarouselDots';

interface CareerTipsCardProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
}

export const CareerTipsCard = memo(({ isPaused, setIsPaused }: CareerTipsCardProps) => {
  const { data: tips, isLoading, error } = useCareerTips();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { pauseNow, resumeNow, resumeWithDelay } = useCardInteractionPause({ setIsPaused });
  
  const tipsItems = tips?.slice(0, 4) || [];

  // Guard against stale index after data refetch
  useEffect(() => {
    if (tipsItems.length > 0 && currentIndex >= tipsItems.length) {
      setCurrentIndex(0);
    }
  }, [tipsItems.length, currentIndex]);

  const goNext = useCallback(() => {
    if (tipsItems.length > 1) {
      setCurrentIndex(prev => (prev + 1) % tipsItems.length);
    }
  }, [tipsItems.length]);

  const goPrev = useCallback(() => {
    if (tipsItems.length > 1) {
      setCurrentIndex(prev => (prev - 1 + tipsItems.length) % tipsItems.length);
    }
  }, [tipsItems.length]);

  useSynchronizedRotation({
    enabled: tipsItems.length > 1 && !isPaused,
    intervalMs: 10000,
    offsetMs: 0,
    onTick: goNext,
  });

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.tips} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5" />
        <CardContent className="relative p-6 h-full">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
            <Skeleton className="h-4 w-32 bg-white/20" />
          </div>
          <Skeleton className="h-16 w-full bg-white/10 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error || !tips || tips.length === 0) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.tips} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5" />
        <CardContent className="relative p-4 h-full flex flex-col items-center justify-center">
          <Lightbulb className="h-8 w-8 text-white mb-2" />
          <p className="text-sm text-white text-center">
            Karriärtips laddas...
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentTip = tipsItems[currentIndex];

  return (
    <Card 
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.tips} border-0 shadow-lg dashboard-card-height touch-pan-y`}
      onMouseEnter={pauseNow}
      onMouseLeave={resumeNow}
      onTouchStart={(e) => { pauseNow(); swipeHandlers.onTouchStart(e); }}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={() => { swipeHandlers.onTouchEnd(); resumeWithDelay(); }}
      onTouchCancel={resumeWithDelay}
    >
      <div className="absolute inset-0 bg-white/5" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-4 sm:p-4 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Newspaper className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">
            NYHETER
          </span>
        </div>
        
        {/* News content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-3 sm:pt-4">
          <AnimatePresence mode="wait" initial={false}>
            {currentTip ? (
              <motion.div
                key={currentTip.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => currentTip.source_url && window.open(currentTip.source_url, '_blank', 'noopener,noreferrer')}
                className={`w-full flex flex-col overflow-hidden ${currentTip.source_url ? 'cursor-pointer group' : ''}`}
              >
                <TruncatedText
                  text={currentTip.title}
                  className="h-[39px] text-sm font-semibold text-white leading-snug mb-2.5 sm:mb-3 line-clamp-2"
                />
                <TruncatedText
                  text={currentTip.summary || currentTip.title}
                  lines={2}
                  className="h-[36px] text-sm leading-[18px] text-white"
                />
              </motion.div>
            ) : (
              <p className="text-xs text-white text-center">Inga nyheter just nu</p>
            )}
          </AnimatePresence>
        </div>

        {/* Footer: Läs mer · källa | dots | datum */}
        <div className="mt-auto flex items-center justify-between gap-2 shrink-0 h-6">
          <div className="flex-1 min-w-0">
            {currentTip?.source_url ? (
              <div className="flex items-center gap-1.5 text-white min-w-0 overflow-hidden whitespace-nowrap">
                <span className="text-xs shrink-0">Läs mer</span>
                <span className="text-[10px] text-white truncate">· {currentTip.source}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </div>
            ) : currentTip ? (
              <div
                className="flex items-center gap-1 text-white/90 min-w-0 overflow-hidden whitespace-nowrap"
                title="Denna text är genererad av vår AI-karriärcoach när inga aktuella RSS-artiklar finns tillgängliga."
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="text-[10px] font-medium truncate">AI-genererad</span>
              </div>
            ) : null}
          </div>
          <div className="shrink-0">
            <DashboardCarouselDots count={tipsItems.length} currentIndex={currentIndex} onSelect={setCurrentIndex} label="Gå till nyhet" />
          </div>
          <div className="flex-1 min-w-0 flex justify-end">
            {currentTip?.published_at && (
              <div className="flex items-center gap-1 text-white text-[10px] leading-none whitespace-nowrap">
                <Clock className="h-3 w-3 shrink-0" />
                <span>{formatTipPublishedTime(currentTip.published_at)}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CareerTipsCard.displayName = 'CareerTipsCard';

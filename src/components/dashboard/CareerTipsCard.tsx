import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, Newspaper, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCareerTips } from '@/hooks/useCareerTips';
import { GRADIENTS, formatTipPublishedTime } from './dashboardConstants';

interface CareerTipsCardProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
}

export const CareerTipsCard = memo(({ isPaused, setIsPaused }: CareerTipsCardProps) => {
  const { data: tips, isLoading, error } = useCareerTips();
  const [currentIndex, setCurrentIndex] = useState(0);
  
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

  // Auto-rotation every 10 seconds (pauses on hover)
  useEffect(() => {
    if (tipsItems.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % tipsItems.length);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [tipsItems.length, isPaused]);

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
          <Lightbulb className="h-8 w-8 text-white/60 mb-2" />
          <p className="text-sm text-white/60 text-center">
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
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={(e) => { setIsPaused(true); swipeHandlers.onTouchStart(e); }}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={() => { swipeHandlers.onTouchEnd(); setTimeout(() => setIsPaused(false), 3000); }}
    >
      <div className="absolute inset-0 bg-white/5" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-4 sm:p-4 h-full flex flex-col">
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
        <div className="flex-1 flex flex-col justify-center py-2">
          <AnimatePresence mode="wait">
            {currentTip ? (
              <motion.div
                key={currentTip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onClick={() => currentTip.source_url && window.open(currentTip.source_url, '_blank', 'noopener,noreferrer')}
                className={currentTip.source_url ? 'cursor-pointer group' : ''}
              >
                <h3 className="text-xs sm:text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">
                  {currentTip.title}
                </h3>
                <p className="text-xs text-white line-clamp-1 mb-1">
                  {currentTip.summary || currentTip.title}
                </p>
                {currentTip.published_at && (
                  <div className="flex items-center gap-1.5 text-white text-[10px] mb-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatTipPublishedTime(currentTip.published_at)}</span>
                  </div>
                )}
                {currentTip.source_url && (
                  <div className="flex items-center gap-1.5 text-white transition-colors">
                    <span className="text-xs">Läs mer</span>
                    <span className="text-[10px] text-white">· {currentTip.source}</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="text-xs text-white/60 text-center">Inga nyheter just nu</p>
            )}
          </AnimatePresence>
        </div>
        
        {/* Footer with dots - centered */}
        <div className="h-6 flex items-center justify-center mt-auto shrink-0">
          {tipsItems.length > 1 && (
            <div className="flex items-center gap-1.5">
              {tipsItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full touch-manipulation transition-none",
                    i === currentIndex ? "bg-white" : "bg-white/30"
                  )}
                  aria-label={`Gå till nyhet ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

CareerTipsCard.displayName = 'CareerTipsCard';

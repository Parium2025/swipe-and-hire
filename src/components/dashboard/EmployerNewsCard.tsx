import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHrNews } from '@/hooks/useHrNews';
import { useCardInteractionPause } from '@/hooks/useCardInteractionPause';
import { useSynchronizedRotation } from '@/hooks/useSynchronizedRotation';
import { GRADIENTS } from './dashboardConstants';
...
  useSynchronizedRotation({
    enabled: newsItems.length > 1 && !isPaused,
    intervalMs: 10000,
    offsetMs: 0,
    onTick: goNext,
  });
  }, [newsItems.length, isPaused]);

  const swipeHandlers = useSwipeGesture({ onSwipeLeft: goNext, onSwipeRight: goPrev });

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.tips} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
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

  const currentNews = newsItems[currentIndex];

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

      <CardContent className="relative p-4 sm:p-4 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Newspaper className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">NYHETER</span>
        </div>

        <div className="flex-1 flex flex-col justify-center py-2">
          <AnimatePresence mode="wait">
            {currentNews ? (
              <motion.div
                key={currentNews.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onClick={() => currentNews.source_url && window.open(currentNews.source_url, '_blank', 'noopener,noreferrer')}
                className={currentNews.source_url ? 'cursor-pointer group' : ''}
              >
                <h3 className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">{currentNews.title}</h3>
                <p className="text-sm text-white line-clamp-1 mb-1">{currentNews.summary || currentNews.title}</p>
                {currentNews.published_at && (
                  <div className="flex items-center gap-1.5 text-white text-[10px] mb-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatNewsTime(currentNews.published_at)}</span>
                  </div>
                )}
                {currentNews.source_url && (
                  <div className="flex items-center gap-1.5 text-white transition-colors">
                    <span className="text-xs">Läs mer</span>
                    <span className="text-[10px] text-white">· {currentNews.source}</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="text-xs text-white/60 text-center">Inga nyheter just nu</p>
            )}
          </AnimatePresence>
        </div>

        <div className="h-6 flex items-center justify-center mt-auto shrink-0">
          {newsItems.length > 1 && (
            <div className="flex items-center gap-1.5">
              {newsItems.map((_, i) => (
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

EmployerNewsCard.displayName = 'EmployerNewsCard';

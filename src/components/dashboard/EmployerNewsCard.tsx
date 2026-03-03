import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHrNews } from '@/hooks/useHrNews';
import { GRADIENTS } from './dashboardConstants';

// Format relative time for news
const formatNewsTime = (publishedAt: string | null): string => {
  if (!publishedAt) return '';
  try {
    const date = new Date(publishedAt);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const newsDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    if (newsDay.getTime() === today.getTime()) return `idag ${timeStr}`;
    if (newsDay.getTime() === yesterday.getTime()) return `igår ${timeStr}`;
    return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

interface EmployerNewsCardProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
}

export const EmployerNewsCard = memo(({ isPaused, setIsPaused }: EmployerNewsCardProps) => {
  const { data: news, isLoading } = useHrNews();
  const [currentIndex, setCurrentIndex] = useState(0);
  const newsItems = news?.slice(0, 4) || [];

  // Guard against stale index after data refetch
  useEffect(() => {
    if (newsItems.length > 0 && currentIndex >= newsItems.length) {
      setCurrentIndex(0);
    }
  }, [newsItems.length, currentIndex]);

  const goNext = useCallback(() => {
    if (newsItems.length > 1) setCurrentIndex(prev => (prev + 1) % newsItems.length);
  }, [newsItems.length]);

  const goPrev = useCallback(() => {
    if (newsItems.length > 1) setCurrentIndex(prev => (prev - 1 + newsItems.length) % newsItems.length);
  }, [newsItems.length]);

  useEffect(() => {
    if (newsItems.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % newsItems.length);
    }, 10000);
    return () => clearInterval(interval);
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
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
      {...swipeHandlers}
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
                <h3 className="text-xs sm:text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">{currentNews.title}</h3>
                <p className="text-xs text-white line-clamp-1 mb-1">{currentNews.summary || currentNews.title}</p>
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

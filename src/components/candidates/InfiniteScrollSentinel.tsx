import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollSentinelProps {
  onIntersect?: () => void;
  isLoading?: boolean;
}

export function InfiniteScrollSentinel({ onIntersect, isLoading }: InfiniteScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onIntersect) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          onIntersect();
        }
      },
      { rootMargin: '200px' }
    );

    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [onIntersect, isLoading]);

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar fler kandidater...</span>
        </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface SkeletonCardProps {
  className?: string;
  variant?: 'default' | 'job' | 'message' | 'candidate';
}

/**
 * 🚀 PREMIUM SKELETON CARDS
 * 
 * Visar omedelbart medan data laddas för "instant" känsla.
 * Animeras subtilt för att indikera loading utan att vara störande.
 */

export function SkeletonCard({ className, variant = 'default' }: SkeletonCardProps) {
  if (variant === 'job') {
    return (
      <div className={cn("rounded-xl border bg-card p-4 space-y-3", className)}>
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    );
  }
  
  if (variant === 'message') {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg", className)}>
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    );
  }
  
  if (variant === 'candidate') {
    return (
      <div className={cn("rounded-xl border bg-card p-4", className)}>
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
    );
  }
  
  // Default variant
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

/**
 * Lista av skeleton-kort för loading states
 */
export function SkeletonList({ 
  count = 3, 
  variant = 'default',
  className 
}: { 
  count?: number; 
  variant?: SkeletonCardProps['variant'];
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  );
}

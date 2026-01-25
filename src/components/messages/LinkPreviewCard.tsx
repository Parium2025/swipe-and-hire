import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LinkPreview, useLinkPreview } from '@/hooks/useLinkPreview';
import { Skeleton } from '@/components/ui/skeleton';

interface LinkPreviewCardProps {
  url: string;
  isOwn: boolean;
}

export function LinkPreviewCard({ url, isOwn }: LinkPreviewCardProps) {
  const { data: preview, isLoading, isError } = useLinkPreview(url);

  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Don't show anything if error or no data
  if (isError) return null;

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(
        "mt-2 rounded-lg overflow-hidden border",
        isOwn ? "border-blue-500/30 bg-blue-500/10" : "border-white/10 bg-white/5"
      )}>
        <div className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4 bg-white/10" />
          <Skeleton className="h-3 w-full bg-white/10" />
          <Skeleton className="h-3 w-1/2 bg-white/10" />
        </div>
      </div>
    );
  }

  // No preview available
  if (!preview || (!preview.title && !preview.description && !preview.image_url)) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "mt-2 w-full text-left rounded-lg overflow-hidden border transition-all",
        "hover:opacity-90 active:scale-[0.99]",
        isOwn 
          ? "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15" 
          : "border-white/10 bg-white/5 hover:bg-white/10"
      )}
    >
      {/* Image */}
      {preview.image_url && (
        <div className="relative w-full h-32 overflow-hidden bg-black/20">
          <img
            src={preview.image_url}
            alt={preview.title || 'Link preview'}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Hide image on error
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {/* Site name / domain */}
        <div className="flex items-center gap-2 mb-1">
          {preview.favicon_url && (
            <img
              src={preview.favicon_url}
              alt=""
              className="w-4 h-4 rounded"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span className="text-white/60 text-xs truncate">
            {preview.site_name || new URL(url).hostname}
          </span>
          <ExternalLink className="h-3 w-3 text-white/40 ml-auto flex-shrink-0" />
        </div>

        {/* Title */}
        {preview.title && (
          <h4 className="text-white text-sm font-medium line-clamp-2 mb-1">
            {preview.title}
          </h4>
        )}

        {/* Description */}
        {preview.description && (
          <p className="text-white/60 text-xs line-clamp-2">
            {preview.description}
          </p>
        )}
      </div>
    </button>
  );
}

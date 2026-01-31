import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { cn } from '@/lib/utils';

interface ResolvedAvatarProps {
  /** Storage path OR full URL. Will auto-detect and handle accordingly. */
  src: string | null | undefined;
  /** Type of media for storage path resolution */
  mediaType?: 'profile-image' | 'company-logo';
  /** Fallback content (initials or icon) */
  fallback: React.ReactNode;
  /** Size class (h-X w-X) */
  className?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Delay before showing fallback (prevents flicker for cached images) */
  delayMs?: number;
  /** Additional fallback className */
  fallbackClassName?: string;
}

/**
 * Avatar component that automatically resolves storage paths to signed URLs.
 * If src is already a full URL (https://...), it uses it directly.
 * If src is a storage path, it converts it via useMediaUrl.
 * 
 * This eliminates the need to manually handle URL resolution in every component.
 */
export function ResolvedAvatar({
  src,
  mediaType = 'profile-image',
  fallback,
  className,
  alt,
  delayMs = 150,
  fallbackClassName,
}: ResolvedAvatarProps) {
  // Check if src is already a full URL (not a storage path)
  const isFullUrl = src?.startsWith('http://') || src?.startsWith('https://') || src?.startsWith('blob:');
  
  // Only use useMediaUrl if it's a storage path
  const resolvedFromStorage = useMediaUrl(
    isFullUrl ? null : src, 
    mediaType
  );
  
  // Use direct URL if it's already full, otherwise use resolved URL
  const finalUrl = isFullUrl ? src : resolvedFromStorage;

  return (
    <Avatar className={className}>
      <AvatarImage src={finalUrl || ''} alt={alt} />
      <AvatarFallback 
        className={cn("bg-white/20 text-white", fallbackClassName)} 
        delayMs={delayMs}
      >
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useResolvedAvatarUrl } from '@/hooks/useResolvedAvatarUrl';
import { CHAT_AVATAR_TRANSFORM } from '@/lib/mediaPresets';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';
import { getCompanyInitials } from '@/lib/companyInitials';
import type { ConversationProfileData as ProfileData } from '@/types/conversation';

interface ConversationAvatarProps {
  profile: ProfileData | null | undefined;
  isGroup?: boolean;
  groupName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fallbackClassName?: string;
}

/**
 * Avatar component for conversations that properly resolves storage paths.
 * Handles both individual profiles and group conversations.
 */
export function ConversationAvatar({
  profile,
  isGroup = false,
  groupName,
  size = 'md',
  className,
  fallbackClassName,
}: ConversationAvatarProps) {
  // Avatarer i meddelandelistan är små (32-48px) → be om optimerad version
  // En gemensam transform för alla storlekar → prefetch och render delar cache-nyckel
  const resolvedUrl = useResolvedAvatarUrl(profile, CHAT_AVATAR_TRANSFORM);

  const getInitials = () => {
    if (isGroup && groupName) {
      return groupName.substring(0, 2).toUpperCase();
    }
    if (!profile) return '··';
    if (profile.role === 'employer' && profile.company_name) {
      return getCompanyInitials(profile.company_name);
    }
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '··';
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  if (isGroup) {
    return (
      <div className={cn(
        sizeClasses[size],
        "rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/20 flex items-center justify-center",
        className
      )}>
        <Users className={cn(
          "text-pure-white",
          size === 'sm' && "h-4 w-4",
          size === 'md' && "h-5 w-5",
          size === 'lg' && "h-6 w-6"
        )} />
      </div>
    );
  }

  // Permanenta lager: initialer och bildyta ligger alltid kvar. Radix
  // AvatarImage monterade om bilden vid varje besök och visade initialer
  // först — det upplevdes som att loggan "laddades om" varje gång.
  const hasImageUrl = !!resolvedUrl;
  const isReady = hasImageUrl && (loadedAvatarUrls.has(resolvedUrl!) || resolvedUrl!.startsWith('blob:'));
  const [loaded, setLoaded] = useState(isReady);

  useEffect(() => {
    setLoaded(hasImageUrl && (loadedAvatarUrls.has(resolvedUrl!) || resolvedUrl!.startsWith('blob:')));
  }, [resolvedUrl, hasImageUrl]);

  return (
    <div
      className={cn(
        sizeClasses[size],
        'relative shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10 flex items-center justify-center',
        className,
      )}
    >
      <span
        className={cn(
          'text-pure-white font-medium',
          size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base',
          fallbackClassName,
        )}
      >
        {getInitials()}
      </span>
      <img
        src={resolvedUrl || TRANSPARENT_PIXEL}
        alt=""
        aria-hidden="true"
        decoding="sync"
        className={cn(
          'absolute inset-0 h-full w-full object-cover',
          loaded && hasImageUrl ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={() => {
          if (resolvedUrl) loadedAvatarUrls.add(resolvedUrl);
          setLoaded(true);
        }}
        onError={() => setLoaded(false)}
      />
    </div>
  );
}


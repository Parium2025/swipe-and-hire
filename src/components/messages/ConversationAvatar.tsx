import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useResolvedAvatarUrl } from '@/hooks/useResolvedAvatarUrl';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';
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
  const sizePx = size === 'sm' ? 32 : size === 'md' ? 40 : 48;
  const resolvedUrl = useResolvedAvatarUrl(profile, { width: sizePx, height: sizePx, resize: 'cover' });

  const getInitials = () => {
    if (isGroup && groupName) {
      return groupName.substring(0, 2).toUpperCase();
    }
    if (!profile) return '··';
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name.substring(0, 2).toUpperCase();
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

  // Only delay fallback if there's an actual image URL to wait for
  const hasImageUrl = !!resolvedUrl;

  return (
    <Avatar className={cn(sizeClasses[size], 'border border-white/10', className)}>
      <AvatarImage src={resolvedUrl || ''} />
      <AvatarFallback 
        className={cn("bg-white/10 text-pure-white", fallbackClassName)} 
        delayMs={hasImageUrl ? 150 : 0}
      >
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}

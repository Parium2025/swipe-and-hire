import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useResolvedAvatarUrl } from '@/hooks/useResolvedAvatarUrl';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface ProfileData {
  role?: 'job_seeker' | 'employer';
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  profile_image_url?: string | null;
  company_logo_url?: string | null;
}

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
  // Resolve the avatar URL
  const resolvedUrl = useResolvedAvatarUrl(profile);

  const getInitials = () => {
    if (isGroup && groupName) {
      return groupName.substring(0, 2).toUpperCase();
    }
    if (!profile) return '?';
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name.substring(0, 2).toUpperCase();
    }
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
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
          "text-white/80",
          size === 'sm' && "h-4 w-4",
          size === 'md' && "h-5 w-5",
          size === 'lg' && "h-6 w-6"
        )} />
      </div>
    );
  }

  return (
    <Avatar className={cn(sizeClasses[size], 'border border-white/10', className)} style={{ contain: 'layout style paint' }}>
      <AvatarImage src={resolvedUrl || ''} loading="lazy" />
      <AvatarFallback 
        className={cn("bg-white/10 text-white", fallbackClassName)} 
        delayMs={150}
      >
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}

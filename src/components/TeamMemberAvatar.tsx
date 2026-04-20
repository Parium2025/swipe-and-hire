import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useResolvedTeamMemberUrl } from '@/hooks/useResolvedAvatarUrl';
import { cn } from '@/lib/utils';

interface TeamMemberAvatarProps {
  profileImageUrl: string | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * Avatar component for team members that properly resolves storage paths.
 */
function TeamMemberAvatarBase({
  profileImageUrl,
  firstName,
  lastName,
  size = 'sm',
  className,
}: TeamMemberAvatarProps) {
  const sizeClasses = {
    xs: 'h-5 w-5',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
  };

  const sizePx = {
    xs: 20,
    sm: 32,
    md: 40,
  };

  const textSizes = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
  };

  // Be Supabase om en bild i exakt rätt storlek (2x för retina automatiskt)
  const resolvedUrl = useResolvedTeamMemberUrl(profileImageUrl, {
    width: sizePx[size],
    height: sizePx[size],
    resize: 'cover',
  });
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={resolvedUrl || ''} />
      <AvatarFallback className={cn("bg-white/20 text-white", textSizes[size])} delayMs={150}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export const TeamMemberAvatar = React.memo(TeamMemberAvatarBase, (prev, next) => {
  return (
    prev.profileImageUrl === next.profileImageUrl &&
    prev.firstName === next.firstName &&
    prev.lastName === next.lastName &&
    prev.size === next.size &&
    prev.className === next.className
  );
});

export default TeamMemberAvatar;

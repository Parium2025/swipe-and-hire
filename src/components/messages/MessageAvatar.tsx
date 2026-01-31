import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { cn } from '@/lib/utils';

interface SenderProfile {
  role: 'job_seeker' | 'employer';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  profile_image_url: string | null;
  company_logo_url: string | null;
}

interface MessageAvatarProps {
  senderProfile: SenderProfile;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Avatar component for messaging that properly resolves signed URLs
 * for both profile images and company logos stored in Supabase storage.
 */
export function MessageAvatar({ senderProfile, size = 'md', className }: MessageAvatarProps) {
  const isEmployer = senderProfile.role === 'employer';
  
  // Get the storage path based on role
  // Company logos are in 'company-logos' bucket, profile images in 'job-applications'
  const isEmployerWithLogo = isEmployer && senderProfile.company_logo_url;
  const storagePath = isEmployerWithLogo
    ? senderProfile.company_logo_url
    : senderProfile.profile_image_url;
  
  // Resolve signed URL from storage path
  // Company logos are public, profile images need signed URLs
  const resolvedUrl = useMediaUrl(storagePath, isEmployerWithLogo ? 'company-logo' : 'profile-image');
  
  const getInitials = () => {
    if (isEmployer && senderProfile.company_name) {
      return senderProfile.company_name.substring(0, 2).toUpperCase();
    }
    const first = senderProfile.first_name?.[0] || '';
    const last = senderProfile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  return (
    <Avatar className={cn(sizeClasses[size], 'border border-white/10', className)}>
      <AvatarImage src={resolvedUrl || ''} />
      <AvatarFallback 
        className={cn(
          "bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-white",
          size === 'sm' && "text-xs",
          size === 'md' && "text-sm",
          size === 'lg' && "text-base"
        )} 
        delayMs={150}
      >
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}

import { useMediaUrl } from '@/hooks/useMediaUrl';

interface ProfileLike {
  role?: 'job_seeker' | 'employer';
  profile_image_url?: string | null;
  company_logo_url?: string | null;
}

/**
 * Hook that automatically resolves the correct avatar URL for any profile.
 * - For employers with company logos: returns the logo URL (public, no resolution needed)
 * - For job seekers or employers without logo: resolves the storage path to a signed URL
 * 
 * This eliminates the need to manually handle URL resolution everywhere.
 */
export function useResolvedAvatarUrl(profile: ProfileLike | null | undefined): string | null {
  const isEmployerWithLogo = profile?.role === 'employer' && profile?.company_logo_url;
  
  // Company logos are public URLs - use directly
  // Profile images are storage paths - need resolution
  const storagePath = isEmployerWithLogo ? null : (profile?.profile_image_url || null);
  
  const resolvedProfileImageUrl = useMediaUrl(storagePath, 'profile-image');
  
  if (isEmployerWithLogo) {
    return profile.company_logo_url ?? null;
  }
  
  return resolvedProfileImageUrl;
}

/**
 * Hook for resolving a team member's profile image URL.
 * Team member profileImageUrl is always a storage path that needs resolution.
 */
export function useResolvedTeamMemberUrl(profileImageUrl: string | null | undefined): string | null {
  return useMediaUrl(profileImageUrl, 'profile-image');
}

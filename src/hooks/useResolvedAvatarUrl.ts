import { useMediaUrl } from '@/hooks/useMediaUrl';
import type { ImageTransformOptions } from '@/lib/mediaManager';
import type { ConversationProfileData as ProfileLike } from '@/types/conversation';

/**
 * Hook that automatically resolves the correct avatar URL for any profile.
 * - For employers with company logos: returns the logo URL (public, no resolution needed)
 * - For job seekers or employers without logo: resolves the storage path to a signed URL
 * 
 * Optionally accepts a transform hint (width/height in CSS px) to request a smaller
 * variant from Supabase Image Transformations. No visual change — just smaller files.
 */
export function useResolvedAvatarUrl(
  profile: ProfileLike | null | undefined,
  transform?: ImageTransformOptions
): string | null {
  const isEmployerWithLogo = profile?.role === 'employer' && profile?.company_logo_url;
  
  // Company logos are public URLs - use directly
  // Profile images are storage paths - need resolution
  const storagePath = isEmployerWithLogo ? null : (profile?.profile_image_url || null);
  
  const resolvedProfileImageUrl = useMediaUrl(storagePath, 'profile-image', 86400, transform);
  
  if (isEmployerWithLogo) {
    return profile.company_logo_url ?? null;
  }
  
  return resolvedProfileImageUrl;
}

/**
 * Hook for resolving a team member's profile image URL.
 * Team member profileImageUrl is always a storage path that needs resolution.
 */
export function useResolvedTeamMemberUrl(
  profileImageUrl: string | null | undefined,
  transform?: ImageTransformOptions
): string | null {
  return useMediaUrl(profileImageUrl, 'profile-image', 86400, transform);
}

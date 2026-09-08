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
  const companyLogo =
    profile?.role === 'employer' && profile?.company_logo_url ? profile.company_logo_url : null;

  // Företagsloggan går genom SAMMA väg som profilbilder (cache i minne +
  // blob-cache + förladdning). Tidigare returnerades den råa publika URL:en
  // direkt, vilket gjorde att loggan alltid laddades om vid kallstart medan
  // profilbilder redan låg varma i cachen.
  const storagePath = companyLogo ?? profile?.profile_image_url ?? null;
  const mediaType = companyLogo ? 'company-logo' : 'profile-image';

  // Loggor prefetchas utan transform → dela exakt samma cache-nyckel.
  const resolvedUrl = useMediaUrl(
    storagePath,
    mediaType,
    86400,
    companyLogo ? undefined : transform
  );

  if (companyLogo) return resolvedUrl ?? companyLogo;

  return resolvedUrl;
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

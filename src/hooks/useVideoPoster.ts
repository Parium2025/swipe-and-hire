import { useMediaUrl } from '@/hooks/useMediaUrl';
import { getVideoPosterPath } from '@/lib/mediaManager';

/**
 * Signerad URL till en videos automatgenererade posterbild (~20 kB JPEG).
 *
 * Postern skapas vid uppladdning och ligger bredvid videon i samma bucket.
 * Saknas den (äldre videor) returneras null och anropande UI faller tillbaka
 * på sitt vanliga beteende – exakt samma utseende som tidigare.
 */
export function useVideoPoster(videoPath?: string | null): string | null {
  const posterPath = videoPath ? getVideoPosterPath(videoPath) : undefined;
  return useMediaUrl(posterPath, 'profile-image');
}

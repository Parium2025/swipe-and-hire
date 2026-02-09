import { useDevice } from '@/hooks/use-device';

/**
 * Derives from useDevice() so that mobile/desktop detection is always in sync
 * with the layout hook. This prevents the sidebar from flipping independently
 * of the main layout during transient resize events (e.g. iOS address bar).
 */
export function useIsMobile(): boolean {
  return useDevice() === 'mobile';
}

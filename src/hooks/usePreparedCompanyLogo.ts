import { useMemo } from 'react';
import { useCachedImage } from '@/hooks/useCachedImage';
import { resolveCompanyLogoUrl } from '@/lib/companyLogoUrl';

/**
 * Resolves, preloads and persistently caches the exact company-logo variant
 * used by the UI. Returning the cached blob URL prevents a fallback flash
 * when the same logo appears in another preview or after navigation.
 */
export function usePreparedCompanyLogo(rawUrl: string | null | undefined): string | null {
  const resolvedUrl = useMemo(() => resolveCompanyLogoUrl(rawUrl), [rawUrl]);
  const { cachedUrl } = useCachedImage(resolvedUrl);

  return cachedUrl ?? resolvedUrl;
}
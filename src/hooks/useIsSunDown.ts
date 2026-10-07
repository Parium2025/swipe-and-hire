import { useMemo } from 'react';
import { getCachedLocation, isSunDownAt } from '@/lib/weatherApi';
import { useMinuteTick } from '@/hooks/useMinuteTick';

/**
 * Följer solen på platsen där användaren befinner sig, uppdaterat varje minut.
 * Saknas plats används klockslaget som reserv.
 */
export function useIsSunDown(fallback: boolean, locationKey?: string): boolean {
  const tick = useMinuteTick();
  return useMemo(() => {
    const loc = getCachedLocation();
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return fallback;
    return isSunDownAt(loc.lat, loc.lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, fallback, locationKey]);
}

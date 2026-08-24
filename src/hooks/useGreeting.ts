import { useMemo } from 'react';
import { useMinuteTick } from '@/hooks/useMinuteTick';
import { getSwedishHour } from '@/lib/swedishTime';

export interface Greeting {
  text: string;
  isEvening: boolean;
  isDaytime: boolean;
}

const computeGreeting = (): Greeting => {
  // Alltid svensk tid — hälsningen ska matcha Sverige oavsett enhetens tidszon.
  const hour = getSwedishHour();
  if (hour >= 5 && hour < 10) return { text: 'God morgon', isEvening: false, isDaytime: true };
  if (hour >= 10 && hour < 12) return { text: 'God förmiddag', isEvening: false, isDaytime: true };
  if (hour >= 12 && hour < 17) return { text: 'God eftermiddag', isEvening: false, isDaytime: true };
  if (hour >= 17 && hour < 22) return { text: 'God kväll', isEvening: true, isDaytime: false };
  return { text: 'God natt', isEvening: true, isDaytime: false };
};

/**
 * Reactive greeting driven by the shared minute tick: aligned to the full minute,
 * paused while the tab is hidden and recomputed instantly when it returns
 * (so an app left open overnight never shows a stale "God kväll").
 */
export const useGreeting = (): Greeting => {
  const tick = useMinuteTick();
  return useMemo(() => computeGreeting(), [tick]);
};

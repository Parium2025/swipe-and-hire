import { useMemo } from 'react';
import { useMinuteTick } from '@/hooks/useMinuteTick';
import { getLocalHour } from '@/lib/localTime';

export interface Greeting {
  text: string;
  isEvening: boolean;
  isDaytime: boolean;
}

const computeGreeting = (): Greeting => {
  // Hälsningen följer användarens egen tidszon — är du i New York ska det stå
  // "God morgon" när det är morgon där. (Intervjutider m.m. är alltid svensk tid.)
  const hour = getLocalHour();
  if (hour >= 5 && hour < 10) return { text: 'God morgon', isEvening: false, isDaytime: true };
  if (hour >= 10 && hour < 12) return { text: 'God förmiddag', isEvening: false, isDaytime: true };
  if (hour >= 12 && hour < 18) return { text: 'God eftermiddag', isEvening: false, isDaytime: true };
  if (hour >= 18 && hour < 22) return { text: 'God kväll', isEvening: true, isDaytime: false };
  return { text: 'God natt', isEvening: true, isDaytime: false };
};

/**
 * Reactive greeting driven by the shared minute tick: aligned to the full minute,
 * paused while the tab is hidden and recomputed instantly when it returns
 * (so an app left open overnight never shows a stale "God kväll").
 */
export const useGreeting = (enabled = true): Greeting => {
  const tick = useMinuteTick(enabled);
  return useMemo(() => computeGreeting(), [tick]);
};

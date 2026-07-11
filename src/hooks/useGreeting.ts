import { useEffect, useRef, useState } from 'react';

export interface Greeting {
  text: string;
  isEvening: boolean;
  isDaytime: boolean;
}

const computeGreeting = (): Greeting => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return { text: 'God morgon', isEvening: false, isDaytime: true };
  if (hour >= 10 && hour < 12) return { text: 'God förmiddag', isEvening: false, isDaytime: true };
  if (hour >= 12 && hour < 17) return { text: 'God eftermiddag', isEvening: false, isDaytime: true };
  if (hour >= 17 && hour < 22) return { text: 'God kväll', isEvening: true, isDaytime: false };
  return { text: 'God natt', isEvening: true, isDaytime: false };
};

/**
 * Reactive greeting that ticks on the next full minute and every 60s thereafter.
 * Single source of truth used by JobSeekerHome and EmployerHome.
 */
export const useGreeting = (): Greeting => {
  const [greeting, setGreeting] = useState<Greeting>(() => computeGreeting());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    const syncTimeout = setTimeout(() => {
      setGreeting(computeGreeting());
      intervalRef.current = setInterval(() => setGreeting(computeGreeting()), 60000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(syncTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return greeting;
};

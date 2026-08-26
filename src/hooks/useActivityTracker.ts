import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Minimum interval between activity updates.
// Skalning: vid 100 000 samtidiga användare blir varje minskning här en direkt
// minskning av skrivlasten på `profiles`. 15 min ger fortfarande korrekt
// "senast aktiv"-precision för inaktivitetsflödet (som räknar i dagar).
const UPDATE_INTERVAL_MS = 15 * 60 * 1000;
const storageKey = (userId: string) => `parium_last_active_${userId}`;

export function useActivityTracker() {
  const { user } = useAuth();
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!user?.id) return;

    // Persistera över omladdningar — annars skriver varje reload en ny rad-uppdatering.
    try {
      const stored = Number(localStorage.getItem(storageKey(user.id)) || 0);
      if (Number.isFinite(stored) && stored > lastUpdateRef.current) lastUpdateRef.current = stored;
    } catch { /* storage kan vara blockerad */ }

    const updateActivity = async () => {
      const now = Date.now();

      // Only update if enough time has passed
      if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) {
        return;
      }
      // Skriv aldrig i bakgrundsflik — sparar onödig last vid massuppvaknande.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      lastUpdateRef.current = now;
      try { localStorage.setItem(storageKey(user.id), String(now)); } catch { /* ignore */ }

      try {
        await supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Failed to update activity:', error);
      }
    };

    // Update immediately on mount
    updateActivity();

    // Update on visibility change (user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    };

    // Update on user interaction
    const handleActivity = () => {
      updateActivity();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleActivity);
    
    // Periodic update while active
    const interval = setInterval(updateActivity, UPDATE_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleActivity);
      clearInterval(interval);
    };
  }, [user?.id]);
}

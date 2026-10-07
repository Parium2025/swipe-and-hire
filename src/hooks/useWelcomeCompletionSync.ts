import { useEffect, useRef } from 'react';
import { isWelcomeCompleted, welcomeCompletionKey } from '@/lib/welcomeCompletion';

/** Active guides check the server across devices; no auth sync or page reload. */
export function useWelcomeCompletionSync(userId: string | undefined, disabled: boolean, onCompleted: () => Promise<void> | void) {
  const completedRef = useRef(onCompleted);
  completedRef.current = onCompleted;
  useEffect(() => {
    if (!userId || disabled) return;
    let cancelled = false;
    let checking = false;
    let pending = false;
    let finished = false;
    const check = async () => {
      if (cancelled || finished || document.visibilityState !== 'visible' || navigator.onLine === false) return;
      if (checking) { pending = true; return; }
      checking = true;
      try {
        if (await isWelcomeCompleted(userId) && !cancelled) {
          await completedRef.current();
          finished = true;
        }
      } catch { /* Keep the draft offline; saving remains authoritative. */ }
      finally {
        checking = false;
        if (pending && !cancelled && !finished) { pending = false; void check(); }
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.newValue && (event.key === welcomeCompletionKey(userId) || event.key === `parium_employer_welcome_completed:${userId}`)) void check();
    };
    const onReturn = () => { void check(); };
    const interval = window.setInterval(onReturn, 10000);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    void check();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [userId, disabled]);
}
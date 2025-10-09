import { useState, useCallback } from 'react';

export const useIntroSeen = () => {
  const [hasSeenIntro, setHasSeenIntro] = useState(() => {
    try {
      return sessionStorage.getItem('parium-intro-seen') === 'true';
    } catch {
      return false;
    }
  });

  const markIntroAsSeen = useCallback(() => {
    try {
      sessionStorage.setItem('parium-intro-seen', 'true');
      setHasSeenIntro(true);
    } catch {
      // Fallback if sessionStorage is not available
      setHasSeenIntro(true);
    }
  }, []);

  const resetIntro = useCallback(() => {
    try {
      sessionStorage.removeItem('parium-intro-seen');
      setHasSeenIntro(false);
    } catch {
      setHasSeenIntro(false);
    }
  }, []);

  return { hasSeenIntro, markIntroAsSeen, resetIntro };
};

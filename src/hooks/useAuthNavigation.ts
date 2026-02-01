import { useNavigate, NavigateOptions } from 'react-router-dom';
import { useCallback } from 'react';
import { authSplashEvents } from '@/lib/authSplashEvents';

interface AuthNavigationState {
  mode?: 'login' | 'register';
  role?: 'job_seeker' | 'employer';
}

/**
 * Hook för att navigera till /auth med splash-skärm.
 * 
 * Användning:
 * const { navigateToAuth } = useAuthNavigation();
 * navigateToAuth(); // Visa splash, sen navigera
 * navigateToAuth({ mode: 'register', role: 'employer' });
 */
export function useAuthNavigation() {
  const navigate = useNavigate();
  
  const navigateToAuth = useCallback((
    state?: AuthNavigationState,
    options?: NavigateOptions
  ) => {
    // Trigga splash FÖRST
    authSplashEvents.show();
    
    // Navigera efter en kort fördröjning så splash hinner visa sig
    // (React behöver en render-cykel för att visa splash)
    requestAnimationFrame(() => {
      navigate('/auth', {
        ...options,
        state: state || options?.state,
      });
    });
  }, [navigate]);
  
  return { navigateToAuth };
}

/**
 * Enkel funktion för att trigga splash utan hook.
 * Användbar i event handlers där hooks inte fungerar.
 */
export function triggerAuthSplash() {
  authSplashEvents.show();
}

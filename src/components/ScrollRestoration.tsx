import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Custom ScrollRestoration component for BrowserRouter.
 * Restores scroll position when navigating back/forward,
 * and scrolls to top on new navigations (PUSH).
 */
export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Use layout effect for immediate scroll changes
  useLayoutEffect(() => {
    if (navigationType === 'PUSH') {
      // New navigation - scroll to top
      window.scrollTo(0, 0);
    }
    // For POP (back/forward), browser handles scroll restoration automatically
    // when history.scrollRestoration is 'auto' (default)
  }, [location.pathname, navigationType]);

  // Ensure browser's native scroll restoration is enabled
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'auto';
    }
  }, []);

  return null;
}

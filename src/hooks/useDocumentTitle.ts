import { useEffect } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook specifically for employer layout - shows unread messages in tab
 */
export function useEmployerDocumentTitle() {
  const { preloadedUnreadMessages } = useAuth();
  
  useEffect(() => {
    if (preloadedUnreadMessages > 0) {
      document.title = `(${preloadedUnreadMessages}) Parium`;
    } else {
      document.title = 'Parium';
    }
  }, [preloadedUnreadMessages]);
}

/**
 * Hook specifically for job seeker layout - shows unread messages in tab
 */
export function useJobSeekerDocumentTitle() {
  const { preloadedJobSeekerUnreadMessages } = useAuth();
  
  useEffect(() => {
    if (preloadedJobSeekerUnreadMessages > 0) {
      document.title = `(${preloadedJobSeekerUnreadMessages}) Parium`;
    } else {
      document.title = 'Parium';
    }
  }, [preloadedJobSeekerUnreadMessages]);
}

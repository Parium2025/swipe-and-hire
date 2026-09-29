import { useEffect } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook specifically for employer layout - shows unread messages in tab
 */
export function useEmployerDocumentTitle() {
  const { user, preloadedUnreadMessages, employerCountsReadyUserId } = useAuth();
  const countsReady = !!user && employerCountsReadyUserId === user.id;
  
  useEffect(() => {
    if (countsReady && preloadedUnreadMessages > 0) {
      document.title = `(${preloadedUnreadMessages}) Parium`;
    } else {
      document.title = 'Parium';
    }
  }, [countsReady, preloadedUnreadMessages]);
}

/**
 * Hook specifically for job seeker layout - shows unread messages in tab
 */
export function useJobSeekerDocumentTitle() {
  const { user, preloadedJobSeekerUnreadMessages, seekerCountsReadyUserId } = useAuth();
  const countsReady = !!user && seekerCountsReadyUserId === user.id;
  
  useEffect(() => {
    if (countsReady && preloadedJobSeekerUnreadMessages > 0) {
      document.title = `(${preloadedJobSeekerUnreadMessages}) Parium`;
    } else {
      document.title = 'Parium';
    }
  }, [countsReady, preloadedJobSeekerUnreadMessages]);
}

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { flushHideQueue, getHideQueue } from '@/lib/applicationHideQueue';
import { clearMyApplicationsLocalCache } from '@/hooks/useMyApplicationsCache';

/**
 * Global flush av "dölj ansökan"-kön. Mountas i OfflineQueueRunner så att
 * åtgärder utförda offline skickas så fort nätet är tillbaka — oavsett
 * vilken sida användaren står på.
 */
export function useOfflineApplicationHideQueue(userId: string | undefined) {
  const queryClient = useQueryClient();
  const syncing = useRef(false);

  const sync = useCallback(async () => {
    if (!userId || syncing.current) return;
    if (getHideQueue().filter(q => q.userId === userId).length === 0) return;

    syncing.current = true;
    try {
      const synced = await flushHideQueue(userId);
      if (synced > 0) {
        clearMyApplicationsLocalCache();
        queryClient.invalidateQueries({ queryKey: ['my-applications', userId] });
        queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
      }
    } finally {
      syncing.current = false;
    }
  }, [userId, queryClient]);

  useEffect(() => {
    const unsub = onConnectivityChange((online) => {
      if (online) sync();
    });
    if (getIsOnline()) sync();
    return unsub;
  }, [sync]);

  return { sync };
}

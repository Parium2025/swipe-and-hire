import { useContext, useEffect } from 'react';
import { AuthContext } from '@/hooks/useAuth';
import { installAppFailureMonitor, updateAppFailureMonitorOwner } from '@/lib/appFailureMonitor';

export function AppFailureMonitor() {
  // Read the context defensively: this monitor must never be able to crash the
  // app (e.g. during HMR when the provider module is briefly re-evaluated).
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id ?? null;

  useEffect(() => {
    installAppFailureMonitor(() => userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateAppFailureMonitorOwner(userId);
  }, [userId]);

  return null;
}

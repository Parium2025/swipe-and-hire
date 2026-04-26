import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { installAppFailureMonitor, updateAppFailureMonitorOwner } from '@/lib/appFailureMonitor';

export function AppFailureMonitor() {
  const { user } = useAuth();

  useEffect(() => {
    installAppFailureMonitor(() => user?.id ?? null);
  }, []);

  useEffect(() => {
    updateAppFailureMonitorOwner(user?.id ?? null);
  }, [user?.id]);

  return null;
}

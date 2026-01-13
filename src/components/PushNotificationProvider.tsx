import { useCapacitorPush } from '@/hooks/useCapacitorPush';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Component that initializes push notifications on app start
 * Should be placed inside AuthProvider and Router
 */
export function PushNotificationProvider() {
  const navigate = useNavigate();

  const handleNotificationTapped = useCallback((data?: Record<string, string>) => {
    // Handle navigation based on notification data
    if (data?.route) {
      navigate(data.route);
    } else if (data?.job_id) {
      navigate(`/job-details/${data.job_id}`);
    } else if (data?.type === 'message') {
      navigate('/messages');
    } else if (data?.type === 'application') {
      navigate('/candidates');
    }
  }, [navigate]);

  // Initialize push notifications with auto-register on login
  useCapacitorPush({
    autoInitialize: true,
    onNotificationTapped: handleNotificationTapped,
  });

  return null;
}

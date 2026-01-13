import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import {
  isPushSupported,
  getPlatform,
  initializePushNotifications,
  setupPushListeners,
  unregisterAllTokens,
} from '@/lib/pushNotificationService';

interface UseCapacitorPushOptions {
  /**
   * Called when a notification is received while app is in foreground
   */
  onNotificationReceived?: (title: string, body: string, data?: Record<string, string>) => void;
  
  /**
   * Called when user taps on a notification
   */
  onNotificationTapped?: (data?: Record<string, string>) => void;
  
  /**
   * Auto-initialize on login
   */
  autoInitialize?: boolean;
}

/**
 * Hook to manage Capacitor push notifications
 * Automatically registers on login and sets up listeners
 */
export function useCapacitorPush(options: UseCapacitorPushOptions = {}) {
  const { user } = useAuth();
  const { onNotificationReceived, onNotificationTapped, autoInitialize = true } = options;
  const initializedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  /**
   * Initialize push notifications
   */
  const initialize = useCallback(async () => {
    if (!isPushSupported()) {
      console.log('Push notifications not supported on this platform');
      return { success: false };
    }

    if (!user) {
      console.log('Cannot initialize push: user not authenticated');
      return { success: false };
    }

    const deviceName = `${getPlatform()}-${navigator.userAgent.slice(0, 50)}`;
    const result = await initializePushNotifications(deviceName);
    
    if (result.success) {
      console.log('Push notifications initialized successfully');
    } else {
      console.log('Failed to initialize push notifications');
    }
    
    return result;
  }, [user]);

  /**
   * Unregister on logout
   */
  const cleanup = useCallback(async () => {
    if (user?.id) {
      await unregisterAllTokens(user.id);
    }
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    initializedRef.current = false;
  }, [user?.id]);

  // Auto-initialize when user logs in
  useEffect(() => {
    if (!autoInitialize || !user || initializedRef.current) return;

    const init = async () => {
      // Small delay to ensure auth is fully complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await initialize();
      if (result.success) {
        initializedRef.current = true;
      }
    };

    init();
  }, [user, autoInitialize, initialize]);

  // Set up notification listeners
  useEffect(() => {
    if (!isPushSupported()) return;

    cleanupRef.current = setupPushListeners(
      // Notification received in foreground
      (notification) => {
        const { title, body, data } = notification;
        
        // Show toast for foreground notifications
        if (title || body) {
          toast(title || 'Ny notis', {
            description: body,
          });
        }
        
        onNotificationReceived?.(title || '', body || '', data);
      },
      // Notification tapped
      (action) => {
        const data = action.notification.data;
        onNotificationTapped?.(data);
      }
    );

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [onNotificationReceived, onNotificationTapped]);

  return {
    isSupported: isPushSupported(),
    platform: getPlatform(),
    initialize,
    cleanup,
  };
}

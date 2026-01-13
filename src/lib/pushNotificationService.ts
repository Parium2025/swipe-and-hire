import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export type Platform = 'ios' | 'android' | 'web';

/**
 * Check if push notifications are supported on this platform
 */
export function isPushSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  return 'web';
}

/**
 * Request push notification permissions
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    console.log('Push notifications not supported on this platform');
    return false;
  }

  try {
    // Check current permission status
    const permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'granted') {
      return true;
    }
    
    if (permStatus.receive === 'denied') {
      console.log('Push notification permission denied');
      return false;
    }
    
    // Request permission
    const result = await PushNotifications.requestPermissions();
    return result.receive === 'granted';
  } catch (error) {
    console.error('Error requesting push permission:', error);
    return false;
  }
}

/**
 * Register for push notifications and get the device token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return null;
  }

  const hasPermission = await requestPushPermission();
  if (!hasPermission) {
    console.log('No push notification permission');
    return null;
  }

  return new Promise((resolve) => {
    // Listen for registration success
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      resolve(token.value);
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
      resolve(null);
    });

    // Start the registration process
    PushNotifications.register();
  });
}

/**
 * Set up push notification listeners for received notifications
 */
export function setupPushListeners(
  onNotificationReceived?: (notification: PushNotificationSchema) => void,
  onNotificationTapped?: (notification: ActionPerformed) => void
): () => void {
  if (!isPushSupported()) {
    return () => {};
  }

  // Called when a notification is received while app is in foreground
  const receivedListener = PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      onNotificationReceived?.(notification);
    }
  );

  // Called when user taps on a notification
  const actionListener = PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      console.log('Push notification action performed:', action);
      onNotificationTapped?.(action);
    }
  );

  // Return cleanup function
  return () => {
    receivedListener.then(l => l.remove());
    actionListener.then(l => l.remove());
  };
}

/**
 * Register the push token with the backend
 */
export async function registerTokenWithBackend(
  token: string,
  platform: Platform,
  deviceName?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('register-push-token', {
      body: { token, platform, device_name: deviceName },
    });

    if (error) {
      console.error('Failed to register push token with backend:', error);
      return false;
    }

    console.log('Push token registered with backend:', data);
    return true;
  } catch (err) {
    console.error('Error registering push token:', err);
    return false;
  }
}

/**
 * Unregister all push tokens for the current user (call on logout)
 */
export async function unregisterAllTokens(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('device_push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to unregister push tokens:', error);
      return false;
    }

    console.log('All push tokens unregistered');
    return true;
  } catch (err) {
    console.error('Error unregistering push tokens:', err);
    return false;
  }
}

/**
 * Full initialization: request permission, get token, register with backend
 */
export async function initializePushNotifications(
  deviceName?: string
): Promise<{ success: boolean; token?: string }> {
  if (!isPushSupported()) {
    return { success: false };
  }

  const token = await registerForPushNotifications();
  if (!token) {
    return { success: false };
  }

  const platform = getPlatform();
  const registered = await registerTokenWithBackend(token, platform, deviceName);
  
  return { success: registered, token };
}

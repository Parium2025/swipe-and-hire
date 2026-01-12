import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type Platform = 'ios' | 'android' | 'web';

/**
 * Hook to manage push notification token registration
 * Call registerToken when you have a push token from Capacitor or web push
 */
export function usePushNotifications() {
  const { user } = useAuth();

  /**
   * Register a push token for the current user
   */
  const registerToken = useCallback(async (
    token: string, 
    platform: Platform, 
    deviceName?: string
  ): Promise<boolean> => {
    if (!user) {
      console.warn('Cannot register push token: user not authenticated');
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('register-push-token', {
        body: { token, platform, device_name: deviceName },
      });

      if (error) {
        console.error('Failed to register push token:', error);
        return false;
      }

      console.log('Push token registered successfully:', data);
      return true;
    } catch (err) {
      console.error('Error registering push token:', err);
      return false;
    }
  }, [user]);

  /**
   * Unregister a push token (mark as inactive)
   */
  const unregisterToken = useCallback(async (token: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('device_push_tokens')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('token', token);

      if (error) {
        console.error('Failed to unregister push token:', error);
        return false;
      }

      console.log('Push token unregistered successfully');
      return true;
    } catch (err) {
      console.error('Error unregistering push token:', err);
      return false;
    }
  }, [user]);

  /**
   * Unregister all tokens for the current user (useful on logout)
   */
  const unregisterAllTokens = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('device_push_tokens')
        .update({ is_active: false })
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to unregister all push tokens:', error);
        return false;
      }

      console.log('All push tokens unregistered successfully');
      return true;
    } catch (err) {
      console.error('Error unregistering all push tokens:', err);
      return false;
    }
  }, [user]);

  return {
    registerToken,
    unregisterToken,
    unregisterAllTokens,
  };
}

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  // Check for Capacitor native platforms
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const platform = (window as any).Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }
  
  return 'web';
}

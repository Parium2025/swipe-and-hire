import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Central component that ensures the Supabase Realtime WebSocket
 * reconnects immediately when the user returns to the tab/app.
 * 
 * Without this, backgrounded tabs may have their WebSocket frozen
 * by the browser, causing missed events until the connection
 * times out and auto-reconnects (which can take 30+ seconds).
 * 
 * This forces an immediate reconnect on visibility change,
 * ensuring notifications, messages, and all realtime data
 * are up-to-date the instant the user returns.
 */
export function RealtimeKeepAlive() {
  useEffect(() => {
    let wasHidden = false;

    const forceRealtimeReconnect = () => {
      const channels = supabase.getChannels();
      if (channels.length === 0) return;

      // Hard reconnect to avoid stale "joined" channel states after tab freeze/network blips
      try {
        supabase.realtime.disconnect();
        supabase.realtime.connect();
      } catch {
        // Fallback: ensure disconnected channels attempt to rejoin
        channels.forEach(channel => {
          if (channel.state !== 'joined' && channel.state !== 'joining') {
            channel.subscribe();
          }
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        return;
      }

      // Tab became visible again after being hidden
      if (document.visibilityState === 'visible' && wasHidden) {
        wasHidden = false;
        forceRealtimeReconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle the 'online' event in case connection was lost
    const handleOnline = () => {
      forceRealtimeReconnect();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}

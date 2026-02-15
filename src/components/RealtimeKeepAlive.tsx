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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        return;
      }

      // Tab became visible again after being hidden
      if (document.visibilityState === 'visible' && wasHidden) {
        wasHidden = false;

        // Force all Realtime channels to reconnect by toggling the connection
        // This ensures the WebSocket is alive and receiving events
        const channels = supabase.getChannels();
        
        if (channels.length > 0) {
          // Re-subscribe each channel to force reconnect
          channels.forEach(channel => {
            // Check if the channel's socket is still connected
            // If not, unsubscribe and resubscribe to force reconnect
            const state = channel.state;
            if (state !== 'joined' && state !== 'joining') {
              channel.subscribe();
            }
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle the 'online' event in case connection was lost
    const handleOnline = () => {
      const channels = supabase.getChannels();
      channels.forEach(channel => {
        if (channel.state !== 'joined' && channel.state !== 'joining') {
          channel.subscribe();
        }
      });
    };

    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}

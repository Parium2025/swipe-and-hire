import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * 🚀 MESSAGES BACKGROUND SYNC ENGINE
 * 
 * Premium preloading som triggas DIREKT vid:
 * 1. Login (via triggerMessagesSync export)
 * 2. Första användarinteraktion (musrörelse, klick, touch)
 * 3. Tab-focus efter inaktivitet
 * 
 * Håller meddelanden och profilbilder färska genom:
 * - Periodisk refresh var 3:e minut
 * - Omedelbar preload vid aktivitet
 * - Service Worker image caching
 */

const MESSAGES_CACHE_KEY = 'parium_messages_cache';
const PROFILE_IMAGES_CACHE_KEY = 'parium_message_profiles_cache';
const PAGE_SIZE = 50;

// Export for triggering sync from other components (e.g., after login)
let triggerSyncCallback: (() => void) | null = null;

export function triggerMessagesSync() {
  if (triggerSyncCallback) {
    triggerSyncCallback();
  }
}

// Preload images via Service Worker
function preloadProfileImages(urls: string[]) {
  const validUrls = urls.filter(url => url && url.startsWith('http'));
  if (validUrls.length === 0) return;

  // Use Service Worker if available
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'PRELOAD_IMAGES',
      urls: validUrls,
    });
  } else {
    // Fallback: preload with Image objects
    validUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }
}

export function useMessagesBackgroundSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasInteractedRef = useRef(false);
  const lastSyncRef = useRef<number>(0);

  const syncMessages = useCallback(async () => {
    if (!user || !navigator.onLine) return;
    
    // 🌐 NETWORK OPTIMIZATION: Detect slow connection
    const isSlowConnection = () => {
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return true;
        if (conn?.saveData) return true;
      }
      return false;
    };
    
    const now = Date.now();
    // Debounce: längre intervall på svagt internet
    const minInterval = isSlowConnection() ? 60000 : 30000;
    if (now - lastSyncRef.current < minInterval) return;
    lastSyncRef.current = now;

    try {
      // Fetch inbox and sent in parallel
      const [inboxResult, sentResult] = await Promise.all([
        supabase
          .from('messages')
          .select(`*, job:job_id (title)`)
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE),
        supabase
          .from('messages')
          .select(`*, job:job_id (title)`)
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE),
      ]);

      if (inboxResult.error || sentResult.error) {
        console.error('[Messages Sync] Error fetching messages');
        return;
      }

      const inbox = inboxResult.data || [];
      const sent = sentResult.data || [];

      // Get unique user IDs for profile lookup
      const inboxSenderIds = [...new Set(inbox.map(m => m.sender_id))];
      const sentRecipientIds = [...new Set(sent.map(m => m.recipient_id))];
      const allUserIds = [...new Set([...inboxSenderIds, ...sentRecipientIds])];

      // Fetch all profiles
      let profileMap = new Map<string, any>();
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, company_name, profile_image_url, company_logo_url, role')
          .in('user_id', allUserIds);

        profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // Preload profile images
        const imageUrls = profiles
          ?.map(p => p.role === 'employer' ? p.company_logo_url : p.profile_image_url)
          .filter(Boolean) as string[];
        
        if (imageUrls.length > 0) {
          preloadProfileImages(imageUrls);
          
          // Cache profile data separately for instant access
          try {
            localStorage.setItem(PROFILE_IMAGES_CACHE_KEY, JSON.stringify({
              profiles: Object.fromEntries(profileMap),
              timestamp: Date.now(),
            }));
          } catch { /* ignore */ }
        }
      }

      // Build messages with profiles
      const inboxWithProfiles = inbox.map(msg => ({
        ...msg,
        sender_profile: profileMap.get(msg.sender_id) || null,
      }));

      const sentWithProfiles = sent.map(msg => ({
        ...msg,
        recipient_profile: profileMap.get(msg.recipient_id) || null,
      }));

      // Update localStorage cache
      try {
        localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify({
          inbox: inboxWithProfiles,
          sent: sentWithProfiles,
          timestamp: Date.now(),
        }));
      } catch { /* ignore */ }

      // Update React Query cache
      queryClient.setQueryData(['messages', 'inbox', user.id], {
        pages: [{ messages: inbox, nextCursor: inbox.length === PAGE_SIZE ? inbox[inbox.length - 1]?.created_at : null }],
        pageParams: [undefined],
      });

      queryClient.setQueryData(['messages', 'sent', user.id], {
        pages: [{ messages: sent, nextCursor: sent.length === PAGE_SIZE ? sent[sent.length - 1]?.created_at : null }],
        pageParams: [undefined],
      });

      queryClient.setQueryData(['messages', 'profiles', inbox.length, sent.length], {
        inbox: inboxWithProfiles,
        sent: sentWithProfiles,
      });

      console.log('[Messages Sync] Synced', inbox.length, 'inbox,', sent.length, 'sent messages');
    } catch (error) {
      console.error('[Messages Sync] Error:', error);
    }
  }, [user, queryClient]);

  // Register the sync callback for external triggers
  useEffect(() => {
    triggerSyncCallback = syncMessages;
    return () => {
      triggerSyncCallback = null;
    };
  }, [syncMessages]);

  // Trigger sync on first user interaction
  useEffect(() => {
    if (!user || hasInteractedRef.current) return;

    const handleInteraction = () => {
      if (hasInteractedRef.current) return;
      hasInteractedRef.current = true;
      
      // Remove listeners
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      
      // Trigger sync
      syncMessages();
    };

    window.addEventListener('mousemove', handleInteraction, { once: true });
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [user, syncMessages]);

  // Trigger sync on tab focus
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, syncMessages]);

  // Initial sync on mount - DEFERRED på touch/svagt internet
  useEffect(() => {
    if (!user) return;
    
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // På touch: defer synken för att inte blocka UI
    if (isTouchDevice) {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => syncMessages(), { timeout: 5000 });
      } else {
        setTimeout(() => syncMessages(), 2000);
      }
    } else {
      syncMessages();
    }
  }, [user, syncMessages]);

  return { syncMessages };
}

// Get cached profile images for instant display
export function getCachedMessageProfiles(): Map<string, any> | null {
  try {
    const cached = localStorage.getItem(PROFILE_IMAGES_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // No expiry — realtime subscriptions keep data fresh
      return new Map(Object.entries(parsed.profiles));
    }
  } catch { /* ignore */ }
  return null;
}

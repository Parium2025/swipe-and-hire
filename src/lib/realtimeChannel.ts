import { supabase } from '@/integrations/supabase/client';

type ChannelOptions = Parameters<typeof supabase.channel>[1];

const runtimeId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let channelInstance = 0;

/**
 * Creates a genuinely new channel for every mounted subscription.
 *
 * The realtime client reuses an existing channel when the topic matches. During
 * Strict Mode, fast route changes, HMR, or async cleanup, that can return an
 * already-subscribed channel and make a subsequent `.on()` throw. A runtime ID
 * plus monotonic instance ID makes collisions impossible without changing the
 * server-side topic semantics.
 */
export function createRealtimeChannel(topic: string, options?: ChannelOptions) {
  channelInstance += 1;
  const uniqueTopic = `${topic}:${runtimeId}:${channelInstance}`;
  return options
    ? supabase.channel(uniqueTopic, options)
    : supabase.channel(uniqueTopic);
}
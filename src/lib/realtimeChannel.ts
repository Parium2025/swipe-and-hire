import { supabase } from '@/integrations/supabase/client';

type ChannelOptions = Parameters<typeof supabase.channel>[1];

let runtimeId: string | null = null;
let channelInstance = 0;

function getRuntimeId(): string {
  if (runtimeId) return runtimeId;

  // Cloudflare Workers forbids random generation while the server bundle is
  // being imported. Realtime channels are created from mounted client effects,
  // so generate the per-runtime identifier lazily on first actual use.
  runtimeId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return runtimeId;
}

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
  const uniqueTopic = `${topic}:${getRuntimeId()}:${channelInstance}`;
  return options
    ? supabase.channel(uniqueTopic, options)
    : supabase.channel(uniqueTopic);
}
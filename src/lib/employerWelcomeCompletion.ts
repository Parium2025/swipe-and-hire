import { supabase } from '@/integrations/supabase/client';

export const welcomeCompletionKey = (userId: string) => `parium_employer_welcome_completed:${userId}`;

// A signal never contains profile data or a session. The recipient verifies the server.
export function signalWelcomeCompletion(userId: string): void {
  try { localStorage.setItem(welcomeCompletionKey(userId), `${Date.now()}:${Math.random()}`); } catch { /* Storage can be disabled. */ }
}

export async function isEmployerWelcomeCompleted(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('onboarding_completed').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.onboarding_completed === true;
}

export async function completeEmployerWelcome(profile: Record<string, unknown>, preferences: Record<string, boolean>): Promise<'completed' | 'already_completed'> {
  const { data, error } = await supabase.rpc('complete_employer_welcome', {
    p_profile: profile as import('@/integrations/supabase/types').Json, p_preferences: preferences,
  });
  if (error) throw error;
  if (data !== 'completed' && data !== 'already_completed') throw new Error('Unexpected welcome completion result');
  return data;
}
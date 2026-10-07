import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export const welcomeCompletionKey = (userId: string) => `parium_welcome_completed:${userId}`;

export function signalWelcomeCompletion(userId: string): void {
  try { localStorage.setItem(welcomeCompletionKey(userId), `${Date.now()}:${Math.random()}`); } catch { /* Storage can be disabled. */ }
}

export async function isWelcomeCompleted(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('onboarding_completed').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.onboarding_completed === true;
}

export async function completeJobseekerWelcome(profile: Record<string, unknown>, consent: boolean): Promise<'completed' | 'already_completed'> {
  const { data, error } = await supabase.rpc('complete_jobseeker_welcome', { p_profile: profile as Json, p_consent: consent });
  if (error) throw error;
  if (data !== 'completed' && data !== 'already_completed') throw new Error('Unexpected welcome completion result');
  return data;
}
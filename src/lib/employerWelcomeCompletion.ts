import { supabase } from '@/integrations/supabase/client';
export { signalWelcomeCompletion, welcomeCompletionKey, isWelcomeCompleted as isEmployerWelcomeCompleted } from '@/lib/welcomeCompletion';

export async function completeEmployerWelcome(profile: Record<string, unknown>, preferences: Record<string, boolean>): Promise<'completed' | 'already_completed'> {
  const { data, error } = await supabase.rpc('complete_employer_welcome', {
    p_profile: profile as import('@/integrations/supabase/types').Json, p_preferences: preferences,
  });
  if (error) throw error;
  if (data !== 'completed' && data !== 'already_completed') throw new Error('Unexpected welcome completion result');
  return data;
}
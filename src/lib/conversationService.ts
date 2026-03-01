import { supabase } from '@/integrations/supabase/client';

/**
 * Centralised conversation helpers used by bulk messaging, single messaging
 * and offline sync. Extracted to avoid duplicating 70+ lines of conversation
 * creation logic across multiple components.
 */

/** Generate a v4-compatible UUID using the Web Crypto API. */
export function createConversationId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  throw new Error('Din enhet saknar stöd för säker UUID-generering');
}

/** Find existing 1:1 conversation between current user and a candidate. */
export async function findExistingConversationId(
  userId: string,
  candidateId: string
): Promise<string | null> {
  const { data: myMemberships, error: memErr } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId);

  if (memErr || !myMemberships || myMemberships.length === 0) return null;

  const myConvIds = myMemberships.map((m) => m.conversation_id);

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('candidate_id', candidateId)
    .in('id', myConvIds)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id ?? null;
}

/** Create a new 1:1 conversation for a candidate, with FK-safe fallback. */
export async function createConversationForCandidate(
  userId: string,
  candidateId: string,
  jobId?: string | null,
  applicationId?: string | null
): Promise<string> {
  const conversationId = createConversationId();

  let { data: created, error: convError } = await supabase
    .from('conversations')
    .insert({
      id: conversationId,
      is_group: false,
      job_id: jobId || null,
      application_id: applicationId || null,
      candidate_id: candidateId,
      created_by: userId,
    })
    .select('id')
    .single();

  // Fallback if references are stale/invalid
  if (convError?.code === '23503') {
    const retry = await supabase
      .from('conversations')
      .insert({
        id: conversationId,
        is_group: false,
        job_id: null,
        application_id: null,
        candidate_id: candidateId,
        created_by: userId,
      })
      .select('id')
      .single();

    created = retry.data;
    convError = retry.error;
  }

  if (convError) throw convError;
  return created!.id;
}

/** Ensure both parties are members of the conversation. */
export async function ensureConversationMemberships(
  conversationId: string,
  userId: string,
  candidateId: string
): Promise<void> {
  const { error: addSelfError } = await supabase
    .from('conversation_members')
    .upsert(
      { conversation_id: conversationId, user_id: userId, is_admin: true },
      { onConflict: 'conversation_id,user_id' }
    );
  if (addSelfError) throw addSelfError;

  const { error: addCandidateError } = await supabase
    .from('conversation_members')
    .insert({ conversation_id: conversationId, user_id: candidateId, is_admin: false });

  if (addCandidateError && addCandidateError.code !== '23505') {
    throw addCandidateError;
  }
}

/** Check if an error is retryable (transient DB/network issue). */
export function isRetryableError(error: any): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42501' ||
    code === '40001' ||
    code === '40P01' ||
    message.includes('row-level security') ||
    message.includes('network') ||
    message.includes('fetch')
  );
}

/** Format a Supabase/network error into a human-readable string. */
export function formatConversationError(error: any): string {
  const code = error?.code ? `[${error.code}] ` : '';
  const message = error?.message || 'Okänt fel';
  const details = error?.details ? ` • ${error.details}` : '';
  return `${code}${message}${details}`;
}

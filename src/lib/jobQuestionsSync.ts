import { supabase } from '@/integrations/supabase/client';

export interface SyncableJobQuestion {
  id?: string;
  question_text: string;
  question_type: string;
  options?: string[] | null;
  is_required?: boolean | null;
  order_index: number;
  min_value?: number | null;
  max_value?: number | null;
  placeholder_text?: string | null;
}

const isUuid = (value?: string) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * Sparar en annons frågor utan att förstöra historiken.
 *
 * Tidigare raderades ALLA frågor och skapades om vid varje redigering, vilket
 * gav nya UUID:n. Redan inkomna ansökningar pekar på de gamla id:na i
 * custom_answers — de blev då "föräldralösa" och kunde inte visas för
 * arbetsgivaren. Nu uppdateras befintliga frågor på plats (samma id),
 * nya läggs till och bara borttagna frågor raderas.
 */
export async function syncJobQuestions(jobId: string, questions: SyncableJobQuestion[]) {
  const normalize = (q: SyncableJobQuestion) => ({
    job_id: jobId,
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.options && q.options.length > 0 ? q.options : null,
    is_required: q.is_required ?? true,
    order_index: q.order_index,
    min_value: q.min_value ?? null,
    max_value: q.max_value ?? null,
    placeholder_text: q.placeholder_text ?? null,
  });

  const { data: existing, error: existingError } = await supabase
    .from('job_questions')
    .select('id')
    .eq('job_id', jobId);
  if (existingError) throw existingError;

  const existingIds = new Set((existing || []).map((q) => q.id));
  const keptIds = new Set(
    questions.map((q) => q.id).filter((id): id is string => isUuid(id) && existingIds.has(id!))
  );

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  if (removedIds.length > 0) {
    const { error } = await supabase.from('job_questions').delete().in('id', removedIds);
    if (error) throw error;
  }

  const updates = questions.filter((q) => isUuid(q.id) && keptIds.has(q.id!));
  for (const q of updates) {
    const { error } = await supabase.from('job_questions').update(normalize(q)).eq('id', q.id!);
    if (error) throw error;
  }

  const inserts = questions.filter((q) => !isUuid(q.id) || !keptIds.has(q.id!)).map(normalize);
  if (inserts.length > 0) {
    const { error } = await supabase.from('job_questions').insert(inserts);
    if (error) throw error;
  }
}

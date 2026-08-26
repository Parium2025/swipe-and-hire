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
export function prepareJobQuestions(questions: SyncableJobQuestion[]) {
  const normalize = (q: SyncableJobQuestion) => ({
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.options && q.options.length > 0 ? q.options : null,
    is_required: q.is_required ?? true,
    order_index: q.order_index,
    min_value: q.min_value ?? null,
    max_value: q.max_value ?? null,
    placeholder_text: q.placeholder_text ?? null,
  });

  return questions.map((question) => {
    const normalized = normalize(question);
    return isUuid(question.id) ? normalized : { ...normalized, id: undefined };
  });
}

export async function syncJobQuestions(jobId: string, questions: SyncableJobQuestion[]) {
  const payload = prepareJobQuestions(questions);

  const { error } = await supabase.rpc('sync_owned_job_questions', {
    p_job_id: jobId,
    p_questions: payload,
  });
  if (error) throw error;
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { JobQuestion } from '@/types/jobWizard';

export interface ExtraJobDetails {
  work_start_time?: string | null;
  work_end_time?: string | null;
}

/**
 * Hämtar frågor, extra jobbdetaljer och användarens ev. befintliga ansökan
 * i en enda parallell batch när ApplySheet öppnas.
 *
 * 🚀 N+1 fix: custom_answers hämtas i samma request som applikationen —
 * inte i ett separat round-trip.
 */
export function useApplyData(jobId: string, open: boolean, userId?: string) {
  const [questions, setQuestions] = useState<(JobQuestion & { id: string })[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [contactEmail, setContactEmail] = useState<string | undefined>();
  const [extraDetails, setExtraDetails] = useState<ExtraJobDetails | null>(null);
  const [hasAlreadyApplied, setHasAlreadyApplied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setHasAlreadyApplied(false);
      try {
        const [questionsRes, jobRes, applicationRes] = await Promise.all([
          supabase.from('job_questions').select('*').eq('job_id', jobId).order('order_index'),
          supabase
            .from('job_postings')
            .select('contact_email, work_start_time, work_end_time')
            .eq('id', jobId)
            .single(),
          userId
            ? supabase
                .from('job_applications')
                .select('id, custom_answers, questions_snapshot')
                .eq('job_id', jobId)
                .eq('applicant_id', userId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (cancelled) return;

        // 📸 Om användaren redan har sökt — visa de frusna frågorna
        // från själva ansökan, inte de aktuella (som kan ha ändrats).
        const appRow = applicationRes.data as
          | { id: string; custom_answers?: unknown; questions_snapshot?: unknown }
          | null;
        const snapshot = appRow?.questions_snapshot;
        if (appRow && Array.isArray(snapshot) && snapshot.length > 0) {
          setQuestions(snapshot as (JobQuestion & { id: string })[]);
        } else if (questionsRes.data) {
          setQuestions(questionsRes.data as (JobQuestion & { id: string })[]);
        }
        if (jobRes.data) {
          if (jobRes.data.contact_email) setContactEmail(jobRes.data.contact_email);
          setExtraDetails({
            work_start_time: jobRes.data.work_start_time,
            work_end_time: jobRes.data.work_end_time,
          });
        }
        if (appRow) {
          setHasAlreadyApplied(true);
          const existing = appRow.custom_answers;
          if (existing && typeof existing === 'object') {
            setAnswers(existing as Record<string, any>);
          }
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching apply data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [open, jobId, userId]);

  return {
    questions,
    answers,
    setAnswers,
    contactEmail,
    extraDetails,
    hasAlreadyApplied,
    loading,
  };
}

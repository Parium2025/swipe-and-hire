import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { JobQuestion } from '@/types/jobWizard';

export interface FullJobData {
  description?: string;
  requirements?: string;
  pitch?: string;
  benefits?: string[];
  employment_type?: string;
  part_time_days?: string[] | null;
  part_time_shifts?: string[] | null;
  duration_amount?: number | null;
  duration_unit?: string | null;
  work_schedule?: string;
  work_start_time?: string;
  work_end_time?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  salary_transparency?: string;
  positions_count?: number;
  occupation?: string;
  workplace_name?: string;
  workplace_city?: string;
  workplace_county?: string;
  workplace_municipality?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  contact_email?: string;
  application_instructions?: string;
}

/**
 * Hämtar full jobbdata + frågor + användarens tidigare svar för swipe-detail.
 *
 * Städar racy state via en cancelled-flag. Nollställer allt när `open=false`
 * så nästa öppning inte flashar gammal data.
 */
export function useJobDetailData(jobId: string, open: boolean, userId?: string) {
  const [detail, setDetail] = useState<FullJobData | null>(null);
  const [questions, setQuestions] = useState<(JobQuestion & { id: string })[]>([]);
  const [myAnswers, setMyAnswers] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const viewRecordedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setQuestions([]);
      setMyAnswers(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setDetail(null);
    setQuestions([]);
    setMyAnswers(null);
    setLoading(true);

    void (async () => {
      const fetchPromises: [any, any, any] = [
        supabase
          .from('job_postings')
          .select(`
            description, requirements, pitch, benefits, employment_type,
            part_time_days, part_time_shifts, duration_amount, duration_unit,
            work_schedule, work_start_time, work_end_time,
            work_location_type, remote_work_possible,
            salary_min, salary_max, salary_type, salary_transparency,
            positions_count, occupation,
            workplace_name, workplace_city, workplace_county,
            workplace_municipality, workplace_address, workplace_postal_code,
            contact_email, application_instructions
          `)
          .eq('id', jobId)
          .single(),
        supabase
          .from('job_questions')
          .select('*')
          .eq('job_id', jobId)
          .order('order_index'),
        userId
          ? supabase
              .from('job_applications')
              .select('custom_answers, questions_snapshot')
              .eq('job_id', jobId)
              .eq('applicant_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ];

      try {
        const [jobRes, questionsRes, answersRes] = await Promise.all(fetchPromises);
        if (cancelled) return;
        setDetail(jobRes.data ?? null);
        // 📸 Snapshot först: har användaren redan sökt använder vi de frusna
        // frågorna från ansökan så det som visas matchar det som besvarades.
        const appSnap = (answersRes.data as any)?.questions_snapshot;
        if (Array.isArray(appSnap) && appSnap.length > 0) {
          setQuestions(appSnap as (JobQuestion & { id: string })[]);
        } else {
          setQuestions((questionsRes.data as (JobQuestion & { id: string })[]) ?? []);
        }
        const answers = answersRes.data?.custom_answers;
        if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
          setMyAnswers(answers as Record<string, any>);
        } else {
          setMyAnswers(null);
        }
      } catch {
        if (cancelled) return;
        setDetail(null);
        setQuestions([]);
        setMyAnswers(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, jobId, userId]);

  return { detail, questions, myAnswers, loading, viewRecordedRef };
}

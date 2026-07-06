import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { JobQuestion } from '@/types/jobWizard';

export interface ExtraJobDetails {
  workplace_address?: string | null;
  workplace_postal_code?: string | null;
  workplace_city?: string | null;
  workplace_municipality?: string | null;
  workplace_county?: string | null;
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
            .select('contact_email, workplace_address, workplace_postal_code, workplace_city, workplace_municipality, workplace_county, work_start_time, work_end_time')
            .eq('id', jobId)
            .single(),
          userId
            ? supabase
                .from('job_applications')
                .select('id, custom_answers')
                .eq('job_id', jobId)
                .eq('applicant_id', userId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (cancelled) return;

        if (questionsRes.data) {
          setQuestions(questionsRes.data as (JobQuestion & { id: string })[]);
        }
        if (jobRes.data) {
          if (jobRes.data.contact_email) setContactEmail(jobRes.data.contact_email);
          setExtraDetails({
            workplace_address: jobRes.data.workplace_address,
            workplace_postal_code: jobRes.data.workplace_postal_code,
            workplace_city: jobRes.data.workplace_city,
            workplace_municipality: jobRes.data.workplace_municipality,
            workplace_county: jobRes.data.workplace_county,
            work_start_time: jobRes.data.work_start_time,
            work_end_time: jobRes.data.work_end_time,
          });
        }
        if (applicationRes.data) {
          setHasAlreadyApplied(true);
          const existing = (applicationRes.data as { custom_answers?: unknown }).custom_answers;
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

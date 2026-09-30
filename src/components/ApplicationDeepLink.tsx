import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import type { ApplicationData } from '@/hooks/useApplicationsData';
import { toast } from '@/hooks/use-toast';

const APP_PARAM = 'open_application';
const INTERVIEW_PARAM = 'open_interview';

/**
 * Öppnar en specifik kandidat ovanpå den sida man redan står på, oavsett om
 * kandidaten bokades från en annons, Mina kandidater eller Alla kandidater.
 * Styrs av ?open_application=<id> (eller ?open_interview=<id> för äldre
 * påminnelser). Används av notiser och pushnotiser.
 */
export function ApplicationDeepLink() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const applicationParam = params.get(APP_PARAM);
  const interviewParam = params.get(INTERVIEW_PARAM);
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [open, setOpen] = useState(false);
  const requestRef = useRef(0);

  const clearParams = () => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(APP_PARAM);
      next.delete(INTERVIEW_PARAM);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (!user || (!applicationParam && !interviewParam)) return;
    const seq = ++requestRef.current;

    (async () => {
      try {
        let applicationId = applicationParam;
        if (!applicationId && interviewParam) {
          const { data: interview } = await supabase
            .from('interviews')
            .select('application_id, job_id, applicant_id')
            .eq('id', interviewParam)
            .maybeSingle();
          applicationId = interview?.application_id ?? null;
          if (!applicationId && interview?.job_id) {
            const { data: app } = await supabase
              .from('job_applications')
              .select('id')
              .eq('job_id', interview.job_id)
              .eq('applicant_id', interview.applicant_id)
              .limit(1)
              .maybeSingle();
            applicationId = app?.id ?? null;
          }
        }
        if (!applicationId) throw new Error('not_found');

        const { data: row, error } = await supabase
          .from('job_applications')
          .select('id, job_id, applicant_id, first_name, last_name, email, phone, location, bio, cv_url, age, employment_status, work_schedule, availability, status, rejected_at, applied_at, updated_at, custom_answers, questions_snapshot, viewed_at, profile_image_snapshot_url, video_snapshot_url, cover_image_snapshot_url, job_postings(title, occupation)')
          .eq('id', applicationId)
          .maybeSingle();
        if (error || !row) throw error ?? new Error('not_found');

        const { data: media } = await supabase.rpc('get_applicant_profile_media_batch', {
          p_applicant_ids: [row.applicant_id],
          p_employer_id: user.id,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m: any = Array.isArray(media) ? media[0] : null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const job: any = (row as any).job_postings;
        if (seq !== requestRef.current) return;

        setApplication({
          ...(row as any),
          applied_at: row.applied_at ?? row.updated_at,
          job_title: job?.title ?? undefined,
          job_occupation: job?.occupation ?? null,
          profile_image_url: row.profile_image_snapshot_url ?? m?.profile_image_url ?? null,
          video_url: row.video_snapshot_url ?? m?.video_url ?? null,
          cover_image_url: row.cover_image_snapshot_url ?? m?.cover_image_url ?? null,
          is_profile_video: m?.is_profile_video ?? null,
          last_active_at: m?.last_active_at ?? null,
        } as ApplicationData);
        setOpen(true);
      } catch {
        if (seq !== requestRef.current) return;
        clearParams();
        toast({
          title: 'Kandidaten kunde inte öppnas',
          description: 'Ansökan finns inte längre eller så saknar du behörighet.',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, applicationParam, interviewParam]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      clearParams();
      window.setTimeout(() => setApplication(null), 300);
    }
  };

  if (!application) return null;

  return (
    <CandidateProfileDialog
      application={application}
      open={open}
      onOpenChange={handleOpenChange}
      onStatusUpdate={() => handleOpenChange(false)}
      variant="all-candidates"
    />
  );
}

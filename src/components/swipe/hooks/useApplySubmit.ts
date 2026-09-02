import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { clearMyApplicationsLocalCache } from '@/hooks/useMyApplicationsCache';
import { useApplicationQuota } from '@/hooks/useApplicationQuota';
import { hasAllRequiredApplicationAnswers } from '@/lib/applicationAnswerValidation';
import type { JobQuestion } from '@/types/jobWizard';
import type { Json } from '@/integrations/supabase/types';

interface UseApplySubmitOptions {
  jobId: string;
  jobTitle: string;
  companyName: string;
  answers: Record<string, any>;
  userId?: string;
  userEmail?: string | null;
  onApplied: () => void;
  selectedProfileId: string | null;
  questions: (JobQuestion & { id: string })[];
}

/**
 * Kapslar in hela ansökningsflödet med optimistic UI + rollback.
 *
 * Ordning:
 *  1. Kvot-check (premium-gate) — visa ApplicationLimitDialog om över gränsen.
 *  2. Optimistisk state: submitting=true, submitted=true, cache-invalidering.
 *  3. Hämta profil, insert i job_applications, skicka mail + CV-summary.
 *  4. Rollback + toast om error.
 */
export function useApplySubmit({
  jobId,
  jobTitle,
  companyName,
  answers,
  userId,
  userEmail,
  onApplied,
  selectedProfileId,
  questions,
}: UseApplySubmitOptions) {
  const queryClient = useQueryClient();
  const { quota, refresh: refreshQuota } = useApplicationQuota();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const submitInProgressRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (!userId || submitInProgressRef.current) return;

    // 🔒 Premium-gate
    if (!quota.allowed && !quota.is_premium) {
      setShowLimitDialog(true);
      return;
    }

    submitInProgressRef.current = true;
    // 🚀 Optimistic UI
    setSubmitting(true);
    setSubmitted(true);

    clearMyApplicationsLocalCache();
    queryClient.invalidateQueries({ queryKey: ['applied-job-ids', userId] });

    try {
      // 📸 Snapshot: frys frågorna som visas för kandidaten precis nu.
      // Arbetsgivaren kommer alltid se exakt dessa frågor + svar, även om
      // frågorna senare ändras. Nya sökande får de nya frågorna.
      const profileRes = await supabase.rpc('get_my_profile');
      const profileRows = profileRes.data;
      const profile = Array.isArray(profileRows) ? profileRows[0] ?? null : null;
      // Använd exakt frågeversionen som kandidaten har sett och besvarat.
      // En arbetsgivare kan annars hinna ändra frågorna mellan öppning och skickning.
      const questionsSnapshot = questions;
      if (!hasAllRequiredApplicationAnswers(questionsSnapshot, answers)) {
        throw Object.assign(new Error('Besvara alla obligatoriska frågor innan du skickar ansökan.'), {
          code: '23514',
        });
      }
      const selectedProfileRes = selectedProfileId
        ? await supabase.from('candidate_profiles').select('id, label, cv_url, video_url, profile_image_url').eq('id', selectedProfileId).eq('user_id', userId).maybeSingle()
        : null;
      if (selectedProfileRes?.error) throw selectedProfileRes.error;
      const candidateProfile = selectedProfileRes?.data ?? null;
      if (selectedProfileId && !candidateProfile) throw new Error('Den valda profilen finns inte längre. Välj profil igen.');
      const snapshotCvUrl = candidateProfile ? candidateProfile.cv_url ?? null : profile?.cv_url || null;

      let age: number | null = null;
      if (profile?.birth_date) {
        const birthYear = new Date(profile.birth_date).getFullYear();
        age = new Date().getFullYear() - birthYear;
      }

      const { error } = await supabase.from('job_applications').insert({
        job_id: jobId,
        applicant_id: userId,
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        email: userEmail || profile?.email || null,
        phone: profile?.phone || null,
        location: profile?.home_location || profile?.location || null,
        age,
        bio: profile?.bio || null,
        // 📌 Finns en kandidatprofil gäller EXAKT den — tomt är tomt.
        // Kontots media används bara när ingen kandidatprofil är vald.
        cv_url: snapshotCvUrl,
        availability: profile?.availability || null,
        employment_status: profile?.employment_type || null,
        profile_image_snapshot_url: candidateProfile
          ? candidateProfile.profile_image_url ?? null
          : profile?.profile_image_url || null,
        video_snapshot_url: candidateProfile
          ? candidateProfile.video_url ?? null
          : profile?.video_url || null,
        candidate_profile_label: candidateProfile?.label ?? null,
        candidate_profile_id: candidateProfile?.id ?? null,
        custom_answers: answers,
        questions_snapshot: questionsSnapshot as unknown as Json,
        status: 'pending',
      });

      if (error) throw error;

      const emailPayload = {
        applicant_email: userEmail || profile?.email || '',
        applicant_first_name: profile?.first_name || 'Jobbsökare',
        job_title: jobTitle,
        company_name: companyName,
      };
      console.log('📧 Sending application confirmation email:', {
        to: emailPayload.applicant_email,
        job: emailPayload.job_title,
      });
      supabase.functions
        .invoke('send-application-confirmation', { body: emailPayload })
        .then(({ data, error }) => {
          if (error) console.error('❌ Confirmation email failed:', error);
          else console.log('✅ Confirmation email sent:', data);
        })
        .catch((e) => console.error('❌ Confirmation email network error:', e));

      if (snapshotCvUrl) {
        supabase.functions
          .invoke('generate-cv-summary', {
            body: { applicant_id: userId, job_id: jobId },
          })
          .catch(() => {});
      }

      queryClient.invalidateQueries({ queryKey: ['my-applications', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
      queryClient.invalidateQueries({ queryKey: ['applied-job-ids', userId] });

      toast({ title: 'Ansökan skickad!', description: `Din ansökan till ${companyName} har skickats`, route: '/my-applications' });
      refreshQuota();

      setTimeout(() => {
        onApplied();
      }, 1500);
    } catch (err: any) {
      console.error('Error submitting application:', err);
      setSubmitted(false);
      clearMyApplicationsLocalCache();
      queryClient.invalidateQueries({ queryKey: ['applied-job-ids', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-applications', userId] });

      // 🔒 Server-side quota trigger — visa paywall istället för generiskt fel
      const msg = String(err?.message ?? '');
      if (msg.includes('application_quota_exceeded')) {
        refreshQuota();
        setShowLimitDialog(true);
        return;
      }

      if (err?.code === '23505') {
        setSubmitted(true);
        toast({ title: 'Du har redan sökt det här jobbet' });
        onApplied();
        return;
      }

      toast({
        title: 'Kunde inte skicka ansökan',
        description: err.message || 'Försök igen',
        variant: 'destructive',
      });

    } finally {
      submitInProgressRef.current = false;
      setSubmitting(false);
    }
  }, [
    userId,
    userEmail,
    quota.allowed,
    quota.is_premium,
    jobId,
    answers,
    jobTitle,
    companyName,
    queryClient,
    refreshQuota,
    onApplied,
    selectedProfileId,
    questions,
  ]);

  return {
    submitting,
    submitted,
    setSubmitted,
    showLimitDialog,
    setShowLimitDialog,
    quota,
    handleSubmit,
  };
}

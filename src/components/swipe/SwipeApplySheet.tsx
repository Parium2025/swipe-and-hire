import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ApplicationQuestionsWizard } from '@/components/ApplicationQuestionsWizard';
import { clearMyApplicationsLocalCache } from '@/hooks/useMyApplicationsCache';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { TruncatedText } from '@/components/TruncatedText';
import type { JobQuestion } from '@/types/jobWizard';
import type { SwipeJob } from './SwipeCard';

interface SwipeApplySheetProps {
  jobId: string;
  jobTitle: string;
  companyName: string;
  job?: SwipeJob;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-white font-medium">{label}: </span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function JobDetailsSection({ job }: { job: SwipeJob }) {
  const salaryLabel = (() => {
    if (!job.salary_min && !job.salary_max && !job.salary_transparency) return null;
    if (job.salary_transparency === 'after_interview' || job.salary_transparency === 'not_specified') {
      return job.salary_transparency === 'after_interview' ? 'Lön efter intervju' : 'Ej specificerad';
    }
    if (job.salary_min || job.salary_max) {
      const suffix = job.salary_type === 'hourly' ? 'tim' : 'mån';
      if (job.salary_min && job.salary_max) return `${job.salary_min.toLocaleString('sv-SE')} – ${job.salary_max.toLocaleString('sv-SE')} kr/${suffix}`;
      if (job.salary_min) return `Från ${job.salary_min.toLocaleString('sv-SE')} kr/${suffix}`;
      return `Upp till ${job.salary_max!.toLocaleString('sv-SE')} kr/${suffix}`;
    }
    return null;
  })();

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
      <h3 className="text-white font-bold text-base">Detaljer om tjänsten</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        {job.employment_type && <DetailRow label="Anställning" value={getEmploymentTypeLabel(job.employment_type)} />}
        {job.location && <DetailRow label="Ort" value={job.location} />}
        {job.company_name && <DetailRow label="Bolagsnamn" value={job.company_name} />}
        {job.occupation && <DetailRow label="Yrke" value={job.occupation} />}
        {job.work_location_type && (
          <DetailRow label="Platstyp" value={job.work_location_type === 'on_site' ? 'På plats' : job.work_location_type === 'hybrid' ? 'Hybrid' : job.work_location_type === 'remote' ? 'Distans' : job.work_location_type} />
        )}
        {job.remote_work_possible && (
          <DetailRow label="Distans" value={job.remote_work_possible === 'yes' ? 'Ja' : job.remote_work_possible === 'no' ? 'Nej' : job.remote_work_possible} />
        )}
        {job.work_schedule && <DetailRow label="Schema" value={job.work_schedule} />}
        {salaryLabel && <DetailRow label="Lön" value={salaryLabel} />}
        {job.positions_count && job.positions_count > 0 && <DetailRow label="Antal tjänster" value={`${job.positions_count} st`} />}
      </div>
    </div>
  );
}


export function SwipeApplySheet({ jobId, jobTitle, companyName, job, open, onClose, onApplied }: SwipeApplySheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<(JobQuestion & { id: string })[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [contactEmail, setContactEmail] = useState<string | undefined>();
  const [hasAlreadyApplied, setHasAlreadyApplied] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch questions + contact email + check if already applied — in parallel
        const [questionsRes, jobRes, applicationRes] = await Promise.all([
          supabase
            .from('job_questions')
            .select('*')
            .eq('job_id', jobId)
            .order('order_index'),
          supabase
            .from('job_postings')
            .select('contact_email')
            .eq('id', jobId)
            .single(),
          user ? supabase
            .from('job_applications')
            .select('id')
            .eq('job_id', jobId)
            .eq('applicant_id', user.id)
            .maybeSingle() : Promise.resolve({ data: null }),
        ]);

        if (questionsRes.data) {
          setQuestions(questionsRes.data as (JobQuestion & { id: string })[]);
        }
        if (jobRes.data?.contact_email) {
          setContactEmail(jobRes.data.contact_email);
        }
        if (applicationRes.data) {
          setHasAlreadyApplied(true);
          // Pre-fill answers from existing application
          const { data: existingApp } = await supabase
            .from('job_applications')
            .select('custom_answers')
            .eq('job_id', jobId)
            .eq('applicant_id', user!.id)
            .single();
          if (existingApp?.custom_answers && typeof existingApp.custom_answers === 'object') {
            setAnswers(existingApp.custom_answers as Record<string, any>);
          }
        }
      } catch (err) {
        console.error('Error fetching apply data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, jobId, user]);

  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const allRequiredAnswered = useCallback(() => {
    return questions
      .filter(q => q.is_required)
      .every(q => {
        const a = answers[q.id];
        return a !== undefined && a !== null && a !== '' && (typeof a !== 'string' || a.trim() !== '');
      });
  }, [questions, answers]);

  const handleSubmit = useCallback(async () => {
    if (!user || submitting) return;

    setSubmitting(true);
    try {
      // Fetch profile data to pre-fill application
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, email, home_location, location, birth_date, bio, cv_url, availability, employment_type, profile_image_url, video_url')
        .eq('user_id', user.id)
        .single();

      let age: number | null = null;
      if (profile?.birth_date) {
        const birthYear = new Date(profile.birth_date).getFullYear();
        age = new Date().getFullYear() - birthYear;
      }

      const { error } = await supabase
        .from('job_applications')
        .insert({
          job_id: jobId,
          applicant_id: user.id,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          email: user.email || profile?.email || null,
          phone: profile?.phone || null,
          location: profile?.home_location || profile?.location || null,
          age,
          bio: profile?.bio || null,
          cv_url: profile?.cv_url || null,
          availability: profile?.availability || null,
          employment_status: profile?.employment_type || null,
          profile_image_snapshot_url: profile?.profile_image_url || null,
          video_snapshot_url: profile?.video_url || null,
          custom_answers: answers,
          status: 'pending',
        });

      if (error) throw error;

      // Send confirmation email in background with detailed logging
      const emailPayload = {
        applicant_email: user.email || profile?.email || '',
        applicant_first_name: profile?.first_name || 'Jobbsökare',
        job_title: jobTitle,
        company_name: companyName,
      };
      console.log('📧 Sending application confirmation email:', { to: emailPayload.applicant_email, job: emailPayload.job_title });
      supabase.functions.invoke('send-application-confirmation', { body: emailPayload })
        .then(({ data, error }) => {
          if (error) console.error('❌ Confirmation email failed:', error);
          else console.log('✅ Confirmation email sent:', data);
        })
        .catch((e) => console.error('❌ Confirmation email network error:', e));

      // Trigger CV summary in background
      if (profile?.cv_url) {
        supabase.functions.invoke('generate-cv-summary', {
          body: { applicant_id: user.id, job_id: jobId },
        }).catch(() => {});
      }

      setSubmitted(true);
      
      // Clear localStorage cache so My Applications page shows fresh data
      clearMyApplicationsLocalCache();
      
      // Invalidate queries so My Applications and search badges update
      queryClient.invalidateQueries({ queryKey: ['my-applications', user.id] });
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
      queryClient.invalidateQueries({ queryKey: ['applied-job-ids', user.id] });
      
      toast({ title: 'Ansökan skickad!', description: `Din ansökan till ${companyName} har skickats` });

      setTimeout(() => {
        onApplied();
      }, 1500);
    } catch (err: any) {
      console.error('Error submitting application:', err);
      toast({
        title: 'Kunde inte skicka ansökan',
        description: err.message || 'Försök igen',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [user, jobId, answers, submitting, companyName, onApplied]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-30 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-40 max-h-[92dvh] bg-parium-gradient rounded-t-3xl overflow-hidden flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-white/30" />
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-4 z-10 flex h-11 w-11 !min-h-0 !min-w-0 items-center justify-center touch-manipulation"
              aria-label="Stäng"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-all active:scale-90 [@media(hover:hover)]:hover:bg-white/20">
                <X className="h-5 w-5 text-white" />
              </div>
            </button>

            {/* Header — compact, with tap-to-preview on truncated title */}
            <div className="px-4 pr-14 pb-1 shrink-0">
              <p className="text-white text-sm font-medium mt-1">{companyName}</p>
              <TruncatedText
                text={jobTitle}
                className="text-xl font-bold text-white leading-tight tracking-tight mt-0.5 line-clamp-2"
                tooltipSide="bottom"
              />
            </div>

            {/* Content — flex-1 fills remaining space */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 pt-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
                </div>
              ) : submitted ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center space-y-4"
                >
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Ansökan skickad!</h3>
                  <p className="text-white/80 text-sm max-w-xs">
                    Din profil och svar har skickats till {companyName}. Lycka till!
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* Details section — above questions */}
                  {job && <div className="mb-6"><JobDetailsSection job={job} /></div>}

                  {questions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                      <p className="text-white text-sm max-w-xs">
                        Inga frågor att besvara. Din profilinformation skickas direkt med ansökan.
                      </p>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || hasAlreadyApplied}
                        className={`h-14 px-10 rounded-full font-semibold text-base transition-all active:scale-[0.97] ${
                          hasAlreadyApplied
                            ? 'bg-green-500 text-white cursor-not-allowed'
                            : 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        }`}
                      >
                        {hasAlreadyApplied ? 'Redan sökt' : submitting ? 'Skickar...' : 'Skicka ansökan'}
                      </button>
                    </div>
                  ) : (
                    <ApplicationQuestionsWizard
                      questions={questions}
                      answers={answers}
                      onAnswerChange={handleAnswerChange}
                      onSubmit={handleSubmit}
                      isSubmitting={submitting}
                      canSubmit={allRequiredAnswered()}
                      hasAlreadyApplied={hasAlreadyApplied}
                      contactEmail={contactEmail}
                      jobTitle={jobTitle}
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

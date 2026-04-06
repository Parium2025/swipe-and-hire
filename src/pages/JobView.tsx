import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useJobViewTracker } from '@/hooks/useJobViewTracker';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { Button } from '@/components/ui/button';
import { useOnline } from '@/hooks/useOnlineStatus';
import { getTimeRemaining } from '@/lib/date';
import type { JobQuestion } from '@/types/jobWizard';
import { ArrowLeft, Send, Users, CheckCircle, Share2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import { convertToSignedUrl } from '@/utils/storageUtils';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { imageCache } from '@/lib/imageCache';
import { ApplicationQuestionsWizard } from '@/components/ApplicationQuestionsWizard';
import { JobViewHero, JobViewDetails, JobViewBenefits, JobViewFooter } from '@/components/jobview';
import { useJobPrefetchCache } from '@/hooks/useJobPrefetchCache';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  salary_transparency?: string;
  employment_type?: string;
  work_schedule?: string;
  work_start_time?: string;
  work_end_time?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  contact_email?: string;
  application_instructions?: string;
  pitch?: string;
  benefits?: string[];
  positions_count?: number;
  requirements?: string;
  occupation?: string;
  workplace_name?: string;
  workplace_city?: string;
  workplace_county?: string;
  workplace_municipality?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  created_at: string;
  expires_at?: string;
  employer_id: string;
  job_image_url?: string;
  job_image_desktop_url?: string;
  profiles: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
    company_logo_url?: string;
  };
}

// Module-level cache: survives component remounts during viewport resizes
const _jobCache = new Map<string, { job: JobPosting; questions: JobQuestion[]; applied: boolean }>();

const JobView = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user, isCompanyUser, userRole } = useAuth();
  const [isEmployer, setIsEmployer] = useState(() => isCompanyUser() || userRole?.role === 'employer');
  const { getPrefetchedJob } = useJobPrefetchCache();

  // Robust employer check: also verify from profiles table directly
  useEffect(() => {
    if (!user?.id) {
      setIsEmployer(false);
      return;
    }
    // Immediate check from auth context
    if (isCompanyUser() || userRole?.role === 'employer') {
      setIsEmployer(true);
      return;
    }
    // Fallback: check profiles table directly (handles QR/external link scenarios)
    const checkRole = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.role === 'employer') {
        setIsEmployer(true);
      }
    };
    checkRole();
  }, [user?.id, userRole?.role]);
  
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  
  // Try module cache first, then React Query prefetch cache from search results
  const cached = jobId ? _jobCache.get(jobId) : undefined;
  const prefetched = !cached && jobId ? getPrefetchedJob(jobId) : undefined;
  
  // Build initial job from prefetch data if available (partial — no profiles join)
  const initialJob: JobPosting | null = cached?.job ?? (prefetched ? {
    ...prefetched,
    description: prefetched.description || '',
    location: prefetched.location || '',
    profiles: {
      company_name: prefetched.company_name,
      company_logo_url: prefetched.company_logo_url,
    },
  } as JobPosting : null);

  const [job, setJob] = useState<JobPosting | null>(initialJob);
  const [loading, setLoading] = useState(!initialJob);
  const [jobQuestions, setJobQuestions] = useState<JobQuestion[]>(cached?.questions ?? []);
  const hasLoadedOnce = useRef(!!initialJob);
  const [applying, setApplying] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem(`job-answers-draft-${jobId}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    const rawImg = initialJob?.job_image_url;
    if (!rawImg) return null;
    let resolved = rawImg;
    if (!rawImg.startsWith('http')) {
      const pub = supabase.storage.from('job-images').getPublicUrl(rawImg).data.publicUrl;
      resolved = pub && pub.includes('/storage/') ? pub : rawImg;
    }
    return imageCache.getCachedUrl(resolved) || resolved;
  });
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(() => {
    const rawLogo = initialJob?.profiles?.company_logo_url;
    return rawLogo ? (imageCache.getCachedUrl(rawLogo) || rawLogo) : null;
  });
  const [hasAlreadyApplied, setHasAlreadyApplied] = useState(cached?.applied ?? false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Track job view when user reads content (lowered thresholds for accuracy)
  useJobViewTracker({
    jobId,
    userId: user?.id,
    contentRef,
    scrollThreshold: 0.5,
    minTimeOnPage: 2000,
  });
  
  useImagePreloader(imageUrl ? [imageUrl] : [], { priority: 'high' });

  useEffect(() => {
    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  const fetchJob = async (retryCount = 0) => {
    try {
      const [jobResult, questionsResult, applicationResult] = await Promise.all([
        supabase
          .from('job_postings')
          .select(`
            *,
            profiles!job_postings_employer_id_fkey (
              first_name,
              last_name,
              company_name,
              company_logo_url
            )
          `)
          .eq('id', jobId)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('job_questions')
          .select('*')
          .eq('job_id', jobId!)
          .order('order_index'),
        user
          ? supabase
              .from('job_applications')
              .select('id, custom_answers')
              .eq('job_id', jobId!)
              .eq('applicant_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (jobResult.error) {
        // If auth-related error, retry once after a short delay
        if (retryCount < 2 && (jobResult.error.message?.includes('JWT') || jobResult.error.code === 'PGRST301')) {
          console.log('JobView: Auth not ready, retrying in 1s...');
          setTimeout(() => fetchJob(retryCount + 1), 1000);
          return;
        }
        throw jobResult.error;
      }

      const data = jobResult.data;

      // Job not found (deleted or doesn't exist)
      if (!data) {
        setJob(null);
        setLoading(false);
        hasLoadedOnce.current = true;
        return;
      }

      const questions = (!questionsResult.error && questionsResult.data) ? questionsResult.data as JobQuestion[] : [];
      const applied = !!applicationResult.data;

      if (jobId) {
        _jobCache.set(jobId, { job: data, questions, applied });
      }

      setJob(data);
      setJobQuestions(questions);
      setHasAlreadyApplied(applied);

      // If already applied, load saved answers from the application
      if (applied && applicationResult.data?.custom_answers) {
        const savedAnswers = applicationResult.data.custom_answers as Record<string, any>;
        if (savedAnswers && typeof savedAnswers === 'object') {
          setAnswers(savedAnswers);
        }
      }
      hasLoadedOnce.current = true;
      setLoading(false);

      // Resolve image URL
      // Use desktop image only on wide screens, mobile image on small screens
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
      const rawImageUrl = isDesktop
        ? (data.job_image_desktop_url || data.job_image_url)
        : (data.job_image_url || data.job_image_desktop_url);
      if (rawImageUrl) {
        let resolved: string | null = null;
        if (typeof rawImageUrl === 'string' && rawImageUrl.startsWith('http')) {
          resolved = rawImageUrl;
        } else {
          const pub = supabase.storage
            .from('job-images')
            .getPublicUrl(rawImageUrl).data.publicUrl;
          if (pub && pub.includes('/storage/')) {
            resolved = pub;
          }
        }
        if (resolved) {
          const cachedBlob = imageCache.getCachedUrl(resolved);
          setImageUrl(cachedBlob || resolved);
          if (!cachedBlob) {
            imageCache.loadImage(resolved).catch(() => {});
          }
        } else if (rawImageUrl) {
          convertToSignedUrl(rawImageUrl, 'job-applications', 3600).then(signed => {
            if (signed) {
              setImageUrl(signed);
              imageCache.loadImage(signed).catch(() => {});
            }
          }).catch(() => {});
        }
      }

      // Prefetch company logo
      if (data.profiles?.company_logo_url) {
        const rawLogo = data.profiles.company_logo_url;
        setCompanyLogoUrl(imageCache.getCachedUrl(rawLogo) || rawLogo);
        imageCache.loadImage(rawLogo).then(blobUrl => {
          setCompanyLogoUrl(blobUrl);
        }).catch(() => {});
      }
    } catch (error: any) {
      console.error('JobView fetch error:', error);
      // Retry once on network/auth errors
      if (retryCount < 2) {
        console.log(`JobView: Retrying fetch (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchJob(retryCount + 1), 1500);
        return;
      }
      toast({
        title: 'Fel',
        description: 'Kunde inte hämta jobbet. Försök ladda om sidan.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: value };
      try { localStorage.setItem(`job-answers-draft-${jobId}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const allRequiredQuestionsAnswered = () => {
    const requiredQuestions = jobQuestions.filter(q => q.is_required);
    return requiredQuestions.every(q => {
      const answer = answers[q.id];
      if (answer === undefined || answer === null || answer === '') return false;
      if (typeof answer === 'string' && answer.trim() === '') return false;
      return true;
    });
  };

  const canSubmitApplication = allRequiredQuestionsAnswered();
  const isJobExpired = job ? getTimeRemaining(job.created_at, job.expires_at).isExpired : false;
  const { isOnline, showOfflineToast } = useOnline();

  const handleApplicationSubmit = async () => {
    // Block employers from applying
    if (isEmployer) {
      toast({
        title: 'Inte tillåtet',
        description: 'Du är inloggad som arbetsgivare och kan inte söka jobb.',
        variant: 'destructive',
      });
      return;
    }


    const missingRequired = jobQuestions
      .filter(q => q.is_required)
      .find(q => !answers[q.id] || answers[q.id] === '');

    if (missingRequired) {
      toast({
        title: 'Obligatoriska fält saknas',
        description: 'Vänligen besvara alla obligatoriska frågor',
        variant: 'destructive',
      });
      return;
    }

    try {
      setApplying(true);

      // Double-check role from database to prevent race conditions
      if (user?.id) {
        const { data: roleCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        
        if (roleCheck?.role === 'employer') {
          toast({
            title: 'Inte tillåtet',
            description: 'Du är inloggad som arbetsgivare och kan inte söka jobb.',
            variant: 'destructive',
          });
          setApplying(false);
          return;
        }
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, email, home_location, location, birth_date, bio, cv_url, availability, employment_type')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      let age = null;
      if (profile?.birth_date) {
        const birthYear = new Date(profile.birth_date).getFullYear();
        age = new Date().getFullYear() - birthYear;
      }
      
      const { error } = await supabase
        .from('job_applications')
        .insert({
          job_id: jobId,
          applicant_id: user?.id,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          email: user?.email || profile?.email || null,
          phone: profile?.phone || null,
          location: profile?.home_location || profile?.location || null,
          age: age,
          bio: profile?.bio || null,
          cv_url: profile?.cv_url || null,
          availability: profile?.availability || null,
          employment_status: profile?.employment_type || null,
          custom_answers: answers,
          status: 'pending'
        });

      if (error) throw error;

      // Send confirmation email
      const applicantEmail = user?.email || profile?.email;
      if (applicantEmail) {
        const emailPayload = {
          applicant_email: applicantEmail,
          applicant_first_name: profile?.first_name || 'Sökande',
          job_title: job?.title || 'Tjänst',
          company_name: job?.profiles?.company_name || 'Företag',
        };
        console.log('📧 Sending application confirmation email:', { to: emailPayload.applicant_email, job: emailPayload.job_title });
        supabase.functions.invoke('send-application-confirmation', { body: emailPayload })
          .then(({ data, error }) => {
            if (error) console.error('❌ Confirmation email failed:', error);
            else console.log('✅ Confirmation email sent:', data);
          });
      }

      if (profile?.cv_url) {
        supabase.functions.invoke('generate-cv-summary', {
          body: { applicant_id: user?.id, job_id: jobId },
        }).catch(err => console.warn('Background CV summary generation failed:', err));
      }

      toast({
        title: 'Ansökan skickad!',
        description: 'Din ansökan har skickats till arbetsgivaren',
      });

      try { localStorage.removeItem(`job-answers-draft-${jobId}`); } catch {}
      setTimeout(() => { navigate('/search-jobs'); }, 1500);
    } catch (error: any) {
      toast({
        title: 'Ett fel uppstod',
        description: error.message || 'Kunde inte skicka ansökan',
        variant: 'destructive',
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading || (!job && !hasLoadedOnce.current)) {
    return null;
  }

  if (!job && hasLoadedOnce.current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <div className="text-white text-lg font-medium">Jobbet hittades inte</div>
        <p className="text-white/60 text-sm text-center max-w-sm">
          Jobbet kan ha tagits bort eller så är länken felaktig.
        </p>
        <Button variant="glass" onClick={() => navigate('/search-jobs', { replace: true })}>
          Sök andra jobb
        </Button>
      </div>
    );
  }

  const handleBack = () => {
    const state = window.history.state as any;
    const idx = typeof state?.idx === 'number' ? state.idx : undefined;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
    } else {
      navigate('/search-jobs', { replace: true });
    }
  };

  return (
    <div ref={contentRef} className="h-[100dvh] overflow-y-auto animate-fade-in">
       <div className="jobview-container py-4">
        {/* Combined header */}
        <div className={`flex items-center mb-4 bg-white/10 backdrop-blur-sm p-3 rounded-lg ${user ? 'justify-between' : 'justify-center gap-3'}`}>
          {user && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 h-11 px-5 rounded-full bg-white/10 [@media(hover:hover)]:hover:bg-white/20 active:bg-white/15 active:scale-[0.97] transition-all text-white text-sm font-medium backdrop-blur-sm border border-white/15 touch-manipulation"
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </button>
          )}
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCompanyProfile(true)}
              className="flex items-center space-x-2 hover:bg-white/10 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage 
                  src={companyLogoUrl || ''} 
                  alt={job.profiles?.company_name || 'Företagslogga'}
                />
                <AvatarFallback className="bg-white/20 text-white font-semibold text-sm" delayMs={150}>
                  {job.profiles?.company_name
                    ? job.profiles.company_name.substring(0, 2).toUpperCase()
                    : job.profiles?.first_name && job.profiles?.last_name
                    ? `${job.profiles.first_name[0]}${job.profiles.last_name[0]}`.toUpperCase()
                    : 'FÖ'}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <h3 className="text-white font-bold text-sm">
                  {job.profiles?.company_name || 
                   `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
                   'Företag'}
                </h3>
                <div className="flex items-center text-[10px] mt-0.5 text-white">
                  <Users className="h-2.5 w-2.5 mr-0.5 text-white" />
                  Se företagsprofil
                </div>
              </div>
            </button>

            <button
              onClick={async () => {
                const shareUrl = `${window.location.origin}/job/${jobId}`;
                const shareData = {
                  title: job.title,
                  text: `${job.title} hos ${job.profiles?.company_name || 'Företag'} – ${job.location || ''}`,
                  url: shareUrl,
                };
                if (navigator.share) {
                  try {
                    await navigator.share(shareData);
                  } catch {}
                } else {
                  await navigator.clipboard.writeText(shareUrl);
                  toast({ title: 'Länk kopierad!', description: 'Annonsens länk har kopierats till urklipp' });
                }
              }}
              className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all"
              aria-label="Dela annons"
            >
              <Share2 className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-3 space-y-3">
            
            {/* Hero section */}
            <JobViewHero
              title={job.title}
              imageUrl={imageUrl}
              companyName={job.profiles?.company_name || 'Okänt företag'}
              location={job.location}
              employmentType={job.employment_type}
              positionsCount={job.positions_count}
            />

            {/* Description */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
              <h2 className="text-section-title mb-3">Om tjänsten</h2>
              <p className="text-body whitespace-pre-wrap break-words overflow-hidden">
                {job.description}
              </p>
            </div>

            {/* Details */}
            <JobViewDetails
              employmentType={job.employment_type}
              workSchedule={job.work_schedule}
              location={job.location}
              workplaceName={job.workplace_name}
              workplaceAddress={job.workplace_address}
              workplacePostalCode={job.workplace_postal_code}
              workplaceCity={job.workplace_city}
              workplaceMunicipality={job.workplace_municipality}
              workplaceCounty={job.workplace_county}
              workLocationType={job.work_location_type}
              remoteWorkPossible={job.remote_work_possible}
              workStartTime={job.work_start_time}
              workEndTime={job.work_end_time}
              positionsCount={job.positions_count}
              occupation={job.occupation}
              salaryMin={job.salary_min}
              salaryMax={job.salary_max}
              salaryType={job.salary_type}
              salaryTransparency={job.salary_transparency}
              contactEmail={job.contact_email}
              jobTitle={job.title}
            />

            {/* Benefits */}
            <JobViewBenefits benefits={job.benefits || []} />

            {/* Questions info for unauthenticated users */}
            {!user && jobQuestions.length > 0 && !isJobExpired && (
              <div className="bg-white/[0.06] backdrop-blur-md rounded-lg p-4 border border-white/[0.06] text-center space-y-1.5">
                <h2 className="text-sm font-semibold text-[#FFFFFF]">{jobQuestions.length === 1 ? 'Ansökningsfråga' : 'Ansökningsfrågor'} ({jobQuestions.length} st)</h2>
                <p className="text-xs text-[#FFFFFF]">
                  För att vi ska kunna behandla din ansökan vidare behöver du besvara följande {jobQuestions.length === 1 ? 'fråga' : 'frågor'}. Observera att detta endast kan göras i samband med att du skapar ett konto.
                </p>
              </div>
            )}

            {/* Application section for logged in users */}
            {user && !isEmployer && (
              <>
                {/* Application questions */}
                {jobQuestions.length > 0 && !isJobExpired && (
                  <div className="bg-white/[0.06] backdrop-blur-md rounded-lg p-4 border border-white/[0.06]">
                    <h2 className="text-section-title mb-3">Ansökningsfrågor</h2>
                    <ApplicationQuestionsWizard
                      questions={jobQuestions as (JobQuestion & { id: string })[]}
                      answers={answers}
                      onAnswerChange={handleAnswerChange}
                      onSubmit={handleApplicationSubmit}
                      isSubmitting={applying}
                      canSubmit={canSubmitApplication}
                      hasAlreadyApplied={hasAlreadyApplied}
                      contactEmail={job.contact_email}
                      jobTitle={job.title}
                    />
                  </div>
                )}

                {/* No questions - direct submit */}
                {jobQuestions.length === 0 && !isJobExpired && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center space-y-4">
                    <h3 className="text-lg font-medium text-white">Redo att ansöka?</h3>
                    <p className="text-sm text-white">Detta jobb kräver inga extra frågor.</p>
                    
                    {job.contact_email && (
                      <div className="pt-2">
                        <p className="text-xs text-white mb-1">Har du frågor?</p>
                        <a 
                          href={`mailto:${job.contact_email}?subject=Fråga om tjänsten: ${job.title}`}
                          className="text-sm text-white hover:text-white/80 transition-colors underline underline-offset-2"
                        >
                          {job.contact_email}
                        </a>
                      </div>
                    )}

                    <div className="flex justify-center pt-2">
                      {hasAlreadyApplied ? (
                        <Button
                          variant="glass"
                          className="px-8 bg-green-500/20 text-green-300 border-green-500/30"
                          disabled
                        >
                          <CheckCircle className="mr-1.5 h-4 w-4" />
                          Redan sökt
                        </Button>
                      ) : (
                        <Button
                          variant={canSubmitApplication ? "glassGreen" : "glass"}
                          onClick={handleApplicationSubmit}
                          disabled={applying || !canSubmitApplication}
                          className={`px-8 ${!canSubmitApplication ? 'opacity-50' : ''}`}
                        >
                          {applying ? 'Skickar...' : (
                            <>
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              Skicka ansökan
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Info for employer users - cannot apply */}
            {user && isEmployer && !isJobExpired && (
              <div className="bg-white/[0.06] backdrop-blur-md rounded-lg p-4 border border-white/[0.06] text-center space-y-1.5">
                <p className="text-sm text-[#FFFFFF]">
                  Du är inloggad som arbetsgivare och kan inte söka jobb. Byt till jobbsökarkontot för att ansöka.
                </p>
              </div>
            )}

            {/* Auth CTA for unauthenticated users */}
            {!user && !isJobExpired && (
              <div className="bg-white/[0.06] backdrop-blur-md rounded-xl p-6 text-center space-y-4 border border-white/[0.08]">
                <h3 className="text-lg font-semibold text-[#FFFFFF]">Intresserad?</h3>
                <p className="text-sm text-[#FFFFFF]">
                  Logga in eller skapa ett konto för att söka denna tjänst.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button
                    variant="glassGreen"
                    onClick={() => navigate('/auth', { state: { returnTo: `/job-view/${jobId}` } })}
                    className="px-8"
                  >
                    Logga in
                  </Button>
                  <Button
                    variant="glass"
                    onClick={() => navigate('/auth', { state: { returnTo: `/job-view/${jobId}`, mode: 'register' } })}
                    className="px-8"
                  >
                    Skapa konto
                  </Button>
                </div>
              </div>
            )}

            {/* Footer: published date & countdown */}
            <JobViewFooter createdAt={job.created_at} expiresAt={job.expires_at} />
          </div>
        </div>
      </div>

      {/* Company Profile Dialog */}
      {job && (
        <CompanyProfileDialog
          open={showCompanyProfile}
          onOpenChange={setShowCompanyProfile}
          companyId={job.employer_id}
        />
      )}
    </div>
  );
};

export default JobView;

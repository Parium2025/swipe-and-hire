import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useJobViewTracker } from '@/hooks/useJobViewTracker';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { Button } from '@/components/ui/button';
import { useOnline } from '@/hooks/useOnlineStatus';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getTimeRemaining } from '@/lib/date';
import { getBenefitLabel } from '@/types/jobWizard';
import type { JobQuestion } from '@/types/jobWizard';
import {
  capitalize as cap,
  getSalaryTypeLabel,
  formatSalary,
  getWorkLocationLabel,
  getRemoteWorkLabel,
  getSalaryTransparencyLabel,
} from '@/lib/jobViewHelpers';
import { ArrowLeft, Send, Users, Timer, CheckCircle, Building2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import { convertToSignedUrl } from '@/utils/storageUtils';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { imageCache } from '@/lib/imageCache';
import { TruncatedText } from '@/components/TruncatedText';
import { ApplicationQuestionsWizard } from '@/components/ApplicationQuestionsWizard';

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
  const { user } = useAuth();
  
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  
  // Seed from module cache to eliminate blank frame on remount
  const cached = jobId ? _jobCache.get(jobId) : undefined;
  const [job, setJob] = useState<JobPosting | null>(cached?.job ?? null);
  const [loading, setLoading] = useState(!cached);
  const [jobQuestions, setJobQuestions] = useState<JobQuestion[]>(cached?.questions ?? []);
  const hasLoadedOnce = useRef(!!cached);
  const [applying, setApplying] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    // Sync: resolve from cache at mount for instant hero image
    const rawImg = cached?.job?.job_image_desktop_url || cached?.job?.job_image_url;
    if (!rawImg) return null;
    let resolved = rawImg;
    if (!rawImg.startsWith('http')) {
      const pub = supabase.storage.from('job-images').getPublicUrl(rawImg).data.publicUrl;
      resolved = pub && pub.includes('/storage/') ? pub : rawImg;
    }
    return imageCache.getCachedUrl(resolved) || resolved;
  });
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(() => {
    // Sync: check if logo is already in the image cache
    const rawLogo = cached?.job?.profiles?.company_logo_url;
    return rawLogo ? (imageCache.getCachedUrl(rawLogo) || rawLogo) : null;
  });
  const [hasAlreadyApplied, setHasAlreadyApplied] = useState(cached?.applied ?? false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Track job view when user reads content
  useJobViewTracker({
    jobId,
    userId: user?.id,
    contentRef,
    scrollThreshold: 0.7,
    minTimeOnPage: 3000,
  });
  
  // Preloada bilden när den finns tillgänglig
  useImagePreloader(imageUrl ? [imageUrl] : [], { priority: 'high' });

  useEffect(() => {
    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  const fetchJob = async () => {
    try {
      // 🔥 Fetch job + questions + application status ALL in PARALLEL
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
          .eq('is_active', true)
          .single(),
        supabase
          .from('job_questions')
          .select('*')
          .eq('job_id', jobId!)
          .order('order_index'),
        user
          ? supabase
              .from('job_applications')
              .select('id')
              .eq('job_id', jobId!)
              .eq('applicant_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (jobResult.error) throw jobResult.error;
      const data = jobResult.data;

      // 🔥 CRITICAL: Batch ALL state updates + setLoading in ONE synchronous block
      // React 18 batches these into a single render — no flicker possible
      const questions = (!questionsResult.error && questionsResult.data) ? questionsResult.data as JobQuestion[] : [];
      const applied = !!applicationResult.data;

      // Persist in module-level cache so viewport-resize remounts are instant
      if (jobId) {
        _jobCache.set(jobId, { job: data, questions, applied });
      }

      setJob(data);
      setJobQuestions(questions);
      setHasAlreadyApplied(applied);
      hasLoadedOnce.current = true;
      setLoading(false);

      // Resolve image URL — check cache FIRST for instant display
      const rawImageUrl = data.job_image_desktop_url || data.job_image_url;
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
          // Sync: use cached blob URL if available (from search card preload)
          const cachedBlob = imageCache.getCachedUrl(resolved);
          setImageUrl(cachedBlob || resolved);
          // Background: ensure it's cached for future visits
          if (!cachedBlob) {
            imageCache.loadImage(resolved).catch(() => {});
          }
        } else if (rawImageUrl) {
          // Legacy signed URL fallback (async)
          convertToSignedUrl(rawImageUrl, 'job-applications', 3600).then(signed => {
            if (signed) {
              setImageUrl(signed);
              imageCache.loadImage(signed).catch(() => {});
            }
          }).catch(() => {});
        }
      }

      // Prefetch company logo and store cached blob URL
      if (data.profiles?.company_logo_url) {
        const rawLogo = data.profiles.company_logo_url;
        // Set raw URL immediately so avatar shows something
        setCompanyLogoUrl(imageCache.getCachedUrl(rawLogo) || rawLogo);
        // Then cache it for instant future renders
        imageCache.loadImage(rawLogo).then(blobUrl => {
          setCompanyLogoUrl(blobUrl);
        }).catch(() => {});
      }
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: 'Kunde inte hämta jobbet',
        variant: 'destructive',
      });
      navigate('/search-jobs');
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Check if all required questions are answered
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
  
  // Check if job is expired
  const isJobExpired = job ? getTimeRemaining(job.created_at, job.expires_at).isExpired : false;

  // Helper functions are now imported from '@/lib/jobViewHelpers'

  const { isOnline, showOfflineToast } = useOnline();

  const handleApplicationSubmit = async () => {
    if (!isOnline) {
      showOfflineToast();
      return;
    }

    // Validate required questions
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
      
      // Fetch user profile to get contact info
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, email, home_location, location, birth_date, bio, cv_url, availability, employment_type')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      // Calculate age from birth_date
      let age = null;
      if (profile?.birth_date) {
        const birthYear = new Date(profile.birth_date).getFullYear();
        age = new Date().getFullYear() - birthYear;
      }
      
      // Save application to database with contact info
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

      // Trigger CV summary generation in background (fire and forget)
      if (profile?.cv_url) {
        supabase.functions.invoke('generate-cv-summary', {
          body: {
            applicant_id: user?.id,
            job_id: jobId,
          },
        }).catch(err => console.warn('Background CV summary generation failed:', err));
      }

      toast({
        title: 'Ansökan skickad!',
        description: 'Din ansökan har skickats till arbetsgivaren',
      });

      setTimeout(() => {
        navigate('/search-jobs');
      }, 1500);
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

  // Mobile now uses the same layout as desktop (responsive)

  // Desktop/Tablet view - no loading text, just fade in content
  if (loading && !hasLoadedOnce.current) {
    return null; // Return nothing on FIRST load only for smooth fade-in
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Jobbet hittades inte</div>
      </div>
    );
  }

  const handleBack = () => {
    const state = window.history.state as any;
    const idx = typeof state?.idx === 'number' ? state.idx : undefined;

    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
    } else {
      // No previous route in React Router history — go to search
      navigate('/search-jobs', { replace: true });
    }
  };

  return (
    <div ref={contentRef} className="h-[100dvh] overflow-y-auto bg-parium-gradient will-change-scroll overscroll-contain [-webkit-overflow-scrolling:touch] animate-fade-in">
       <div className="jobview-container py-4">
        {/* Combined header: Tillbaka + Spara + Företag på samma rad */}
        <div className="flex items-center justify-between mb-4 bg-white/10 backdrop-blur-sm p-3 rounded-lg">
          {/* Vänster: Tillbaka */}
          <Button
            type="button"
            onClick={handleBack}
            variant="glass"
            className="h-7 px-2.5 text-xs"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Tillbaka
          </Button>
          
          {/* Företagsinfo till höger - clickable */}
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
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          
          {/* Left column - Job info */}
          <div className="lg:col-span-3 space-y-3">
            
            {imageUrl && (
              <div className="relative w-full h-64 md:h-80 overflow-hidden rounded-lg">
                <img
                  src={imageUrl}
                  alt={`${job.title} hos ${job.profiles?.company_name || 'företaget'}`}
                  className="w-full h-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                  onLoad={() => {}}
                  onError={(e) => {
                    console.error('Job image failed to load', imageUrl);
                    setImageUrl(null);
                  }}
                />
                {/* Gradient overlay för läsbarhet av text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Text overlay — alla skärmstorlekar, bottom-aligned */}
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end text-center px-4 pb-4 sm:px-6 sm:pb-6">
                  {/* Titel */}
                  <TruncatedText
                    text={job.title}
                    className="text-white text-[15px] sm:text-xl md:text-2xl lg:text-3xl font-bold leading-snug sm:leading-tight max-w-4xl w-full text-center line-clamp-2 sm:line-clamp-3"
                    tooltipSide="bottom"
                  />
                  
                  {/* Company + Location — mobil */}
                  <div className="mt-2 sm:hidden flex items-center justify-center gap-1.5 text-[13px] text-white">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                    <span className="truncate font-medium">{job.profiles?.company_name || 'Okänt företag'}</span>
                    {job.location && (
                      <>
                        <span className="text-white/30">·</span>
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                        <span className="truncate">{job.location}</span>
                      </>
                    )}
                  </div>

                  {/* Badges — mobil */}
                  <div className="mt-1.5 sm:hidden flex items-center justify-center gap-1.5 flex-wrap">
                    {job.employment_type && (
                      <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none">
                        {getEmploymentTypeLabel(job.employment_type)}
                      </Badge>
                    )}
                    {job.positions_count && job.positions_count > 1 && (
                      <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none inline-flex items-center">
                        <Users className="h-3 w-3 mr-0.5 flex-shrink-0" />
                        <span className="leading-none">{job.positions_count} lediga tjänster</span>
                      </Badge>
                    )}
                  </div>

                  {/* Metadata — desktop/tablet */}
                  <div className="mt-4 hidden sm:flex flex-wrap items-center justify-center gap-2 text-sm md:text-base text-white">
                    {job.employment_type && (
                      <span className="text-white">{getEmploymentTypeLabel(job.employment_type).toUpperCase()}</span>
                    )}
                    {job.employment_type && job.location && (
                      <span className="text-white/60">·</span>
                    )}
                    {job.location && (
                      <span className="text-white">{job.location.toUpperCase()}</span>
                    )}
                    {job.positions_count && job.positions_count > 1 && (
                      <>
                        <span className="text-white/60">·</span>
                        <span className="text-white">{job.positions_count} lediga tjänster</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Om det inte finns bild, visa titel i vanligt kort */}
            {!imageUrl && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
                <TruncatedText
                  text={job.title}
                  className="text-white text-xl md:text-2xl font-bold leading-tight line-clamp-3"
                  tooltipSide="bottom"
                />
                <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-white">
                  {job.employment_type && (
                    <span>{getEmploymentTypeLabel(job.employment_type).toUpperCase()}</span>
                  )}
                  {job.location && (
                    <>
                      <span className="text-white/60">·</span>
                      <span>{job.location.toUpperCase()}</span>
                    </>
                  )}
                  {job.positions_count && job.positions_count > 1 && (
                    <>
                      <span className="text-white/60">·</span>
                      <span>{job.positions_count} lediga tjänster</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ━━━ PREMIUM SECTION ORDER ━━━ */}

            {/* 1. Om tjänsten (Description) */}

            {/* 2. Om tjänsten (Description) */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
              <h2 className="text-section-title mb-3">Om tjänsten</h2>
              <p className="text-body whitespace-pre-wrap break-words overflow-hidden">
                {job.description}
              </p>
            </div>


            {/* 4. Detaljer om tjänsten — kompakt faktaruta */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
              <h2 className="text-section-title mb-3">
                Detaljer om tjänsten
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {/* Anställningsform */}
                {job.employment_type && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Anställning:</span>
                    <span className="font-medium">{getEmploymentTypeLabel(job.employment_type)}</span>
                  </div>
                )}

                {/* Arbetsschema */}
                {job.work_schedule && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Schema:</span>
                    <span className="font-medium">{cap(job.work_schedule)}</span>
                  </div>
                )}

                {/* Plats */}
                {job.location && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Ort:</span>
                    <span className="font-medium">{cap(job.location)}</span>
                  </div>
                )}

                {/* Bolagsnamn */}
                {job.workplace_name && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Bolagsnamn:</span>
                    <span className="font-medium">{cap(job.workplace_name)}</span>
                  </div>
                )}

                {/* Arbetsplatsadress */}
                {job.workplace_address && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Adress:</span>
                    <span className="font-medium">
                      {job.workplace_address}
                      {job.workplace_postal_code && `, ${job.workplace_postal_code}`}
                      {job.workplace_city && ` ${job.workplace_city}`}
                      {job.workplace_municipality && job.workplace_municipality !== job.workplace_city && ` (${job.workplace_municipality})`}
                    </span>
                  </div>
                )}

                {/* Arbetsort (om skild från location) */}
                {job.workplace_city && job.workplace_city !== job.location && !job.workplace_address && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Stad:</span>
                    <span className="font-medium">
                      {job.workplace_city}
                      {job.workplace_municipality && job.workplace_municipality !== job.workplace_city ? `, ${job.workplace_municipality}` : ''}
                      {job.workplace_county ? `, ${job.workplace_county}` : ''}
                    </span>
                  </div>
                )}

                {/* Kommun */}
                {job.workplace_municipality && !job.workplace_address && (!job.workplace_city || job.workplace_city === job.location) && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Kommun:</span>
                    <span className="font-medium">{job.workplace_municipality}</span>
                  </div>
                )}

                {/* Platstyp */}
                {job.work_location_type && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Platstyp:</span>
                    <span className="font-medium">{getWorkLocationLabel(job.work_location_type)}</span>
                  </div>
                )}

                {/* Distansarbete */}
                {job.remote_work_possible && job.remote_work_possible !== 'no' && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Distans:</span>
                    <span className="font-medium">{getRemoteWorkLabel(job.remote_work_possible)}</span>
                  </div>
                )}

                {/* Arbetstider */}
                {(job.work_start_time || job.work_end_time) && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Arbetstid:</span>
                    <span className="font-medium">{job.work_start_time} – {job.work_end_time}</span>
                  </div>
                )}

                {/* Antal tjänster */}
                {job.positions_count && job.positions_count > 1 && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Antal tjänster:</span>
                    <span className="font-medium">{job.positions_count} st</span>
                  </div>
                )}

                {/* Yrkeskategori */}
                {job.occupation && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Yrke:</span>
                    <span className="font-medium">{cap(job.occupation)}</span>
                  </div>
                )}

                {/* Lön */}
                {formatSalary(job.salary_min, job.salary_max, job.salary_type) && (
                  <div className="flex text-white text-sm sm:col-span-2 pt-1">
                    <span className="shrink-0 w-[110px]">Lön:</span>
                    <span className="font-semibold">
                      {formatSalary(job.salary_min, job.salary_max, job.salary_type)}
                      {job.salary_type && (
                        <span className="text-white/70 ml-1.5 text-xs">({getSalaryTypeLabel(job.salary_type)})</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Lönetransparens fallback */}
                {!formatSalary(job.salary_min, job.salary_max, job.salary_type) && job.salary_transparency && (
                  <div className="flex text-white text-sm">
                    <span className="shrink-0 w-[110px]">Lön:</span>
                    <span className="font-medium">{getSalaryTransparencyLabel(job.salary_transparency)}</span>
                  </div>
                )}

                {/* Kontakt */}
                {job.contact_email && (
                  <div className="flex text-white text-sm sm:col-span-2 pt-1">
                    <span className="shrink-0 w-[110px]">Kontakt:</span>
                    <a 
                      href={`mailto:${job.contact_email}?subject=Fråga om tjänsten: ${job.title}`}
                      className="font-medium underline underline-offset-2 hover:text-white/80 transition-colors"
                    >
                      {job.contact_email}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Förmåner */}
            {job.benefits && job.benefits.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
                <h2 className="text-section-title mb-3">
                  Förmåner
                </h2>
                <div className="flex flex-wrap gap-2">
                  {job.benefits.map((benefit, index) => (
                    <Badge key={index} variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                      {getBenefitLabel(benefit)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}


            {/* 6. Ansökningsfrågor */}
            {jobQuestions.length > 0 && !isJobExpired && (
              <div className="bg-white/[0.06] backdrop-blur-md rounded-lg p-4 border border-white/[0.06]">
                <h2 className="text-section-title mb-3">
                  Ansökningsfrågor
                </h2>
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

            {/* No questions - show direct submit */}
            {jobQuestions.length === 0 && !isJobExpired && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center space-y-4">
                <h3 className="text-lg font-medium text-white">Redo att ansöka?</h3>
                <p className="text-sm text-white/60">Detta jobb kräver inga extra frågor.</p>
                
                {job.contact_email && (
                  <div className="pt-2">
                    <p className="text-xs text-white/40 mb-1">Har du frågor?</p>
                    <a 
                      href={`mailto:${job.contact_email}?subject=Fråga om tjänsten: ${job.title}`}
                      className="text-sm text-white/60 hover:text-white transition-colors underline underline-offset-2"
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

            {/* Publicerad & countdown — diskret, kompakt */}
            <div className="flex items-center justify-center gap-3 py-2 text-xs">
              <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none">
                Publicerad: {new Date(job.created_at).toLocaleDateString('sv-SE', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Badge>
              {(() => {
                const { text, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
                if (isExpired) {
                  return (
                    <Badge variant="glass" className="text-[11px] px-2 py-0.5 bg-red-500/20 text-white border-red-500/30 leading-none">
                      Utgången
                    </Badge>
                  );
                }
                return (
                  <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none">
                    <Timer className="h-3 w-3 mr-1" />
                    {text} kvar
                  </Badge>
                );
              })()}
            </div>
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

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import { useJobViewTracker } from '@/hooks/useJobViewTracker';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import JobSwipe from '@/components/JobSwipe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOnline } from '@/hooks/useOnlineStatus';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getTimeRemaining } from '@/lib/date';
import { MapPin, Clock, Euro, Building2, ArrowLeft, Send, FileText, Video, CheckSquare, List, Users, Briefcase, Gift, CalendarClock, Hash, Timer, CheckCircle, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import { convertToSignedUrl } from '@/utils/storageUtils';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { imageCache } from '@/lib/imageCache';
import { TruncatedText } from '@/components/TruncatedText';
interface JobQuestion {
  id: string;
  question_text: string;
  question_type: 'text' | 'yes_no' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range' | 'video';
  options?: string[];
  is_required: boolean;
  order_index: number;
  min_value?: number;
  max_value?: number;
  placeholder_text?: string;
}

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
  contact_email?: string;
  application_instructions?: string;
  pitch?: string;
  benefits?: string[];
  positions_count?: number;
  workplace_city?: string;
  workplace_county?: string;
  workplace_address?: string;
  created_at: string;
  expires_at?: string;
  employer_id: string;
  job_image_url?: string;
  profiles: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
    company_logo_url?: string;
  };
}

const JobView = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const device = useDevice();
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobQuestions, setJobQuestions] = useState<JobQuestion[]>([]);
  const [applying, setApplying] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasAlreadyApplied, setHasAlreadyApplied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Track job view when user reads content
  useJobViewTracker({
    jobId,
    userId: user?.id,
    contentRef,
    scrollThreshold: 0.7, // 70% scrolled
    minTimeOnPage: 3000, // 3 seconds minimum
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
      const { data, error } = await supabase
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
        .single();

      if (error) throw error;
      setJob(data);

      // Load job image if exists
      if (data.job_image_url) {
        try {
          let resolved: string | null = null;

          // If already a public URL, use as-is (stable for SW cache)
          if (typeof data.job_image_url === 'string' && data.job_image_url.startsWith('http')) {
            resolved = data.job_image_url;
          } else {
            // Prefer public URL from job-images (bucket is public)
            const pub = supabase.storage
              .from('job-images')
              .getPublicUrl(data.job_image_url).data.publicUrl;
            if (pub && pub.includes('/storage/')) {
              resolved = pub;
            } else {
              // Legacy fallback: private job-applications requires signed URL
              const legacySigned = await convertToSignedUrl(data.job_image_url, 'job-applications', 3600);
              if (legacySigned) resolved = legacySigned;
            }
          }

          if (resolved) {
            setImageUrl(resolved);
            // 🔥 Prefetch the job image to blob cache for instant display
            imageCache.loadImage(resolved).catch(() => {});
          } else {
            console.warn('Kunde inte lösa jobbbildens URL', data.job_image_url);
          }
        } catch (err) {
          console.error('Error loading job image:', err);
        }
      }

      // 🔥 Prefetch company logo to eliminate flicker
      if (data.profiles?.company_logo_url) {
        imageCache.loadImage(data.profiles.company_logo_url).catch(() => {});
      }

      // Fetch job questions
      const { data: questions, error: questionsError } = await supabase
        .from('job_questions')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index');

      if (!questionsError && questions) {
        setJobQuestions(questions as JobQuestion[]);
      }

      // Kolla om användaren redan har ansökt till detta jobb
      if (user) {
        const { data: existingApplication } = await supabase
          .from('job_applications')
          .select('id')
          .eq('job_id', jobId)
          .eq('applicant_id', user.id)
          .maybeSingle();
        
        setHasAlreadyApplied(!!existingApplication);
      }
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: 'Kunde inte hämta jobbet',
        variant: 'destructive',
      });
      navigate('/search-jobs');
    } finally {
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

  // Use centralized benefit labels from jobWizard types
  const getBenefitLabelLocal = (benefit: string): string => {
    const labels: Record<string, string> = {
      friskvard: 'Friskvård',
      tjanstepension: 'Tjänstepension',
      kollektivavtal: 'Kollektivavtal',
      'flexibla-tider': 'Flexibla arbetstider',
      bonus: 'Bonus',
      tjanstebil: 'Tjänstebil',
      mobiltelefon: 'Mobiltelefon',
      utbildning: 'Utbildning',
      forsakringar: 'Försäkringar',
      'extra-semester': 'Extra semester',
      gym: 'Gym/träning',
      foraldraledighet: 'Föräldraledighet',
      foraldraledithet: 'Föräldraledighet', // Legacy typo support
      lunch: 'Lunch/mat',
      'fri-parkering': 'Fri parkering',
      personalrabatter: 'Personalrabatter',
      hemarbete: 'Hemarbete',
      pension: 'Pension',
      // Legacy values
      friskvardsbidrag: 'Friskvård',
      flexibla_arbetstider: 'Flexibla arbetstider',
      'flexibla-arbetstider': 'Flexibla arbetstider',
      fri_fika: 'Fri fika/frukt',
      'fri-fika-frukt': 'Fri fika/frukt',
      fri_parkering: 'Fri parkering',
    };
    // Capitalize first letter if no match found
    if (!labels[benefit]) {
      return benefit.charAt(0).toUpperCase() + benefit.slice(1).replace(/-/g, ' ');
    }
    return labels[benefit];
  };

  // Map salary type to Swedish label
  const getSalaryTypeLabel = (salaryType: string): string => {
    const labels: Record<string, string> = {
      monthly: 'Månadslön',
      hourly: 'Timlön',
      fixed: 'Fast lön',
      commission: 'Provision',
    };
    return labels[salaryType] || salaryType;
  };

  const formatSalary = (min?: number, max?: number, salaryType?: string) => {
    const suffix = salaryType === 'hourly' ? 'kr/tim' : 'kr/mån';
    if (!min && !max) return null;
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} ${suffix}`;
    if (min) return `Från ${min.toLocaleString()} ${suffix}`;
    if (max) return `Upp till ${max.toLocaleString()} ${suffix}`;
    return null;
  };

  const renderQuestionInput = (question: JobQuestion) => {
    const currentAnswer = answers[question.id];

    switch (question.question_type) {
      case 'text':
        return (
          <Textarea
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder_text || 'Skriv ditt svar här...'}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[60px] max-h-[120px] resize-none text-sm focus:outline-none focus:border-white/40"
          />
        );

      case 'yes_no':
        return (
          <div className="flex justify-center">
            <div className="inline-flex gap-2">
              <button
                type="button"
                onClick={() => handleAnswerChange(question.id, currentAnswer === 'yes' ? '' : 'yes')}
                className={
                  (currentAnswer === 'yes'
                    ? 'bg-secondary/40 border-secondary text-white '
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/15 ') +
                  'border rounded-full px-6 py-2 text-sm transition-colors font-medium'
                }
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() => handleAnswerChange(question.id, currentAnswer === 'no' ? '' : 'no')}
                className={
                  (currentAnswer === 'no'
                    ? 'bg-secondary/40 border-secondary text-white '
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/15 ') +
                  'border rounded-full px-6 py-2 text-sm transition-colors font-medium'
                }
              >
                Nej
              </button>
            </div>
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="flex flex-wrap justify-center gap-2">
            {question.options?.filter(opt => opt.trim() !== '').map((option, index) => {
              const selectedAnswers = typeof currentAnswer === 'string' 
                ? currentAnswer.split('|||').filter(a => a)
                : [];
              const selected = selectedAnswers.includes(option);
              
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    const answersArray = typeof currentAnswer === 'string'
                      ? currentAnswer.split('|||').filter(a => a)
                      : [];
                    
                    if (answersArray.includes(option)) {
                      const newAnswers = answersArray.filter(a => a !== option);
                      handleAnswerChange(question.id, newAnswers.join('|||'));
                    } else {
                      handleAnswerChange(question.id, [...answersArray, option].join('|||'));
                    }
                  }}
                  className={
                    (selected
                      ? 'bg-secondary/40 border-secondary '
                      : 'bg-white/10 border-white/20 hover:bg-white/15 ') +
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 border transition-colors'
                  }
                >
                  <div className={
                    selected
                      ? 'w-2 h-2 rounded-full bg-white flex-shrink-0'
                      : 'w-2 h-2 rounded-full border border-white/40 flex-shrink-0'
                  } />
                  <span className="text-sm text-white whitespace-nowrap">{option}</span>
                </button>
              );
            })}
          </div>
        );

      case 'number':
        const minVal = question.min_value ?? 0;
        const maxVal = question.max_value ?? 100;
        const currentVal = Number(currentAnswer || minVal);
        const percentage = ((currentVal - minVal) / (maxVal - minVal)) * 100;
        
        return (
          <div className="space-y-3">
            <div className="text-center text-lg font-semibold text-white">
              {currentVal}
            </div>
            <input
              type="range"
              min={minVal}
              max={maxVal}
              value={currentVal}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full"
              style={{
                background: `linear-gradient(to right, white ${percentage}%, rgba(255,255,255,0.3) ${percentage}%)`
              }}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            />
            <div className="flex justify-between text-xs text-white">
              <span>{minVal}</span>
              <span>{maxVal}</span>
            </div>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white h-10 text-sm focus:outline-none focus:border-white/40"
          />
        );

      case 'file':
        return (
          <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center bg-white/5">
            <FileText className="h-6 w-6 mx-auto mb-2 text-white" />
            <p className="text-sm text-white">Välj fil</p>
          </div>
        );

      case 'video':
        return (
          <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center bg-white/5">
            <Video className="h-6 w-6 mx-auto mb-2 text-white" />
            <p className="text-sm text-white">Spela in video</p>
          </div>
        );

      default:
        return (
          <Input
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder_text || 'Skriv ditt svar här...'}
            className="bg-white/10 border-white/20 text-white placeholder:text-white h-10 text-sm focus:outline-none focus:border-white/40"
          />
        );
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="h-3.5 w-3.5 text-white" />;
      case 'yes_no': return <CheckSquare className="h-3.5 w-3.5 text-white" />;
      case 'multiple_choice': return <List className="h-3.5 w-3.5 text-white" />;
      case 'video': return <Video className="h-3.5 w-3.5 text-white" />;
      default: return <FileText className="h-3.5 w-3.5 text-white" />;
    }
  };

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

  // Show swipe interface on mobile
  if (device === 'mobile') {
    return <JobSwipe />;
  }

  // Desktop/Tablet view - no loading text, just fade in content
  if (loading) {
    return null; // Return nothing while loading for smooth fade-in
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Jobbet hittades inte</div>
      </div>
    );
  }

  const handleBack = () => {
    const currentPath = window.location.pathname;
    const fallback = () => window.location.assign('/search-jobs');

    const state = window.history.state as any;
    const idx = typeof state?.idx === 'number' ? state.idx : undefined;

    // Prefer going back when possible...
    if ((typeof idx === 'number' && idx > 0) || window.history.length > 1) {
      navigate(-1);

      // ...but if routing/history is broken (or there is no real previous entry), force exit.
      window.setTimeout(() => {
        if (window.location.pathname === currentPath) fallback();
      }, 150);
      return;
    }

    // No usable history -> force exit immediately.
    fallback();
  };

  return (
    <div ref={contentRef} className="min-h-screen bg-parium-gradient animate-fade-in overflow-y-auto">
       <div className="max-w-4xl mx-auto px-3 md:px-8 py-4">
        {/* Combined header: Tillbaka + Spara + Företag på samma rad */}
        <div className="flex items-center justify-between mb-4 bg-white/10 backdrop-blur-sm p-3 rounded-lg">
          {/* Vänster: Tillbaka */}
          <Button
            type="button"
            onClick={handleBack}
            variant="glass"
            className="h-9 px-3 text-sm"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Tillbaka
          </Button>
          
          {/* Företagsinfo till höger - clickable */}
          <button
            onClick={() => setShowCompanyProfile(true)}
            className="flex items-center space-x-2 hover:bg-white/10 p-1.5 rounded-lg transition-all cursor-pointer"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage 
                src={job.profiles?.company_logo_url || ''} 
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
                  onLoad={() => console.log('Job image loaded', imageUrl)}
                  onError={(e) => {
                    console.error('Job image failed to load', imageUrl);
                    setImageUrl(null);
                  }}
                />
                {/* Gradient overlay för läsbarhet */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                
                {/* Text overlay - Simplex style */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                {/* Huvudrubrik - kompakt och centrerad, tillåt radbrytning */}
                  <TruncatedText
                    text={job.title}
                    className="text-white text-xl md:text-2xl lg:text-3xl font-bold leading-tight max-w-4xl w-full text-center line-clamp-3"
                    tooltipSide="bottom"
                  />
                  
                  {/* Metadata på en rad under rubriken */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm md:text-base text-white">
                    {job.employment_type && (
                      <>
                        <Briefcase className="h-3.5 w-3.5 text-white" />
                        <span className="text-white">{getEmploymentTypeLabel(job.employment_type).toUpperCase()}</span>
                      </>
                    )}
                    {job.employment_type && job.location && (
                      <span className="text-white/60">·</span>
                    )}
                    {job.location && (
                      <>
                        <MapPin className="h-3.5 w-3.5 text-white" />
                        <span className="text-white">{job.location.toUpperCase()}</span>
                      </>
                    )}
                    {job.positions_count && job.positions_count > 1 && (
                      <>
                        <span className="text-white/60">·</span>
                        <Hash className="h-3.5 w-3.5 text-white" />
                        <span className="text-white">{job.positions_count} lediga tjänster</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Om det inte finns bild, visa info i vanligt kort */}
            {!imageUrl && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 overflow-hidden">
                <TruncatedText
                  text={job.title}
                  className="text-white text-xl md:text-2xl font-bold mb-3 leading-tight line-clamp-3"
                  tooltipSide="bottom"
                />

                <div className="space-y-2">
                  <div className="flex items-center text-white text-xs">
                    <MapPin className="h-3.5 w-3.5 mr-1.5 text-white" />
                    <span className="text-white">{job.location}</span>
                  </div>

                  {job.employment_type && (
                    <div className="flex items-center text-white text-xs">
                      <Briefcase className="h-3.5 w-3.5 mr-1.5 text-white" />
                      <span className="text-white">{getEmploymentTypeLabel(job.employment_type)}</span>
                    </div>
                  )}

                  {job.work_schedule && (
                    <div className="flex items-center text-white text-xs">
                      <Clock className="h-3.5 w-3.5 mr-1.5 text-white" />
                      <span className="text-white">{job.work_schedule}</span>
                    </div>
                    )}

                  {formatSalary(job.salary_min, job.salary_max, job.salary_type) && (
                    <div className="flex items-center text-green-300 text-sm font-semibold pt-0.5">
                      <Euro className="h-4 w-4 mr-1.5" />
                      <span>{formatSalary(job.salary_min, job.salary_max, job.salary_type)}</span>
                    </div>
                  )}

                  {job.positions_count && job.positions_count > 1 && (
                    <div className="flex items-center text-white text-xs">
                      <Hash className="h-3.5 w-3.5 mr-1.5 text-white" />
                      <span className="text-white">{job.positions_count} lediga tjänster</span>
                    </div>
                  )}

                  {(job.work_start_time || job.work_end_time) && (
                    <div className="flex items-center text-white text-xs">
                      <CalendarClock className="h-3.5 w-3.5 mr-1.5 text-white" />
                      <span className="text-white">Arbetstider: {job.work_start_time} - {job.work_end_time}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pitch - short highlight text */}
            {job.pitch && (
              <div className="bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-lg p-4">
                <p className="text-white text-sm md:text-base italic leading-relaxed">
                  "{job.pitch}"
                </p>
              </div>
            )}

            {/* Description */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <h2 className="text-section-title mb-3">Om tjänsten</h2>
              <p className="text-body whitespace-pre-wrap">
                {job.description}
              </p>
            </div>

            {job.benefits && job.benefits.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h2 className="text-section-title mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Förmåner
                </h2>
                <div className="flex flex-wrap gap-2">
                  {job.benefits.map((benefit, index) => (
                    <Badge key={index} variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                      {getBenefitLabelLocal(benefit)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Application instructions if exists */}
            {job.application_instructions && (
              <div className="bg-blue-400/20 backdrop-blur-sm border border-blue-300/30 rounded-lg p-4">
                <h2 className="text-section-title mb-3 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Ansökningsinstruktioner
                </h2>
                <p className="text-body whitespace-pre-wrap">
                  {job.application_instructions}
                </p>
              </div>
            )}

            {/* Questions */}
            {jobQuestions.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-section-title">Ansökningsfrågor</h2>
                
                {jobQuestions.map((question, index) => (
                  <div key={question.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="mb-4 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
                        {index + 1} / {jobQuestions.length}
                      </div>
                      <h3 className="text-sm font-medium text-white leading-snug">
                        {question.question_text}
                        {question.is_required && (
                          <span className="ml-1 text-red-400">*</span>
                        )}
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {renderQuestionInput(question)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contact info if exists - after questions */}
            {job.contact_email && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <h3 className="text-sm font-medium text-white mb-1">Har du frågor?</h3>
                <a 
                  href={`mailto:${job.contact_email}?subject=Fråga om tjänsten: ${job.title}`}
                  className="text-xs text-white/60 hover:text-white transition-colors underline underline-offset-2"
                >
                  {job.contact_email}
                </a>
              </div>
            )}

            {/* Submit application button - only show when job is not expired */}
            {!isJobExpired && (
              <div className="flex justify-center">
                {hasAlreadyApplied ? (
                  <Button
                    size="lg"
                    variant="glass"
                    className="h-11 px-8 text-sm font-semibold bg-green-500/20 text-green-300 border-green-500/30 cursor-default hover:bg-green-500/20"
                    disabled
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Redan sökt
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant={canSubmitApplication ? "glassGreen" : "glass"}
                    className={`h-11 px-8 text-sm font-semibold ${
                      !canSubmitApplication ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                    onClick={handleApplicationSubmit}
                    disabled={applying || !canSubmitApplication}
                  >
                    {applying ? (
                      'Skickar...'
                    ) : (
                      <>
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Skicka ansökan
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Job posted date and countdown */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center space-y-2">
              {/* Expired job warning - inside the same box */}
              {isJobExpired && (
                <p className="text-red-400 text-sm font-medium">
                  Denna annons har utgått och tar inte längre emot ansökningar.
                </p>
              )}
              <p className="text-body-sm">
                Publicerad: {new Date(job.created_at).toLocaleDateString('sv-SE', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              {(() => {
                const { text, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
                if (isExpired) {
                  return (
                    <Badge variant="secondary" className="bg-red-500/20 text-white border-red-500/30 text-xs hover:bg-red-500/30 hover:border-red-500/50 transition-all duration-300">
                      Utgången
                    </Badge>
                  );
                }
                return (
                  <Badge variant="glass" className="text-xs">
                    <Timer className="h-3 w-3 mr-1" />
                    {text} kvar att ansöka
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

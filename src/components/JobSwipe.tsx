import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { MapPin, Clock, Euro, Heart, X, Building2, Users, Mail, Info, Briefcase, Gift, CalendarClock, Hash } from 'lucide-react';
import JobApplicationDialog from './JobApplicationDialog';
import { toast } from '@/hooks/use-toast';
import { preloadImages } from '@/lib/serviceWorkerManager';

// Map benefit keys to Swedish labels
const getBenefitLabel = (benefit: string): string => {
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
    foraldraledithet: 'Föräldraledighet',
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
  employer_id: string;
  job_image_url?: string;
  profiles: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
}

const JobSwipe = () => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [currentJobIndex, setCurrentJobIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [currentJobQuestions, setCurrentJobQuestions] = useState<any[]>([]);
  const [currentJobImageUrl, setCurrentJobImageUrl] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchJobs();
  }, []);

  // Förladdda alla jobbbilder via Service Worker
  const jobImageUrls = jobs
    .map(job => job.job_image_url)
    .filter(Boolean) as string[];
  
  useEffect(() => {
    if (jobImageUrls.length > 0) {
      preloadImages(jobImageUrls);
    }
  }, [jobImageUrls]);

  // Load current job image
  useEffect(() => {
    const loadCurrentJobImage = async () => {
      const currentJob = jobs[currentJobIndex];
      if (!currentJob?.job_image_url) {
        setCurrentJobImageUrl(null);
        return;
      }

      try {
        // If already a full URL, use as-is
        if (currentJob.job_image_url.startsWith('http')) {
          setCurrentJobImageUrl(currentJob.job_image_url);
          return;
        }

        // Get public URL from job-images bucket
        const { data } = supabase.storage
          .from('job-images')
          .getPublicUrl(currentJob.job_image_url);
        
        if (data?.publicUrl) {
          setCurrentJobImageUrl(data.publicUrl);
        } else {
          setCurrentJobImageUrl(null);
        }
      } catch (err) {
        console.error('Error loading job image:', err);
        setCurrentJobImageUrl(null);
      }
    };

    loadCurrentJobImage();
  }, [jobs, currentJobIndex]);

  const fetchJobs = async () => {
    try {
      // Limit to 100 jobs at a time for performance - swipe through them
      // In production, would implement infinite scroll/pagination
      const { data, error } = await supabase
        .from('job_postings')
        .select(`
          *,
          profiles!job_postings_employer_id_fkey (
            first_name,
            last_name,
            company_name
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(100); // Limit for scalability

      if (error) {
        toast({
          title: "Fel vid hämtning av jobb",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      setJobs(data || []);
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte hämta jobbannonser.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (jobId: string, liked: boolean) => {
    if (swiping) return;
    setSwiping(true);

    try {
      if (liked) {
        // When liked, fetch questions and show application dialog
        const { data: questions, error } = await supabase
          .from('job_questions')
          .select('*')
          .eq('job_id', jobId)
          .order('order_index');

        if (error) {
          console.error('Error fetching questions:', error);
        }

        setCurrentJobQuestions(questions || []);
        setShowApplicationDialog(true);
        setSwiping(false);
      } else {
        // Not interested, just move to next job
        toast({
          title: "Inte intressant",
          description: "Du har passerat denna tjänst"
        });

        setTimeout(() => {
          setCurrentJobIndex(prev => prev + 1);
          setSwiping(false);
        }, 300);
      }
    } catch (error) {
      setSwiping(false);
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte registrera ditt val.",
        variant: "destructive"
      });
    }
  };

  const handleApplicationSubmit = async (answers: Record<string, any>) => {
    try {
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

      // Extract standard fields from answers and prepare custom_answers
      const { first_name, last_name, email, phone, location: answerLocation, age: answerAge, ...customAnswers } = answers;
      
      // Clean custom answers - remove 'custom_' prefix from keys
      const cleanedCustomAnswers: Record<string, any> = {};
      Object.entries(customAnswers).forEach(([key, value]) => {
        const cleanKey = key.startsWith('custom_') ? key.replace('custom_', '') : key;
        cleanedCustomAnswers[cleanKey] = value;
      });
      
      // Save application to database with contact info
      const { error } = await supabase
        .from('job_applications')
        .insert({
          job_id: currentJob.id,
          applicant_id: user?.id,
          first_name: first_name || profile?.first_name || null,
          last_name: last_name || profile?.last_name || null,
          email: email || user?.email || profile?.email || null,
          phone: phone || profile?.phone || null,
          location: answerLocation || profile?.home_location || profile?.location || null,
          age: answerAge ? parseInt(answerAge) : age,
          bio: profile?.bio || null,
          cv_url: profile?.cv_url || null,
          availability: profile?.availability || null,
          employment_status: profile?.employment_type || null,
          custom_answers: cleanedCustomAnswers,
          status: 'pending'
        });

      if (error) throw error;

      // Queue CV for analysis (rate-limit safe, handles millions of users)
      if (profile?.cv_url) {
        supabase.rpc('queue_cv_analysis', {
          p_applicant_id: user?.id,
          p_cv_url: profile.cv_url,
          p_job_id: currentJob.id,
          p_priority: 5, // Normal priority for applications
        }).then(({ error }) => {
          if (error) console.warn('Failed to queue CV for analysis:', error);
          else {
            // Trigger queue processor in background
            supabase.functions.invoke('process-cv-queue').catch(() => {});
          }
        });
      }

      toast({
        title: "Ansökan skickad!",
        description: "Din ansökan har skickats till arbetsgivaren"
      });

      // Move to next job
      setTimeout(() => {
        setCurrentJobIndex(prev => prev + 1);
        setShowApplicationDialog(false);
      }, 1000);
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skicka ansökan",
        variant: "destructive"
      });
    }
  };

  const handleCardClick = async () => {
    try {
      const { data: questions, error } = await supabase
        .from('job_questions')
        .select('*')
        .eq('job_id', currentJob.id)
        .order('order_index');
      
      if (!error) {
        setCurrentJobQuestions(questions || []);
      }
      setShowApplicationDialog(true);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setCurrentJobQuestions([]);
      setShowApplicationDialog(true);
    }
  };

  const formatSalary = (min?: number, max?: number, salaryType?: string) => {
    const typeLabel = salaryType ? getSalaryTypeLabel(salaryType) : '';
    const suffix = salaryType === 'hourly' ? 'kr/tim' : 'kr/mån';
    
    if (!min && !max) return 'Lön enligt överenskommelse';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} ${suffix}${typeLabel ? ` (${typeLabel})` : ''}`;
    if (min) return `Från ${min.toLocaleString()} ${suffix}${typeLabel ? ` (${typeLabel})` : ''}`;
    if (max) return `Upp till ${max.toLocaleString()} ${suffix}${typeLabel ? ` (${typeLabel})` : ''}`;
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Laddar jobb...</h2>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-white mb-4" />
          <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Inga jobb tillgängliga</h2>
          <p className="text-sm text-white">Kom tillbaka senare för fler möjligheter!</p>
        </div>
      </div>
    );
  }

  if (currentJobIndex >= jobs.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Heart className="mx-auto h-12 w-12 text-white mb-4" />
          <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">Du har sett alla jobb!</h2>
          <p className="text-sm text-white">Kom tillbaka senare för fler möjligheter!</p>
          <Button 
            onClick={() => {
              setCurrentJobIndex(0);
              fetchJobs();
            }}
            className="mt-4"
          >
            Börja om
          </Button>
        </div>
      </div>
    );
  }

  const currentJob = jobs[currentJobIndex];

  return (
    <div className="max-w-md mx-auto p-3 sm:p-4 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="mb-4 text-center">
        <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Upptäck jobb</h2>
        <p className="text-sm text-white mt-1">
          {currentJobIndex + 1} av {jobs.length} jobb
        </p>
      </div>

      <div className="relative">
        <Card
          className={`overflow-hidden border-2 transition-all duration-300 ${swiping ? 'scale-95 opacity-50' : ''} cursor-pointer`}
          onClick={handleCardClick}
        >
          {/* Job Image */}
          {currentJobImageUrl && (
            <div className="relative w-full h-48 md:h-56 overflow-hidden">
              <img
                src={currentJobImageUrl}
                alt={`${currentJob.title} hos ${currentJob.profiles?.company_name || 'företaget'}`}
                className="w-full h-full object-cover"
                loading="eager"
                fetchPriority="high"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              {/* Title overlay on image */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-white" />
                  <span className="text-white text-sm font-medium">
                    {currentJob.profiles?.company_name || 
                     `${currentJob.profiles?.first_name} ${currentJob.profiles?.last_name}` || 
                     'Företag'}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">{currentJob.title}</h3>
              </div>
            </div>
          )}

          <CardContent className={`${currentJobImageUrl ? 'p-3 md:p-4' : 'p-3 md:p-6'} space-y-3 md:space-y-4`}>
            {/* Company info - only show if no image */}
            {!currentJobImageUrl && (
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-white" />
                <span className="font-medium text-white">
                  {currentJob.profiles?.company_name || 
                   `${currentJob.profiles?.first_name} ${currentJob.profiles?.last_name}` || 
                   'Företag'}
                </span>
              </div>
            )}

            {/* Job title - only show if no image */}
            {!currentJobImageUrl && (
              <h3 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">{currentJob.title}</h3>
            )}

            {/* Location and type */}
            <div className="flex flex-wrap gap-2 mb-2 md:mb-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {currentJob.workplace_city && currentJob.workplace_county 
                  ? `${currentJob.workplace_city}, ${currentJob.workplace_county}`
                  : currentJob.location}
              </Badge>
              {currentJob.employment_type && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {getEmploymentTypeLabel(currentJob.employment_type)}
                </Badge>
              )}
              {currentJob.positions_count && currentJob.positions_count > 1 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {currentJob.positions_count} tjänster
                </Badge>
              )}
            </div>

            {/* Salary with transparency */}
            <div className="mb-3 md:mb-4">
              <div className="flex items-center gap-1 md:gap-2 text-base md:text-lg font-semibold text-green-400">
                <Euro className="h-5 w-5" />
                {formatSalary(currentJob.salary_min, currentJob.salary_max, currentJob.salary_type)}
              </div>
              {currentJob.salary_transparency && (
                <p className="text-sm text-white mt-1">
                  Lönetransparens: {currentJob.salary_transparency}
                </p>
              )}
            </div>

            {/* Work hours */}
            {(currentJob.work_start_time || currentJob.work_end_time) && (
              <div className="mb-3 md:mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-white" />
                  <span className="text-white">Arbetstider:</span>
                  <span className="text-white">{currentJob.work_start_time} - {currentJob.work_end_time}</span>
                </div>
              </div>
            )}

            {/* Pitch - short description */}
            {currentJob.pitch && (
              <div className="mb-3 md:mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm md:text-base italic">"{currentJob.pitch}"</p>
              </div>
            )}

            {/* Description */}
            <div className="mb-3 md:mb-4">
              <h4 className="font-semibold mb-2 text-base md:text-lg text-white">Beskrivning</h4>
              <p className="text-sm md:text-base text-white leading-relaxed whitespace-pre-wrap">
                {currentJob.description}
              </p>
            </div>

            {/* Benefits */}
            {currentJob.benefits && currentJob.benefits.length > 0 && (
              <div className="mb-3 md:mb-4">
                <h4 className="font-semibold mb-2 text-base md:text-lg flex items-center gap-2 text-white">
                  <Gift className="h-4 w-4" />
                  Förmåner
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentJob.benefits.map((benefit, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {getBenefitLabel(benefit)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Application Instructions */}
            {currentJob.application_instructions && (
              <div className="mb-3 md:mb-4">
                <h4 className="font-semibold mb-2 text-base md:text-lg flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Så här ansöker du
                </h4>
                <p className="text-sm md:text-base text-white leading-relaxed">
                  {currentJob.application_instructions}
                </p>
              </div>
            )}

            {/* Contact Info */}
            {currentJob.contact_email && (
              <div className="mb-3 md:mb-6">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                  <Mail className="h-4 w-4" />
                  Kontakt
                </h4>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`mailto:${currentJob.contact_email}?subject=Fråga om tjänsten: ${currentJob.title}`, '_blank');
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Maila arbetsgivaren
                </Button>
                <p className="text-sm text-white mt-1 text-center">
                  {currentJob.contact_email}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Swipe buttons */}
        <div className="flex justify-center gap-4 sm:gap-6 mt-6">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16 border-2 border-red-200 hover:border-red-300 hover:bg-red-50 min-h-[56px] min-w-[56px]"
            onClick={(e) => { e.stopPropagation(); handleSwipe(currentJob.id, false); }}
            disabled={swiping}
          >
            <X className="h-6 w-6 sm:h-7 sm:w-7 text-red-500" />
          </Button>
          
          <Button
            size="lg"
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-green-500 hover:bg-green-600 border-0 min-h-[56px] min-w-[56px]"
            onClick={(e) => { e.stopPropagation(); handleSwipe(currentJob.id, true); }}
            disabled={swiping}
          >
            <Heart className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </Button>
        </div>

        {/* Swipe instructions */}
        <div className="text-center mt-4 text-sm text-white">
          <p>Tryck ❤️ om du är intresserad eller ✕ för att passa</p>
        </div>
      </div>

      <JobApplicationDialog
        open={showApplicationDialog}
        onOpenChange={setShowApplicationDialog}
        job={currentJob}
        questions={currentJobQuestions}
        onSubmit={handleApplicationSubmit}
      />
    </div>
  );
};

export default JobSwipe;
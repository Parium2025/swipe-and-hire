import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { MapPin, Clock, Euro, Heart, X, Building2, Users, Mail, Info } from 'lucide-react';
import JobApplicationDialog from './JobApplicationDialog';
import { toast } from '@/hooks/use-toast';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  employment_type?: string;
  work_schedule?: string;
  contact_email?: string;
  application_instructions?: string;
  created_at: string;
  employer_id: string;
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
  const { user } = useAuth();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
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
        .order('created_at', { ascending: false });

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
      // Here you would save the application to database
      // For now, just show success message
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

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return 'Lön enligt överenskommelse';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl">Laddar jobb...</h2>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Inga jobb tillgängliga</h2>
          <p className="text-muted-foreground">Kom tillbaka senare för fler möjligheter!</p>
        </div>
      </div>
    );
  }

  if (currentJobIndex >= jobs.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Du har sett alla jobb!</h2>
          <p className="text-muted-foreground">Kom tillbaka senare för fler möjligheter!</p>
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
        <h2 className="text-lg sm:text-xl font-bold">Upptäck jobb</h2>
        <p className="text-sm text-muted-foreground">
          {currentJobIndex + 1} av {jobs.length} jobb
        </p>
      </div>

      <div className="relative">
        <Card
          className={`overflow-hidden border-2 transition-all duration-300 ${swiping ? 'scale-95 opacity-50' : ''} cursor-pointer`}
          onClick={handleCardClick}
        >
          <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
            {/* Company info */}
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">
                {currentJob.profiles?.company_name || 
                 `${currentJob.profiles?.first_name} ${currentJob.profiles?.last_name}` || 
                 'Företag'}
              </span>
            </div>

            {/* Job title */}
            <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">{currentJob.title}</h3>

            {/* Location and type */}
            <div className="flex flex-wrap gap-2 mb-2 md:mb-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {currentJob.location}
              </Badge>
              {currentJob.employment_type && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {getEmploymentTypeLabel(currentJob.employment_type)}
                </Badge>
              )}
            </div>

            {/* Salary */}
            <div className="mb-3 md:mb-4">
              <div className="flex items-center gap-1 md:gap-2 text-base md:text-lg font-semibold text-green-600">
                <Euro className="h-5 w-5" />
                {formatSalary(currentJob.salary_min, currentJob.salary_max)}
              </div>
              {currentJob.work_schedule && (
                <p className="text-sm text-muted-foreground mt-1">
                  Arbetstider: {currentJob.work_schedule}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="mb-3 md:mb-4">
              <h4 className="font-semibold mb-1 md:mb-2 text-base md:text-lg">Beskrivning</h4>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                {currentJob.description}
              </p>
            </div>

            {/* Application Instructions */}
            {currentJob.application_instructions && (
              <div className="mb-2 md:mb-4">
                <h4 className="font-semibold mb-1 md:mb-2 text-base md:text-lg flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Så här ansöker du
                </h4>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  {currentJob.application_instructions}
                </p>
              </div>
            )}

            {/* Contact Info */}
            {currentJob.contact_email && (
              <div className="mb-3 md:mb-6">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
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
                <p className="text-sm text-muted-foreground mt-1 text-center">
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
        <div className="text-center mt-4 text-sm text-muted-foreground">
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
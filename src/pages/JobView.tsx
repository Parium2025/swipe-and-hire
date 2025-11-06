import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import JobSwipe from '@/components/JobSwipe';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { MapPin, Clock, Euro, Heart, X, Building2, Mail, Info, ArrowLeft, Send, Users, Briefcase } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import JobApplicationDialog from '@/components/JobApplicationDialog';

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

const JobView = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const device = useDevice();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [jobQuestions, setJobQuestions] = useState<any[]>([]);
  const [applying, setApplying] = useState(false);

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
            company_name
          )
        `)
        .eq('id', jobId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      setJob(data);

      // Fetch job questions
      const { data: questions, error: questionsError } = await supabase
        .from('job_questions')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index');

      if (!questionsError) {
        setJobQuestions(questions || []);
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

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return 'Lön enligt överenskommelse';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return '';
  };

  const handleApply = () => {
    setShowApplicationDialog(true);
  };

  const handleApplicationSubmit = async (answers: Record<string, any>) => {
    try {
      setApplying(true);
      
      // Save application to database
      const { error } = await supabase
        .from('job_applications')
        .insert({
          job_id: jobId,
          applicant_id: user?.id,
          custom_answers: answers,
          status: 'pending'
        });

      if (error) throw error;

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

  // Desktop/Tablet view
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Laddar jobb...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Jobbet hittades inte</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-purple-600 to-pink-500 py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/search-jobs')}
          className="mb-6 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Tillbaka till sökning
        </Button>

        <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-2xl overflow-hidden shadow-2xl">
          <CardContent className="p-8 md:p-10 space-y-8">
            
            {/* Company Header - Clickable */}
            <div 
              className="flex items-center space-x-4 cursor-pointer transition-all duration-300 md:hover:bg-white/10 p-5 rounded-xl -mx-5"
              onClick={() => {
                toast({ 
                  title: 'Företagsprofil', 
                  description: 'Företagsprofiler kommer snart!' 
                });
              }}
            >
              <div className="bg-white/20 rounded-full p-4 shadow-lg">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-xl md:text-2xl">
                  {job.profiles?.company_name || 
                   `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
                   'Företag'}
                </h3>
                <div className="flex items-center text-white/80 text-sm">
                  <Users className="h-4 w-4 mr-1" />
                  Klicka för att se företagsprofil
                </div>
              </div>
            </div>

            {/* Job Title - Large and prominent */}
            <div>
              <h1 className="text-white text-3xl md:text-4xl font-bold leading-tight mb-6">
                {job.title}
              </h1>

              {/* Job details - Large icons and text */}
              <div className="space-y-4">
                <div className="flex items-center text-white/90 text-lg">
                  <div className="bg-white/20 rounded-full p-2 mr-4">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <span>{job.location}</span>
                </div>

                {job.employment_type && (
                  <div className="flex items-center text-white/90 text-lg">
                    <div className="bg-white/20 rounded-full p-2 mr-4">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                  </div>
                )}

                <div className="flex items-center text-green-300 text-xl font-semibold">
                  <div className="bg-green-500/20 rounded-full p-2 mr-4">
                    <Euro className="h-5 w-5 text-green-300" />
                  </div>
                  <span>{formatSalary(job.salary_min, job.salary_max)}</span>
                </div>

                {job.work_schedule && (
                  <div className="flex items-center text-white/90 text-lg">
                    <div className="bg-white/20 rounded-full p-2 mr-4">
                      <Briefcase className="h-5 w-5 text-white" />
                    </div>
                    <span>{job.work_schedule}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white/10 rounded-xl p-6 md:p-8 border border-white/20">
              <h4 className="text-white font-semibold text-xl mb-4 flex items-center">
                <Info className="h-5 w-5 mr-2" />
                Beskrivning
              </h4>
              <p className="text-white/90 text-base md:text-lg leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </div>

            {/* Application Instructions */}
            {job.application_instructions && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 md:p-8">
                <h4 className="text-white font-semibold text-xl mb-4 flex items-center">
                  <Info className="h-5 w-5 mr-2 text-blue-300" />
                  Ansökningsinstruktioner
                </h4>
                <p className="text-white/90 text-base md:text-lg leading-relaxed whitespace-pre-wrap">
                  {job.application_instructions}
                </p>
              </div>
            )}

            {/* Contact Info */}
            {job.contact_email && (
              <div className="bg-white/10 rounded-xl p-6 md:p-8 border border-white/20">
                <h4 className="text-white font-semibold text-xl mb-4 flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Kontaktinformation
                </h4>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <span className="text-white/90 text-lg">{job.contact_email}</span>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="bg-white/20 border-white/40 text-white transition-all duration-300 md:hover:bg-white/30 md:hover:text-white"
                    onClick={() => {
                      window.open(`mailto:${job.contact_email}?subject=Fråga om tjänsten: ${job.title}`, '_blank');
                    }}
                  >
                    <Mail className="h-5 w-5 mr-2" />
                    Kontakta arbetsgivaren
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons - Large and prominent */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button
                size="lg"
                className="flex-1 bg-green-500 hover:bg-green-600 text-white h-16 text-lg font-semibold shadow-lg transition-all duration-300 md:hover:scale-105"
                onClick={handleApply}
              >
                <Send className="mr-3 h-6 w-6" />
                Ansök nu
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="sm:w-16 h-16 bg-white/20 border-white/40 text-white transition-all duration-300 md:hover:bg-white/30 md:hover:text-white md:hover:scale-105 [&_svg]:text-white md:hover:[&_svg]:text-white"
                onClick={() => {
                  toast({ title: 'Sparad!', description: 'Jobbet har sparats till dina favoriter' });
                }}
              >
                <Heart className="h-6 w-6" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <JobApplicationDialog
        open={showApplicationDialog}
        onOpenChange={setShowApplicationDialog}
        job={job}
        questions={jobQuestions}
        onSubmit={handleApplicationSubmit}
      />
    </div>
  );
};

export default JobView;

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import JobSwipe from '@/components/JobSwipe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { MapPin, Clock, Euro, Heart, X, Building2, Mail, Info, ArrowLeft, Send } from 'lucide-react';
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
    <div className="min-h-screen py-6 px-3 md:px-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/search-jobs')}
        className="mb-4 text-white hover:bg-white/10"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Tillbaka till sökning
      </Button>

      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardHeader>
          {/* Company info */}
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-white/70" />
            <span className="text-white/90 font-medium">
              {job.profiles?.company_name || 
               `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
               'Företag'}
            </span>
          </div>

          <CardTitle className="text-2xl md:text-3xl text-white mb-4">
            {job.title}
          </CardTitle>

          {/* Location and employment type */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline" className="flex items-center gap-1 bg-white/10 text-white border-white/20">
              <MapPin className="h-3 w-3" />
              {job.location}
            </Badge>
            {job.employment_type && (
              <Badge variant="outline" className="flex items-center gap-1 bg-white/10 text-white border-white/20">
                <Clock className="h-3 w-3" />
                {getEmploymentTypeLabel(job.employment_type)}
              </Badge>
            )}
          </div>

          {/* Salary */}
          <div className="flex items-center gap-2 text-lg font-semibold text-green-400 mb-4">
            <Euro className="h-5 w-5" />
            {formatSalary(job.salary_min, job.salary_max)}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Work schedule */}
          {job.work_schedule && (
            <div>
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Arbetstider
              </h3>
              <p className="text-white/70">{job.work_schedule}</p>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-white font-semibold mb-2 text-lg">Om tjänsten</h3>
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
              {job.description}
            </p>
          </div>

          {/* Application Instructions */}
          {job.application_instructions && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-400" />
                Ansökningsinstruktioner
              </h3>
              <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                {job.application_instructions}
              </p>
            </div>
          )}

          {/* Contact Info */}
          {job.contact_email && (
            <div>
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Kontaktinformation
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-white/70">{job.contact_email}</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                  onClick={() => {
                    window.open(`mailto:${job.contact_email}?subject=Fråga om tjänsten: ${job.title}`, '_blank');
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Kontakta arbetsgivaren
                </Button>
              </div>
            </div>
          )}

          {/* Apply button */}
          <div className="flex gap-3 pt-4">
            <Button
              size="lg"
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              onClick={handleApply}
            >
              <Send className="mr-2 h-5 w-5" />
              Ansök nu
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
              onClick={() => {
                toast({ title: 'Sparad!', description: 'Jobbet har sparats till dina favoriter' });
              }}
            >
              <Heart className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

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

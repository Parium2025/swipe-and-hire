import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import JobSwipe from '@/components/JobSwipe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { MapPin, Clock, Euro, Building2, ArrowLeft, Send, FileText, Video, CheckSquare, List, Users, Briefcase } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  employment_type?: string;
  work_schedule?: string;
  contact_email?: string;
  application_instructions?: string;
  created_at: string;
  employer_id: string;
  image_url?: string;
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
  const [jobQuestions, setJobQuestions] = useState<JobQuestion[]>([]);
  const [applying, setApplying] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});

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

      if (!questionsError && questions) {
        setJobQuestions(questions as JobQuestion[]);
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

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return 'Lön enligt överenskommelse';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return '';
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
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[120px] resize-none"
          />
        );

      case 'yes_no':
        return (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleAnswerChange(question.id, currentAnswer === 'yes' ? '' : 'yes')}
              className={`w-full flex items-center space-x-3 p-4 rounded-lg border transition-all ${
                currentAnswer === 'yes'
                  ? 'bg-primary/20 border-primary'
                  : 'bg-white/10 border-white/20 hover:bg-white/15'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                currentAnswer === 'yes' ? 'border-primary' : 'border-white/40'
              }`}>
                {currentAnswer === 'yes' && <div className="w-3 h-3 rounded-full bg-primary" />}
              </div>
              <span className="text-white text-base flex-1 text-left">Ja</span>
            </button>
            <button
              type="button"
              onClick={() => handleAnswerChange(question.id, currentAnswer === 'no' ? '' : 'no')}
              className={`w-full flex items-center space-x-3 p-4 rounded-lg border transition-all ${
                currentAnswer === 'no'
                  ? 'bg-primary/20 border-primary'
                  : 'bg-white/10 border-white/20 hover:bg-white/15'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                currentAnswer === 'no' ? 'border-primary' : 'border-white/40'
              }`}>
                {currentAnswer === 'no' && <div className="w-3 h-3 rounded-full bg-primary" />}
              </div>
              <span className="text-white text-base flex-1 text-left">Nej</span>
            </button>
          </div>
        );

      case 'multiple_choice':
        return (
          <RadioGroup
            value={currentAnswer || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
            className="space-y-3"
          >
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3 p-4 rounded-lg bg-white/10 border border-white/20">
                <RadioGroupItem 
                  value={option} 
                  id={`${question.id}-${index}`} 
                  className="text-white border-white/40"
                />
                <Label htmlFor={`${question.id}-${index}`} className="text-white cursor-pointer flex-1">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder_text || 'Ange ett tal...'}
            min={question.min_value}
            max={question.max_value}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12"
          />
        );

      case 'file':
        return (
          <div className="bg-white/10 border border-white/20 rounded-lg p-6 text-center">
            <FileText className="h-10 w-10 text-white/60 mx-auto mb-3" />
            <p className="text-white/80 mb-4">Ladda upp en fil</p>
            <Button variant="outline" className="border-white/40 text-white hover:bg-white/10">
              Välj fil
            </Button>
          </div>
        );

      case 'video':
        return (
          <div className="bg-white/10 border border-white/20 rounded-lg p-6 text-center">
            <Video className="h-10 w-10 text-white/60 mx-auto mb-3" />
            <p className="text-white/80 mb-4">Spela in en kort video</p>
            <Button variant="outline" className="border-white/40 text-white hover:bg-white/10">
              Starta inspelning
            </Button>
          </div>
        );

      default:
        return (
          <Input
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder_text || 'Ditt svar...'}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12"
          />
        );
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="h-5 w-5 text-white" />;
      case 'yes_no': return <CheckSquare className="h-5 w-5 text-white" />;
      case 'multiple_choice': return <List className="h-5 w-5 text-white" />;
      case 'video': return <Video className="h-5 w-5 text-white" />;
      default: return <FileText className="h-5 w-5 text-white" />;
    }
  };

  const handleApplicationSubmit = async () => {
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
    <div className="min-h-screen bg-parium-gradient">
      {/* Back button - fixed top left */}
      <div className="fixed top-6 left-6 z-10">
        <Button
          variant="ghost"
          onClick={() => navigate('/search-jobs')}
          className="text-white hover:bg-white/10 backdrop-blur-sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-20">
        {/* Company header - clickable */}
        <div className="flex items-center space-x-4 mb-8 bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
          <div className="bg-white/20 rounded-full p-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-2xl">
              {job.profiles?.company_name || 
               `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
               'Företag'}
            </h3>
            <div className="flex items-center text-white/80 text-sm mt-1">
              <Users className="h-4 w-4 mr-1" />
              Se företagsprofil
            </div>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left column - Job info */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Job title & basic info */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
              <h1 className="text-white text-4xl font-bold mb-6 leading-tight">
                {job.title}
              </h1>

              <div className="space-y-4">
                <div className="flex items-center text-white/90 text-lg">
                  <MapPin className="h-6 w-6 mr-3 text-white/70" />
                  <span>{job.location}</span>
                </div>

                {job.employment_type && (
                  <div className="flex items-center text-white/90 text-lg">
                    <Briefcase className="h-6 w-6 mr-3 text-white/70" />
                    <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                  </div>
                )}

                {job.work_schedule && (
                  <div className="flex items-center text-white/90 text-lg">
                    <Clock className="h-6 w-6 mr-3 text-white/70" />
                    <span>{job.work_schedule}</span>
                  </div>
                )}

                <div className="flex items-center text-green-300 text-xl font-semibold pt-2">
                  <Euro className="h-6 w-6 mr-3" />
                  <span>{formatSalary(job.salary_min, job.salary_max)}</span>
                </div>
              </div>
            </div>

            {/* Image if exists */}
            {job.image_url && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 overflow-hidden">
                <img 
                  src={job.image_url} 
                  alt={job.title}
                  className="w-full h-64 object-cover rounded-xl"
                />
              </div>
            )}

            {/* Description */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
              <h2 className="text-white font-bold text-2xl mb-4">Om tjänsten</h2>
              <p className="text-white/90 leading-relaxed whitespace-pre-wrap text-lg">
                {job.description}
              </p>
            </div>

            {/* Application instructions if exists */}
            {job.application_instructions && (
              <div className="bg-blue-400/20 backdrop-blur-sm border border-blue-300/30 rounded-2xl p-8">
                <h2 className="text-white font-bold text-xl mb-3 flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Ansökningsinstruktioner
                </h2>
                <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                  {job.application_instructions}
                </p>
              </div>
            )}

            {/* Questions */}
            {jobQuestions.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-white font-bold text-3xl">Ansökningsfrågor</h2>
                
                {jobQuestions.map((question, index) => (
                  <div key={question.id} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                    <div className="flex items-start space-x-4 mb-6">
                      <div className="bg-white/20 rounded-full p-3">
                        {getQuestionIcon(question.question_type)}
                      </div>
                      <div className="flex-1">
                        <div className="text-white/70 text-sm mb-2">
                          Fråga {index + 1} av {jobQuestions.length}
                        </div>
                        <h3 className="text-white text-xl font-semibold leading-tight">
                          {question.question_text}
                          {question.is_required && (
                            <span className="text-red-300 ml-1">*</span>
                          )}
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {renderQuestionInput(question)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column - Sticky actions */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* Submit application button */}
              <Button
                size="lg"
                className="w-full h-16 bg-green-500 hover:bg-green-600 text-white text-lg font-semibold shadow-lg"
                onClick={handleApplicationSubmit}
                disabled={applying}
              >
                {applying ? (
                  'Skickar...'
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Skicka ansökan
                  </>
                )}
              </Button>

              {/* Contact info if exists */}
              {job.contact_email && (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                  <h3 className="text-white font-semibold text-lg mb-3">Kontakt</h3>
                  <p className="text-white/80 text-sm mb-3">{job.contact_email}</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full border-white/40 text-white hover:bg-white/10"
                    onClick={() => {
                      window.open(`mailto:${job.contact_email}?subject=Fråga om tjänsten: ${job.title}`, '_blank');
                    }}
                  >
                    Skicka e-post
                  </Button>
                </div>
              )}

              {/* Job posted date */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-white/70 text-sm">
                  Publicerad: {new Date(job.created_at).toLocaleDateString('sv-SE', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobView;

import { useState, useEffect, useCallback, useRef } from 'react';
import { recordJobView } from '@/lib/recordJobView';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { supabase } from '@/integrations/supabase/client';
import { getIsOnline } from '@/lib/connectivityManager';
import { useOfflineApplicationQueue } from '@/hooks/useOfflineApplicationQueue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import FileUpload from '@/components/FileUpload';
import { clearMyApplicationsLocalCache } from '@/hooks/useMyApplicationsCache';

// Draft key for localStorage
const JOB_APPLICATION_DRAFT_PREFIX = 'parium_draft_job-application-';

const getDraftKey = (jobId: string) => `${JOB_APPLICATION_DRAFT_PREFIX}${jobId}`;

// Clear draft for a specific job
export const clearJobApplicationDraft = (jobId: string) => {
  try {
    localStorage.removeItem(getDraftKey(jobId));
  } catch (e) {
    console.warn('Failed to clear job application draft');
  }
};

interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  profiles: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
}

interface JobQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options?: string[] | any;
  is_required: boolean;
  order_index: number;
  placeholder_text?: string;
  min_value?: number;
  max_value?: number;
}

const JobApplication = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const { enqueueApplication } = useOfflineApplicationQueue(user?.id);
  const viewRecorded = useRef(false);
  
  // Record a job view when user opens the application page (implies they saw the job)
  useEffect(() => {
    if (jobId && user?.id && !viewRecorded.current) {
      viewRecorded.current = true;
      recordJobView(jobId, user.id);
    }
  }, [jobId, user?.id]);
  const [job, setJob] = useState<JobPosting | null>(null);
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [initialFormData, setInitialFormData] = useState<any>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    // Standard fields
    age: '',
    location: '',
    driversLicense: '',
    hasOwnCar: '',
    previousRecyclingExperience: '',
    mainOccupation: '',
    whenCanStart: '',
    currentOccupation: [] as string[],
    isStudying: '',
    
    // Personal info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    personalLetter: '',
    cvUrl: '',
    additionalDocuments: '',
    
    // Custom questions answers
    customAnswers: {} as Record<string, any>
  });

  // Restore draft on mount
  useEffect(() => {
    if (jobId && !draftRestored) {
      try {
        const saved = localStorage.getItem(getDraftKey(jobId));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.formData) {
            setFormData(parsed.formData);
            console.log('💾 Job application draft restored');
          }
        }
      } catch (e) {
        console.warn('Failed to restore job application draft');
      }
      setDraftRestored(true);
    }
  }, [jobId, draftRestored]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!jobId || !draftRestored) return;
    
    // Check if there's any content to save
    const hasContent = Object.entries(formData).some(([key, value]) => {
      if (key === 'customAnswers') {
        return Object.keys(value as Record<string, any>).length > 0;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value && value !== '';
    });
    
    if (hasContent) {
      try {
        localStorage.setItem(getDraftKey(jobId), JSON.stringify({
          formData,
          savedAt: Date.now()
        }));
        console.log('💾 Job application draft saved');
      } catch (e) {
        console.warn('Failed to save job application draft');
      }
    }
  }, [formData, jobId, draftRestored]);

  // Track unsaved changes for navigation guard
  useEffect(() => {
    if (!initialFormData) return;
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    setHasUnsavedChanges(hasChanges);
  }, [formData, initialFormData, setHasUnsavedChanges]);

  // Listen for unsaved-confirm event to clear draft when user chooses "Lämna utan att spara"
  useEffect(() => {
    const onUnsavedConfirm = () => {
      if (jobId) {
        clearJobApplicationDraft(jobId);
        console.log('🗑️ Job application draft cleared on discard');
      }
      setHasUnsavedChanges(false);
    };
    window.addEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
    return () => window.removeEventListener('unsaved-confirm', onUnsavedConfirm as EventListener);
  }, [jobId, setHasUnsavedChanges]);

  // Store initial form data after restore to detect changes
  useEffect(() => {
    if (draftRestored && !initialFormData) {
      setInitialFormData(JSON.parse(JSON.stringify(formData)));
    }
  }, [draftRestored, initialFormData, formData]);

  useEffect(() => {
    if (jobId) {
      fetchJobAndQuestions();
    }
  }, [jobId]);

  const fetchJobAndQuestions = async () => {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
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

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch custom questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('job_questions')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

    } catch (error) {
      console.error('Error fetching job:', error);
      toast({
        title: "Fel vid hämtning",
        description: "Kunde inte hämta jobbinformation",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomAnswerChange = (questionId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      customAnswers: {
        ...prev.customAnswers,
        [questionId]: value
      }
    }));
  };

  const handleOccupationChange = (occupation: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      currentOccupation: checked 
        ? [...prev.currentOccupation, occupation]
        : prev.currentOccupation.filter(occ => occ !== occupation)
    }));
  };

  const handleSubmit = async () => {
    if (!user || !job) return;

    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast({
        title: "Obligatoriska fält saknas",
        description: "Vänligen fyll i alla obligatoriska fält",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    // Build the application payload
    // Try to get profile snapshot if online, otherwise use null
    let profileImageSnapshot: string | null = null;
    let videoSnapshot: string | null = null;

    if (getIsOnline()) {
      try {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('profile_image_url, video_url')
          .eq('user_id', user.id)
          .single();
        profileImageSnapshot = currentProfile?.profile_image_url || null;
        videoSnapshot = currentProfile?.video_url || null;
      } catch {
        // Continue without snapshot — not critical
      }
    }

    const applicationPayload = {
      job_id: job.id,
      applicant_id: user.id,
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      age: formData.age ? parseInt(formData.age) : null,
      location: formData.location,
      bio: formData.personalLetter,
      cv_url: formData.cvUrl,
      profile_image_snapshot_url: profileImageSnapshot,
      video_snapshot_url: videoSnapshot,
      custom_answers: {
        driversLicense: formData.driversLicense,
        hasOwnCar: formData.hasOwnCar,
        previousRecyclingExperience: formData.previousRecyclingExperience,
        mainOccupation: formData.mainOccupation,
        whenCanStart: formData.whenCanStart,
        currentOccupation: formData.currentOccupation,
        isStudying: formData.isStudying,
        additionalDocuments: formData.additionalDocuments,
        ...formData.customAnswers
      }
    };

    const emailPayload = {
      applicant_email: formData.email,
      applicant_first_name: formData.firstName,
      job_title: job.title,
      company_name: companyName,
    };

    // 🌐 OFFLINE PATH: Queue for later sync
    if (!getIsOnline()) {
      enqueueApplication({
        jobId: job.id,
        jobTitle: job.title,
        companyName,
        applicantId: user.id,
        payload: applicationPayload,
        emailPayload,
      });

      // Clear draft — data is safe in the queue
      if (jobId) {
        clearJobApplicationDraft(jobId);
      }
      setHasUnsavedChanges(false);

      toast({
        title: "Ansökan köad ✓",
        description: "Skickas automatiskt när du är online igen"
      });

      setSubmitting(false);
      navigate('/dashboard');
      return;
    }

    // 🟢 ONLINE PATH: Submit directly
    try {
      const { error } = await supabase
        .from('job_applications')
        .insert(applicationPayload);

      if (error) throw error;

      // Send confirmation email in background
      console.log('📧 Sending application confirmation email:', { to: emailPayload.applicant_email, job: emailPayload.job_title });
      supabase.functions.invoke('send-application-confirmation', { body: emailPayload })
        .then(({ data, error }) => {
          if (error) console.error('❌ Confirmation email failed:', error);
          else console.log('✅ Confirmation email sent:', data);
        })
        .catch((e) => console.error('❌ Confirmation email network error:', e));

      // Clear draft on successful submission
      if (jobId) {
        clearJobApplicationDraft(jobId);
        console.log('💾 Job application draft cleared after submission');
      }

      // Clear localStorage cache so My Applications page shows fresh data
      clearMyApplicationsLocalCache();

      // Invalidate queries so My Applications and search badges update
      queryClient.invalidateQueries({ queryKey: ['my-applications', user.id] });
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
      queryClient.invalidateQueries({ queryKey: ['applied-job-ids', user.id] });

      toast({
        title: "Ansökan skickad!",
        description: "Din ansökan har skickats till arbetsgivaren"
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting application:', error);

      // 🔄 FALLBACK: If online submit fails (e.g. network dropped mid-request),
      // queue it for automatic retry
      enqueueApplication({
        jobId: job.id,
        jobTitle: job.title,
        companyName,
        applicantId: user.id,
        payload: applicationPayload,
        emailPayload,
      });

      toast({
        title: "Ansökan köad",
        description: "Nätverksfel – skickas automatiskt när anslutningen är stabil"
      });

      if (jobId) {
        clearJobApplicationDraft(jobId);
      }
      setHasUnsavedChanges(false);
      navigate('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCustomQuestion = (question: JobQuestion) => {
    const value = formData.customAnswers[question.id] || '';

    switch (question.question_type) {
      case 'yes_no':
        return (
          <RadioGroup
            value={value}
            onValueChange={(val) => handleCustomAnswerChange(question.id, val)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`${question.id}-yes`} />
              <Label htmlFor={`${question.id}-yes`}>Ja</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`${question.id}-no`} />
              <Label htmlFor={`${question.id}-no`}>Nej</Label>
            </div>
          </RadioGroup>
        );

      case 'text':
        return (
          <Textarea
            placeholder={question.placeholder_text || "Skriv ditt svar här..."}
            value={value}
            onChange={(e) => handleCustomAnswerChange(question.id, e.target.value)}
            className="min-h-[80px]"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={question.placeholder_text}
            value={value}
            onChange={(e) => handleCustomAnswerChange(question.id, e.target.value)}
            min={question.min_value}
            max={question.max_value}
          />
        );

      case 'multiple_choice':
        let options = question.options;
        if (typeof options === 'string') {
          try {
            options = JSON.parse(options);
          } catch (e) {
            console.error('Failed to parse options:', e);
            options = [];
          }
        }
        
        const selectedOptions = Array.isArray(value) ? value : (value ? [value] : []);
        
        return (
          <div className="grid grid-cols-2 gap-2">
            {Array.isArray(options) && options.map((option: string, index: number) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    let newSelected;
                    if (isSelected) {
                      newSelected = selectedOptions.filter(item => item !== option);
                    } else {
                      newSelected = [...selectedOptions, option];
                    }
                    handleCustomAnswerChange(question.id, newSelected);
                  }}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white/5 hover:bg-white/10 border-white/20 text-white'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        );

      default:
        return (
          <Input
            placeholder={question.placeholder_text}
            value={value}
            onChange={(e) => handleCustomAnswerChange(question.id, e.target.value)}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-parium flex items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 bg-white/10" />
              <Skeleton className="h-4 w-32 bg-white/10" />
            </div>
          </div>
          {/* Form sections skeleton */}
          <div className="space-y-4 p-6 rounded-lg bg-white/5 border border-white/10">
            <Skeleton className="h-5 w-32 bg-white/10" />
            <Skeleton className="h-10 w-full bg-white/10 rounded-md" />
            <Skeleton className="h-10 w-full bg-white/10 rounded-md" />
          </div>
          <div className="space-y-4 p-6 rounded-lg bg-white/5 border border-white/10">
            <Skeleton className="h-5 w-40 bg-white/10" />
            <Skeleton className="h-24 w-full bg-white/10 rounded-md" />
          </div>
          <div className="space-y-4 p-6 rounded-lg bg-white/5 border border-white/10">
            <Skeleton className="h-5 w-28 bg-white/10" />
            <Skeleton className="h-20 w-full bg-white/10 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl">Jobbet kunde inte hittas</h2>
        </div>
      </div>
    );
  }

  const companyName = job.profiles?.company_name || 
    `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
    'Företag';

  const occupationOptions = [
    'Heltidsanställd',
    'Egenföretagare', 
    'Elitsatsar inom idrott',
    'Timanställd',
    'Deltidsanställd om minst 50%'
  ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-sm text-white p-4 sticky top-0 z-10 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">{companyName}</h1>
              <p className="text-sm text-white/70">{job.location}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-24">
        {/* Job Description */}
        <div className="text-center text-white mb-8">
          <p className="text-blue-100 text-sm leading-relaxed px-4 whitespace-pre-wrap">
            {job.description}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Age */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-3">
              Ålder: <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              placeholder="18"
              value={formData.age}
              onChange={(e) => handleInputChange('age', e.target.value)}
              className="text-2xl text-center py-6"
            />
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-3">
              Jag bor i: <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Skriv ett svar..."
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className="py-3"
            />
          </div>

          {/* Driver's License */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-4">
              Har du B-körkort?
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {['Nej', 'Ja - manuell', 'Ja - Automat'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleInputChange('driversLicense', option)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    formData.driversLicense === option
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Own Car */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-4">
              Har du tillgång till egen bil? <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {['Ja', 'Nej'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleInputChange('hasOwnCar', option)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    formData.hasOwnCar === option
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Previous Experience */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-4">
              Har du tidigare arbetat med återvinning?
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {['Ja', 'Nej'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleInputChange('previousRecyclingExperience', option)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    formData.previousRecyclingExperience === option
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Main Occupation */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-4">
              Har du en annan huvudsaklig sysselsättning på minst 50%?
            </Label>
            <p className="text-sm text-gray-600 mb-4">
              Har du en annan huvudsaklig sysselsättning på minst 50%?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {['Ja', 'Nej'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleInputChange('mainOccupation', option)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    formData.mainOccupation === option
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* When Can Start */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-3">
              När kan du påbörja en ny tjänst? <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Skriv ett svar..."
              value={formData.whenCanStart}
              onChange={(e) => handleInputChange('whenCanStart', e.target.value)}
              className="py-3"
            />
          </div>

          {/* Current Occupation */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-4">
              Om du inte studerar, vad är din sysselsättning idag?
            </Label>
            <p className="text-sm text-gray-600 mb-4">
              Om du inte studerar, vad är din sysselsättning idag?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {occupationOptions.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={option}
                    checked={formData.currentOccupation.includes(option)}
                    onCheckedChange={(checked) => handleOccupationChange(option, !!checked)}
                  />
                  <Label htmlFor={option} className="text-sm">{option}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Is Studying */}
          <div className="bg-white rounded-lg p-6">
            <Label className="text-gray-900 font-medium block mb-4">
              Studerar du idag? <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {['Ja', 'Nej'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleInputChange('isStudying', option)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    formData.isStudying === option
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Questions */}
          {questions.map((question) => (
            <div key={question.id} className="bg-white rounded-lg p-6">
              <Label className="text-gray-900 font-medium block mb-4">
                {question.question_text}
                {question.is_required && <span className="text-red-500">*</span>}
              </Label>
              {renderCustomQuestion(question)}
            </div>
          ))}

          {/* Personal Information Section */}
          <div className="bg-white rounded-lg p-1">
            <div className="bg-gray-100 text-center py-4 rounded-t-lg">
              <h3 className="font-bold text-gray-900">Personuppgifter</h3>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900 font-medium block mb-2">
                    Förnamn <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Anna"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-gray-900 font-medium block mb-2">
                    Efternamn <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Svensson"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                  />
                </div>
              </div>

              {/* Contact Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900 font-medium block mb-2">
                    E-post <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="anna@exempel.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-gray-900 font-medium block mb-2">
                    Telefon <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder="+46 70 123 45 67"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
              </div>

              {/* CV Upload */}
              <div>
                <Label className="text-gray-900 font-medium block mb-2">
                  Ladda upp CV <span className="text-red-500">*</span>
                </Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">
                    Dra en fil hit eller <span className="text-blue-600 underline">ladda upp den</span>
                  </p>
                  <FileUpload
                    questionType="document"
                    acceptedFileTypes={['application/pdf', '.doc', '.docx']}
                    maxFileSize={10 * 1024 * 1024}
                    onFileUploaded={(url, fileName) => {
                      handleInputChange('cvUrl', url);
                      toast({
                        title: "CV uppladdad",
                        description: `${fileName} har laddats upp`
                      });
                    }}
                    onFileRemoved={() => handleInputChange('cvUrl', '')}
                  />
                </div>
              </div>

              {/* Additional Documents */}
              <div>
                <Label className="text-gray-900 font-medium block mb-2">
                  Övriga dokument
                </Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">
                    Dra en fil hit eller <span className="text-blue-600 underline">ladda upp den</span>
                  </p>
                  <FileUpload
                    questionType="document"
                    acceptedFileTypes={['application/pdf', '.doc', '.docx', 'image/*']}
                    maxFileSize={10 * 1024 * 1024}
                    onFileUploaded={(url, fileName) => {
                      handleInputChange('additionalDocuments', url);
                      toast({
                        title: "Dokument uppladdat",
                        description: `${fileName} har laddats upp`
                      });
                    }}
                    onFileRemoved={() => handleInputChange('additionalDocuments', '')}
                  />
                </div>
              </div>

              {/* Personal Letter */}
              <div>
                <Label className="text-gray-900 font-medium block mb-2">
                  Personligt brev <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  placeholder="Skriv ett brev..."
                  value={formData.personalLetter}
                  onChange={(e) => handleInputChange('personalLetter', e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 text-lg font-semibold"
        >
          <Send className="h-5 w-5 mr-2" />
          {submitting ? 'Skickar ansökan...' : 'Skicka ansökan'}
        </Button>
        
        <p className="text-sm text-gray-500 text-center mt-2">
          När jag skickar in ansökan godkänner jag <span className="text-blue-600">Integritetspolicy</span> och att Simplex
          Bemanning AB får lagra mina personuppgifter för att kunna hantera min ansökan.
        </p>
      </div>
    </div>
  );
};

export default JobApplication;
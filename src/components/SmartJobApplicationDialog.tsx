import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Send, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  FileText, 
  CheckCircle,
  Edit3,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

interface JobQuestion {
  id: string;
  question_text: string;
  question_type: 'yes_no' | 'text' | 'multiple_choice';
  options?: string[];
  is_required: boolean;
  order_index: number;
}

interface JobPosting {
  id: string;
  title: string;
  profiles: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
}

interface UserProfile {
  first_name?: string;
  last_name?: string;
  phone?: string;
  birth_date?: string;
  location?: string;
  postal_code?: string;
  cv_url?: string;
  bio?: string;
  availability?: string;
  employment_status?: string;
}

interface SmartJobApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobPosting;
  questions: JobQuestion[];
  onSubmit: (applicationData: any) => void;
}

const SmartJobApplicationDialog = ({ 
  open, 
  onOpenChange, 
  job, 
  questions, 
  onSubmit 
}: SmartJobApplicationDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0); // 0: Smart questions, 1: Confirmation
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState<any>(null);
  
  // Application data
  const [applicationData, setApplicationData] = useState({
    // Personal info (auto-filled from profile)
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    age: null as number | null,
    location: '',
    bio: '',
    cv_url: '',
    employment_status: '',
    availability: '',
    
    // Job-specific answers
    custom_answers: {} as Record<string, any>,
    
    // Additional fields that might be needed
    can_start_date: '',
    has_drivers_license: '',
    has_car_access: '',
    work_experience_relevant: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Load user profile and consent data
  useEffect(() => {
    if (user && open) {
      loadUserData();
    }
  }, [user, open]);

  const loadUserData = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Load consent
      const { data: consentData } = await supabase
        .from('user_data_consents')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setProfile(profileData);
      setConsent(consentData);

      // Auto-fill application data from profile
      if (profileData) {
        const age = profileData.birth_date 
          ? new Date().getFullYear() - new Date(profileData.birth_date).getFullYear()
          : null;

        setApplicationData(prev => ({
          ...prev,
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          email: user.email || '',
          phone: profileData.phone || '',
          age,
          location: profileData.location || '',
          bio: profileData.bio || '',
          cv_url: profileData.cv_url || '',
          employment_status: profileData.employment_status || '',
          availability: profileData.availability || ''
        }));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle custom question answers
  const handleQuestionAnswer = (questionId: string, value: any) => {
    setApplicationData(prev => ({
      ...prev,
      custom_answers: {
        ...prev.custom_answers,
        [questionId]: value
      }
    }));
  };

  // Handle additional field changes
  const handleFieldChange = (field: string, value: any) => {
    setApplicationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Check if we need to ask specific questions based on missing profile data
  const needsPersonalInfo = () => {
    return !profile?.first_name || !profile?.last_name || !profile?.phone;
  };

  const needsWorkInfo = () => {
    return !profile?.employment_status || !profile?.availability;
  };

  // Render job-specific questions that we actually need to ask
  const renderJobSpecificQuestions = () => {
    // Common job-specific questions that aren't in profile
    const jobSpecificFields = [];

    // Always ask about start date
    jobSpecificFields.push(
      <div key="start-date" className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          När kan du börja arbeta?
          <span className="text-red-500">*</span>
        </Label>
        <Input
          type="date"
          value={applicationData.can_start_date}
          onChange={(e) => handleFieldChange('can_start_date', e.target.value)}
          className="w-full"
        />
      </div>
    );

    // Ask about driver's license if relevant to job
    if (job.title.toLowerCase().includes('chaufför') || 
        job.title.toLowerCase().includes('köra') ||
        job.title.toLowerCase().includes('transport') ||
        job.title.toLowerCase().includes('leverans')) {
      jobSpecificFields.push(
        <div key="drivers-license" className="space-y-3">
          <Label className="text-sm font-medium">
            Har du körkort?
            <span className="text-red-500">*</span>
          </Label>
          <RadioGroup
            value={applicationData.has_drivers_license}
            onValueChange={(value) => handleFieldChange('has_drivers_license', value)}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="license-yes" />
              <Label htmlFor="license-yes">Ja</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="license-no" />
              <Label htmlFor="license-no">Nej</Label>
            </div>
          </RadioGroup>
        </div>
      );

      jobSpecificFields.push(
        <div key="car-access" className="space-y-3">
          <Label className="text-sm font-medium">
            Har du tillgång till egen bil?
          </Label>
          <RadioGroup
            value={applicationData.has_car_access}
            onValueChange={(value) => handleFieldChange('has_car_access', value)}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="car-yes" />
              <Label htmlFor="car-yes">Ja</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="car-no" />
              <Label htmlFor="car-no">Nej</Label>
            </div>
          </RadioGroup>
        </div>
      );
    }

    // Ask about relevant work experience
    jobSpecificFields.push(
      <div key="experience" className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Har du tidigare erfarenhet inom detta område?
        </Label>
        <Textarea
          placeholder="Beskriv din relevanta arbetslivserfarenhet..."
          value={applicationData.work_experience_relevant}
          onChange={(e) => handleFieldChange('work_experience_relevant', e.target.value)}
          className="min-h-[80px]"
        />
      </div>
    );

    return jobSpecificFields;
  };

  // Render employer's custom questions
  const renderCustomQuestions = () => {
    if (questions.length === 0) return null;

    return questions
      .sort((a, b) => a.order_index - b.order_index)
      .map((question) => (
        <div key={question.id} className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {question.question_text}
            {question.is_required && <span className="text-red-500">*</span>}
          </Label>

          {question.question_type === 'yes_no' && (
            <RadioGroup
              value={applicationData.custom_answers[question.id] || ''}
              onValueChange={(value) => handleQuestionAnswer(question.id, value)}
              className="flex gap-6"
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
          )}

          {question.question_type === 'text' && (
            <Textarea
              placeholder="Skriv ditt svar här..."
              value={applicationData.custom_answers[question.id] || ''}
              onChange={(e) => handleQuestionAnswer(question.id, e.target.value)}
              className="min-h-[80px]"
            />
          )}

          {question.question_type === 'multiple_choice' && question.options && (
            <div className="flex flex-wrap gap-2">
              {question.options.map((option, index) => {
                const isSelected = Array.isArray(applicationData.custom_answers[question.id])
                  ? applicationData.custom_answers[question.id].includes(option)
                  : applicationData.custom_answers[question.id] === option;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      const current = applicationData.custom_answers[question.id] || [];
                      const newValue = Array.isArray(current)
                        ? isSelected
                          ? current.filter(item => item !== option)
                          : [...current, option]
                        : [option];
                      handleQuestionAnswer(question.id, newValue);
                    }}
                    className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border hover:border-muted-foreground'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ));
  };

  // Render confirmation step
  const renderConfirmation = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Bekräfta din ansökan</h3>
        <p className="text-sm text-muted-foreground">
          Kontrollera att all information är korrekt innan du skickar
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Personuppgifter
            </h4>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Namn:</span>
                <span>{applicationData.first_name} {applicationData.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>{applicationData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telefon:</span>
                <span>{applicationData.phone || 'Ej angivet'}</span>
              </div>
              {applicationData.age && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ålder:</span>
                  <span>{applicationData.age} år</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bostadsort:</span>
                <span>{applicationData.location || 'Ej angivet'}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Arbetslivsinformation
            </h4>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anställningsstatus:</span>
                <span>{applicationData.employment_status || 'Ej angivet'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tillgänglighet:</span>
                <span>{applicationData.availability || 'Ej angivet'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kan börja:</span>
                <span>{applicationData.can_start_date || 'Ej angivet'}</span>
              </div>
            </div>
          </div>

          {(applicationData.has_drivers_license || applicationData.has_car_access) && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3">Transport</h4>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {applicationData.has_drivers_license && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Körkort:</span>
                      <span>{applicationData.has_drivers_license === 'yes' ? 'Ja' : 'Nej'}</span>
                    </div>
                  )}
                  {applicationData.has_car_access && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Egen bil:</span>
                      <span>{applicationData.has_car_access === 'yes' ? 'Ja' : 'Nej'}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {Object.keys(applicationData.custom_answers).length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3">Arbetsgivarens frågor</h4>
                <div className="space-y-2 text-sm">
                  {questions.map(question => {
                    const answer = applicationData.custom_answers[question.id];
                    if (!answer) return null;
                    
                    return (
                      <div key={question.id}>
                        <span className="text-muted-foreground text-xs">{question.question_text}</span>
                        <p className="text-sm">
                          {Array.isArray(answer) ? answer.join(', ') : answer}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center">
        Genom att skicka denna ansökan godkänner du att dina personuppgifter delas med arbetsgivaren enligt våra användarvillkor.
      </div>
    </div>
  );

  const handleSubmit = async () => {
    if (currentStep === 0) {
      // Validate required fields before moving to confirmation
      const requiredQuestions = questions.filter(q => q.is_required);
      const missingAnswers = requiredQuestions.filter(q => {
        const answer = applicationData.custom_answers[q.id];
        return !answer || answer === '' || (Array.isArray(answer) && answer.length === 0);
      });

      // Validate required job-specific fields
      if (!applicationData.can_start_date) {
        toast({
          title: "Startdatum saknas",
          description: "Vänligen ange när du kan börja arbeta",
          variant: "destructive"
        });
        return;
      }

      if (missingAnswers.length > 0) {
        toast({
          title: "Obligatoriska frågor saknas",
          description: "Vänligen besvara alla obligatoriska frågor",
          variant: "destructive"
        });
        return;
      }

      // Move to confirmation step
      setCurrentStep(1);
    } else {
      // Actually submit the application
      setSubmitting(true);
      try {
        await onSubmit(applicationData);
        onOpenChange(false);
        setCurrentStep(0);
        toast({
          title: "Ansökan skickad!",
          description: "Din ansökan har skickats till arbetsgivaren",
        });
      } catch (error) {
        toast({
          title: "Ett fel uppstod",
          description: "Kunde inte skicka ansökan",
          variant: "destructive"
        });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const companyName = job.profiles?.company_name || 
    `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
    'Företag';

  if (profileLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Förbereder ansökan...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {currentStep === 0 ? 'Ansök till' : 'Bekräfta ansökan till'} {job.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {companyName}
          </p>
        </DialogHeader>

        <div className="py-4">
          {currentStep === 0 ? (
            <div className="space-y-6">
              {/* Smart info notice */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Smart ansökan aktiverad</p>
                      <p className="text-xs text-muted-foreground">
                        Vi har automatiskt fyllt i information från din profil. 
                        Du behöver bara besvara jobbspecifika frågor.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Job-specific questions */}
              <div className="space-y-4">
                <h3 className="font-medium text-base">Jobbspecifika frågor</h3>
                {renderJobSpecificQuestions()}
              </div>

              {/* Custom questions from employer */}
              {questions.length > 0 && (
                <div className="space-y-4">
                  <Separator />
                  <h3 className="font-medium text-base">Frågor från arbetsgivaren</h3>
                  {renderCustomQuestions()}
                </div>
              )}
            </div>
          ) : (
            renderConfirmation()
          )}
        </div>

        <div className="flex gap-2 pt-4">
          {currentStep === 1 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(0)}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Button>
          )}
          
          {currentStep === 0 && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Avbryt
            </Button>
          )}
          
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1"
          >
            {currentStep === 0 ? (
              <>
                Granska ansökan
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Skickar...' : 'Skicka ansökan'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmartJobApplicationDialog;
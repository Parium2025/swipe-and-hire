import { useState, useEffect } from 'react';
import FileUpload from './FileUpload';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, ChevronLeft, User, Mail, Phone, MapPin, Calendar, FileText, Video, CheckSquare, List, Heart } from 'lucide-react';

interface JobQuestion {
  id: string;
  question_text: string;
  question_type: 'yes_no' | 'text' | 'video' | 'multiple_choice';
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

interface JobApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobPosting;
  questions: JobQuestion[];
  onSubmit: (answers: Record<string, any>) => void;
}

const JobApplicationDialog = ({ open, onOpenChange, job, questions, onSubmit }: JobApplicationDialogProps) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Standard questions that are auto-filled from profile
  const standardQuestions = [
    { id: 'first_name', label: 'Förnamn', type: 'text', icon: <User className="h-5 w-5" />, required: true },
    { id: 'last_name', label: 'Efternamn', type: 'text', icon: <User className="h-5 w-5" />, required: true },
    { id: 'age', label: 'Ålder', type: 'number', icon: <Calendar className="h-5 w-5" />, required: true },
    { id: 'email', label: 'E-post', type: 'email', icon: <Mail className="h-5 w-5" />, required: true },
    { id: 'phone', label: 'Telefonnummer', type: 'tel', icon: <Phone className="h-5 w-5" />, required: true },
    { id: 'location', label: 'Ort', type: 'text', icon: <MapPin className="h-5 w-5" />, required: true },
  ];

  // Combine standard questions with custom questions
  const allQuestions = [
    ...standardQuestions,
    ...questions.map(q => ({ ...q, id: `custom_${q.id}` }))
  ];

  useEffect(() => {
    if (user && open) {
      fetchProfile();
    }
  }, [user, open]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (data) {
        setProfile(data);
        // Auto-fill standard questions from profile
        setAnswers(prev => ({
          ...prev,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          age: data.birth_date ? new Date().getFullYear() - new Date(data.birth_date).getFullYear() : '',
          email: user?.email || '',
          phone: data.phone || '',
          location: data.home_location || data.location || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async () => {
    // Validate required questions
    const requiredQuestions = questions.filter(q => q.is_required);
    const missingAnswers = requiredQuestions.filter(q => {
      const answer = answers[q.id];
      if (q.question_type === 'multiple_choice') {
        return !Array.isArray(answer) || answer.length === 0;
      }
      return !answer || answer === '';
    });
    
    if (missingAnswers.length > 0) {
      toast({
        title: "Obligatoriska frågor saknas",
        description: "Vänligen besvara alla obligatoriska frågor",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(answers);
      onOpenChange(false);
      setAnswers({});
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skicka ansökan",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionRow = (question: any, index: number) => {
    const isStandardQuestion = standardQuestions.some(sq => sq.id === question.id);
    const isRequired = 'required' in question ? question.required : question.is_required;
    
    return (
      <div key={question.id} className="border-b border-white/10 py-4 space-y-3">
        {/* Question header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white">
                {question.label || question.question_text}
              </span>
              {isRequired && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Obligatorisk
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-white/70 border-white/20">
                {isStandardQuestion ? 'Grundinfo' : getQuestionTypeLabel(question.question_type)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Answer input */}
        <div className="space-y-2">
          {/* Standard questions */}
          {isStandardQuestion && (
            <Input
              type={question.type}
              placeholder={`Ange ${question.label.toLowerCase()}...`}
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              disabled={question.id === 'email'}
            />
          )}

          {/* Custom questions - yes/no */}
          {!isStandardQuestion && question.question_type === 'yes_no' && (
            <div className="flex gap-2">
              <Button
                variant={answers[question.id] === 'yes' ? "default" : "outline"}
                onClick={() => handleAnswerChange(question.id, 'yes')}
                className="flex-1 bg-white/5 border-white/20 hover:bg-white/10"
                size="sm"
              >
                Ja
              </Button>
              <Button
                variant={answers[question.id] === 'no' ? "default" : "outline"}
                onClick={() => handleAnswerChange(question.id, 'no')}
                className="flex-1 bg-white/5 border-white/20 hover:bg-white/10"
                size="sm"
              >
                Nej
              </Button>
            </div>
          )}

          {/* Custom questions - text */}
          {!isStandardQuestion && question.question_type === 'text' && (
            <Textarea
              placeholder="Skriv ditt svar..."
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="min-h-[80px] bg-white/5 border-white/20 text-white placeholder:text-white/40"
            />
          )}

          {/* Custom questions - multiple choice */}
          {!isStandardQuestion && question.question_type === 'multiple_choice' && (
            <div className="flex flex-wrap gap-2">
              {(() => {
                let options = question.options;
                if (typeof options === 'string') {
                  try {
                    options = JSON.parse(options);
                  } catch (e) {
                    options = [];
                  }
                }
                
                const selectedOptions = Array.isArray(answers[question.id]) 
                  ? answers[question.id] 
                  : answers[question.id] 
                    ? [answers[question.id]] 
                    : [];

                return Array.isArray(options) && options.map((option, optIndex) => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <Button
                      key={optIndex}
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        const currentSelected = Array.isArray(answers[question.id]) 
                          ? answers[question.id] 
                          : answers[question.id] 
                            ? [answers[question.id]] 
                            : [];
                        
                        let newSelected;
                        if (isSelected) {
                          newSelected = currentSelected.filter(item => item !== option);
                        } else {
                          newSelected = [...currentSelected, option];
                        }
                        
                        handleAnswerChange(question.id, newSelected);
                      }}
                      className="bg-white/5 border-white/20 hover:bg-white/10"
                      size="sm"
                    >
                      {option}
                    </Button>
                  );
                });
              })()}
            </div>
          )}

          {/* Custom questions - video */}
          {!isStandardQuestion && question.question_type === 'video' && (
            <div className="space-y-2">
              <Input
                type="url"
                placeholder="Videolänk (YouTube, Vimeo, etc.)"
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      yes_no: 'Ja/Nej',
      text: 'Text',
      video: 'Video',
      multiple_choice: 'Flerval'
    };
    return labels[type] || type;
  };

  const companyName = job.profiles?.company_name || 
    `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
    'Företag';

  const canSubmit = () => {
    // Check all required standard questions
    const requiredStandardQuestions = standardQuestions.filter(sq => sq.required);
    for (const sq of requiredStandardQuestions) {
      const answer = answers[sq.id];
      if (!answer || answer === '') return false;
    }
    
    // Check all required custom questions
    const requiredCustomQuestions = questions.filter(q => q.is_required);
    for (const q of requiredCustomQuestions) {
      const answer = answers[`custom_${q.id}`];
      if (q.question_type === 'multiple_choice') {
        if (!Array.isArray(answer) || answer.length === 0) return false;
      } else {
        if (!answer || answer === '') return false;
      }
    }
    
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 rounded-[24px] overflow-hidden bg-parium-gradient text-white border-none shadow-none">
        <div className="relative flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-2 md:p-4 border-b border-white/20 bg-background/10 rounded-t-[24px] flex-shrink-0">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-1.5 md:gap-2">
                <Heart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="font-semibold text-xs md:text-sm">Ansökan</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onOpenChange(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 h-6 w-6 md:h-8 md:w-8 p-0"
              >
                ✕
              </Button>
            </div>
            <div className="mt-1.5 md:mt-2">
              <h3 className="font-semibold text-sm md:text-lg leading-tight">{job.title}</h3>
              <p className="text-xs md:text-sm text-white/70">{companyName}</p>
            </div>
          </div>

          {/* All questions in scrollable list */}
          <div className="flex-1 overflow-y-auto px-4">
            <div className="py-2">
              {allQuestions.map((question, index) => renderQuestionRow(question, index))}
            </div>
          </div>

          {/* Submit button */}
          <div className="p-4 border-t border-white/20 bg-background/10 flex-shrink-0">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit()}
              className="w-full"
              size="lg"
            >
              <Heart className="h-4 w-4 mr-2" />
              {submitting ? 'Skickar...' : 'Skicka ansökan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobApplicationDialog;
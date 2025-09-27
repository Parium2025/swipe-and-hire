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
import { useToast } from '@/hooks/use-toast';
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
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
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

  const renderQuestionCard = (question: any, index: number) => {
    const isStandardQuestion = standardQuestions.some(sq => sq.id === question.id);
    const isCompleted = answers[question.id] && answers[question.id] !== '';
    
    return (
      <Card key={question.id} className="w-full min-h-[400px] flex flex-col">
        <CardContent className="p-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Badge variant={isStandardQuestion ? "secondary" : "default"} className="text-xs">
              {isStandardQuestion ? "Grundinfo" : "Anpassad fråga"}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {index + 1} av {allQuestions.length}
            </div>
          </div>

          {/* Question */}
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                {question.icon || <User className="h-6 w-6 text-primary" />}
              </div>
              <h3 className="text-lg font-semibold">
                {question.label || question.question_text}
              </h3>
              {question.required && (
                <Badge variant="destructive" className="text-xs">Obligatorisk</Badge>
              )}
            </div>

            {/* Input */}
            <div className="space-y-3 px-4">
              {/* Standard questions */}
              {isStandardQuestion && (
                <Input
                  type={question.type}
                  placeholder={`Ange ${question.label.toLowerCase()}...`}
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="text-center text-lg"
                  disabled={question.id === 'email'} // Email is read-only from auth
                />
              )}

              {/* Custom questions */}
              {!isStandardQuestion && question.question_type === 'yes_no' && (
                <div className="flex gap-3 justify-center">
                  <Button
                    variant={answers[question.id] === 'yes' ? "default" : "outline"}
                    onClick={() => handleAnswerChange(question.id, 'yes')}
                    className="flex-1"
                  >
                    Ja
                  </Button>
                  <Button
                    variant={answers[question.id] === 'no' ? "default" : "outline"}
                    onClick={() => handleAnswerChange(question.id, 'no')}
                    className="flex-1"
                  >
                    Nej
                  </Button>
                </div>
              )}

              {!isStandardQuestion && question.question_type === 'text' && (
                <Textarea
                  placeholder="Skriv ditt svar här..."
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="min-h-[100px] text-center"
                />
              )}

              {!isStandardQuestion && question.question_type === 'multiple_choice' && (
                <div className="grid gap-2">
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
                          className="w-full"
                        >
                          {option}
                        </Button>
                      );
                    });
                  })()}
                </div>
              )}

              {!isStandardQuestion && question.question_type === 'video' && (
                <div className="space-y-3">
                  <Input
                    type="url"
                    placeholder="Klistra in videolänk (YouTube, Vimeo, etc.)"
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="text-center"
                  />
                  <div className="text-center">
                    <FileUpload
                      questionType="video"
                      acceptedFileTypes={['video/*']}
                      maxFileSize={50 * 1024 * 1024}
                      onFileUploaded={(url, fileName) => handleAnswerChange(question.id, url)}
                      onFileRemoved={() => handleAnswerChange(question.id, '')}
                      currentFile={answers[question.id] && answers[question.id].startsWith('http') && !answers[question.id].includes('youtube') && !answers[question.id].includes('vimeo') ? { url: answers[question.id], name: 'Uppladdad video' } : undefined}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex justify-center mt-6">
            {isCompleted ? (
              <div className="w-3 h-3 rounded-full bg-primary" />
            ) : (
              <div className="w-3 h-3 rounded-full border-2 border-primary" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const companyName = job.profiles?.company_name || 
    `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
    'Företag';

  const canContinue = () => {
    const currentQuestion = allQuestions[currentCardIndex];
    if (!currentQuestion) return false;
    
    const answer = answers[currentQuestion.id];
    const isRequired = 'required' in currentQuestion ? currentQuestion.required : currentQuestion.is_required;
    
    if (isRequired) {
      return answer && answer !== '';
    }
    return true; // Optional questions can be skipped
  };

  const nextCard = () => {
    if (currentCardIndex < allQuestions.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    }
  };

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  const isLastCard = currentCardIndex === allQuestions.length - 1;
  const currentQuestion = allQuestions[currentCardIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] p-0">
        <div className="relative h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Ansökan</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground"
              >
                ✕
              </Button>
            </div>
            <div className="mt-2">
              <h3 className="font-semibold text-lg">{job.title}</h3>
              <p className="text-sm text-muted-foreground">{companyName}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 py-2 bg-muted/30">
            <div className="w-full bg-muted rounded-full h-1">
              <div 
                className="bg-primary h-1 rounded-full transition-all duration-300" 
                style={{ width: `${((currentCardIndex + 1) / allQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question card */}
          <div className="flex-1 p-4 overflow-hidden">
            {currentQuestion && renderQuestionCard(currentQuestion, currentCardIndex)}
          </div>

          {/* Navigation */}
          <div className="p-4 border-t bg-background">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={prevCard}
                disabled={currentCardIndex === 0}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>
              
              {isLastCard ? (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !canContinue()}
                  className="flex-1"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  {submitting ? 'Skickar...' : 'Skicka ansökan'}
                </Button>
              ) : (
                <Button
                  onClick={nextCard}
                  disabled={!canContinue()}
                  className="flex-1"
                >
                  Nästa
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobApplicationDialog;
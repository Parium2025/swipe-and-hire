import { useState, useEffect, useCallback } from 'react';
import FileUpload from './FileUpload';
import { Dialog } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';

import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, ChevronLeft, User, Mail, Phone, MapPin, Calendar, FileText, Video, CheckSquare, List, Heart, WifiOff, X } from 'lucide-react';
import { useOnline } from '@/hooks/useOnlineStatus';

// Draft key for localStorage
const JOB_DIALOG_DRAFT_PREFIX = 'parium_draft_job-dialog-';

const getDraftKey = (jobId: string) => `${JOB_DIALOG_DRAFT_PREFIX}${jobId}`;

// Clear draft for a specific job
export const clearJobDialogDraft = (jobId: string) => {
  try {
    localStorage.removeItem(getDraftKey(jobId));
  } catch (e) {
    console.warn('Failed to clear job dialog draft');
  }
};

interface JobQuestion {
  id: string;
  question_text: string;
  question_type: 'yes_no' | 'text' | 'video' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range';
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
  const [initialAnswers, setInitialAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOnline, showOfflineToast } = useOnline();

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

  // Restore draft when dialog opens
  useEffect(() => {
    if (open && job?.id && !draftRestored) {
      try {
        const saved = localStorage.getItem(getDraftKey(job.id));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.answers) {
            setAnswers(prev => ({ ...prev, ...parsed.answers }));
            console.log('💾 Job dialog draft restored');
          }
        }
      } catch (e) {
        console.warn('Failed to restore job dialog draft');
      }
      setDraftRestored(true);
    }
    
    // Reset draft restored flag when dialog closes
    if (!open) {
      setDraftRestored(false);
    }
  }, [open, job?.id, draftRestored]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!open || !job?.id || !draftRestored) return;
    
    // Check if there's any content to save (beyond auto-filled profile data)
    const hasCustomAnswers = Object.keys(answers).some(key => 
      key.startsWith('custom_') && answers[key]
    );
    
    if (hasCustomAnswers || Object.keys(answers).length > 6) { // More than just profile fields
      try {
        localStorage.setItem(getDraftKey(job.id), JSON.stringify({
          answers,
          savedAt: Date.now()
        }));
        console.log('💾 Job dialog draft saved');
      } catch (e) {
        console.warn('Failed to save job dialog draft');
      }
    }
  }, [answers, job?.id, open, draftRestored]);

  // Track unsaved changes
  useEffect(() => {
    if (!open || Object.keys(initialAnswers).length === 0) return;
    const hasChanges = JSON.stringify(answers) !== JSON.stringify(initialAnswers);
    setHasUnsavedChanges(hasChanges);
  }, [answers, initialAnswers, open]);

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
        const profileAnswers = {
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          age: data.birth_date ? new Date().getFullYear() - new Date(data.birth_date).getFullYear() : '',
          email: user?.email || '',
          phone: data.phone || '',
          location: data.home_location || data.location || ''
        };
        setAnswers(prev => ({ ...prev, ...profileAnswers }));
        setInitialAnswers(prev => ({ ...prev, ...profileAnswers }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Handle close with unsaved changes check
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmClose = () => {
    // Clear draft when user confirms leaving without saving
    if (job?.id) {
      clearJobDialogDraft(job.id);
    }
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);
    setAnswers({});
    setInitialAnswers({});
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowUnsavedDialog(false);
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async () => {
    if (!isOnline) {
      showOfflineToast();
      return;
    }
    
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
      
      // Clear draft on successful submission
      if (job?.id) {
        clearJobDialogDraft(job.id);
        console.log('💾 Job dialog draft cleared after submission');
      }
      
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
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-white border-white/20">
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
              className="bg-white/5 border-white/20 hover:border-white/50 text-white placeholder:text-white"
              disabled={question.id === 'email'}
            />
          )}

          {/* Custom questions - yes/no */}
          {!isStandardQuestion && question.question_type === 'yes_no' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleAnswerChange(question.id, answers[question.id] === 'yes' ? '' : 'yes')}
                className={
                  (answers[question.id] === 'yes'
                    ? 'bg-secondary/40 border-secondary text-white '
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/15 ') +
                  'border rounded-lg px-4 py-2 text-sm transition-colors font-medium flex-1'
                }
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() => handleAnswerChange(question.id, answers[question.id] === 'no' ? '' : 'no')}
                className={
                  (answers[question.id] === 'no'
                    ? 'bg-secondary/40 border-secondary text-white '
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/15 ') +
                  'border rounded-lg px-4 py-2 text-sm transition-colors font-medium flex-1'
                }
              >
                Nej
              </button>
            </div>
          )}

          {/* Custom questions - text */}
          {!isStandardQuestion && question.question_type === 'text' && (
            <Textarea
              placeholder={question.placeholder_text || 'Skriv ditt svar här...'}
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="min-h-[80px] bg-white/10 border-white/20 text-white placeholder:text-white focus:outline-none focus:border-white/40"
            />
          )}

          {/* Custom questions - multiple choice */}
          {!isStandardQuestion && question.question_type === 'multiple_choice' && (
            <div className="space-y-2">
              {(() => {
                let options = question.options;
                if (typeof options === 'string') {
                  try {
                    options = JSON.parse(options);
                  } catch (e) {
                    options = [];
                  }
                }
                
                const currentAnswer = answers[question.id];
                const selectedAnswers = typeof currentAnswer === 'string' 
                  ? currentAnswer.split('|||').filter(a => a)
                  : Array.isArray(currentAnswer) 
                    ? currentAnswer 
                    : [];

                return Array.isArray(options) && options.filter(opt => opt.trim() !== '').map((option, optIndex) => {
                  const isSelected = selectedAnswers.includes(option);
                  return (
                    <button
                      key={optIndex}
                      type="button"
                      onClick={() => {
                        const answersArray = typeof currentAnswer === 'string'
                          ? currentAnswer.split('|||').filter(a => a)
                          : Array.isArray(currentAnswer)
                            ? [...currentAnswer]
                            : [];
                        
                        if (answersArray.includes(option)) {
                          const newAnswers = answersArray.filter(a => a !== option);
                          handleAnswerChange(question.id, newAnswers.join('|||'));
                        } else {
                          handleAnswerChange(question.id, [...answersArray, option].join('|||'));
                        }
                      }}
                      className={
                        (isSelected
                          ? 'bg-secondary/40 border-secondary '
                          : 'bg-white/10 border-white/20 hover:bg-white/15 ') +
                        'w-full flex items-center gap-3 rounded-lg px-4 py-2.5 border transition-colors'
                      }
                    >
                      <div className={
                        isSelected
                          ? 'w-2 h-2 rounded-full border border-secondary bg-secondary flex-shrink-0'
                          : 'w-2 h-2 rounded-full border border-white/40 flex-shrink-0'
                      } />
                      <span className="text-sm text-white text-left flex-1">{option}</span>
                    </button>
                  );
                });
              })()}
            </div>
          )}

          {/* Custom questions - number (slider) */}
          {!isStandardQuestion && question.question_type === 'number' && (() => {
            const minVal = question.min_value ?? 0;
            const maxVal = question.max_value ?? 100;
            const currentVal = Number(answers[question.id] || minVal);
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
          })()}

          {/* Custom questions - date */}
          {!isStandardQuestion && question.question_type === 'date' && (
            <Input
              type="date"
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white h-10 text-sm focus:outline-none focus:border-white/40"
            />
          )}

          {/* Custom questions - file */}
          {!isStandardQuestion && question.question_type === 'file' && (
            <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center bg-white/5">
              <FileText className="h-6 w-6 mx-auto mb-2 text-white" />
              <p className="text-sm text-white">Välj fil</p>
            </div>
          )}

          {/* Custom questions - video */}
          {!isStandardQuestion && question.question_type === 'video' && (
            <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center bg-white/5">
              <Video className="h-6 w-6 mx-auto mb-2 text-white" />
              <p className="text-sm text-white">Spela in video</p>
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
      multiple_choice: 'Flerval',
      number: 'Siffra',
      date: 'Datum',
      file: 'Fil'
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
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}>
        <DialogContentNoFocus className="max-w-md max-h-[90vh] p-0 rounded-[24px] overflow-hidden bg-parium-gradient text-white border-none shadow-none">
          <div className="relative flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-2 md:p-4 border-b border-white/20 bg-background/10 rounded-t-[24px] flex-shrink-0">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Heart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <span className="font-semibold text-xs md:text-sm">Ansökan</span>
                </div>
                <button 
                  onClick={handleClose}
                  className="flex h-6 w-6 md:h-8 md:w-8 items-center justify-center rounded-full text-white hover:bg-white/20 transition-colors"
                >
                  <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </button>
              </div>
              <div className="mt-1.5 md:mt-2">
                <h3 className="font-semibold text-sm md:text-lg leading-tight">{job.title}</h3>
                <p className="text-xs md:text-sm text-white">{companyName}</p>
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
                disabled={submitting || !canSubmit() || !isOnline}
                variant="glassGreen"
                className={`w-full ${!isOnline ? 'opacity-50' : ''}`}
                size="lg"
              >
                {!isOnline ? (
                  <WifiOff className="h-4 w-4 mr-2" />
                ) : (
                  <Heart className="h-4 w-4 mr-2" />
                )}
                {submitting ? 'Skickar...' : !isOnline ? 'Offline' : 'Skicka ansökan'}
              </Button>
            </div>
          </div>
        </DialogContentNoFocus>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
};

export default JobApplicationDialog;
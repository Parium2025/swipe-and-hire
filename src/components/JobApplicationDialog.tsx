import { useState } from 'react';
import FileUpload from './FileUpload';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building2, Send, Video, FileText, CheckSquare, List } from 'lucide-react';

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
  const { toast } = useToast();

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

  const renderQuestion = (question: JobQuestion) => {
    console.log('Rendering question:', question);
    console.log('Question options:', question.options, 'Type:', typeof question.options, 'Is Array:', Array.isArray(question.options));
    
    const questionIcon = {
      yes_no: <CheckSquare className="h-4 w-4" />,
      text: <FileText className="h-4 w-4" />,
      video: <Video className="h-4 w-4" />,
      multiple_choice: <List className="h-4 w-4" />
    };

    return (
      <div key={question.id} className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          {questionIcon[question.question_type]}
          {question.question_text}
          {question.is_required && <span className="text-red-500">*</span>}
        </Label>

        {question.question_type === 'yes_no' && (
          <RadioGroup
            value={answers[question.id] || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
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
          <div className="space-y-3">
            <Textarea
              placeholder="Skriv ditt svar här..."
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="min-h-[80px]"
            />
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Eller ladda upp dokument (CV, personligt brev, etc.)
              </p>
              <FileUpload
                questionType="document"
                acceptedFileTypes={['application/pdf', '.doc', '.docx', 'image/*']}
                maxFileSize={10 * 1024 * 1024}
                onFileUploaded={(url, fileName) => {
                  const currentText = answers[question.id] || '';
                  const newText = currentText + (currentText ? '\n\n' : '') + `Bifogat dokument: ${fileName} (${url})`;
                  handleAnswerChange(question.id, newText);
                }}
                onFileRemoved={() => {
                  // Remove the file reference from the text
                  const currentText = answers[question.id] || '';
                  const lines = currentText.split('\n');
                  const filteredLines = lines.filter(line => !line.includes('Bifogat dokument:'));
                  handleAnswerChange(question.id, filteredLines.join('\n').trim());
                }}
              />
            </div>
          </div>
        )}

        {question.question_type === 'video' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Video className="h-4 w-4" />
              Ladda upp en video eller länka till en video
            </p>
            <Input
              type="url"
              placeholder="Eller klistra in länk till video (YouTube, Vimeo, etc.)"
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            />
            <FileUpload
              questionType="video"
              acceptedFileTypes={['video/*']}
              maxFileSize={50 * 1024 * 1024}
              onFileUploaded={(url, fileName) => handleAnswerChange(question.id, url)}
              onFileRemoved={() => handleAnswerChange(question.id, '')}
              currentFile={answers[question.id] && answers[question.id].startsWith('http') && !answers[question.id].includes('youtube') && !answers[question.id].includes('vimeo') ? { url: answers[question.id], name: 'Uppladdad video' } : undefined}
            />
          </div>
        )}

        {question.question_type === 'multiple_choice' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(() => {
                let options = question.options;
                if (typeof options === 'string') {
                  try {
                    options = JSON.parse(options);
                  } catch (e) {
                    console.error('Failed to parse options:', e);
                    options = [];
                  }
                }
                
                const selectedOptions = Array.isArray(answers[question.id]) 
                  ? answers[question.id] 
                  : answers[question.id] 
                    ? [answers[question.id]] 
                    : [];

                return Array.isArray(options) && options.map((option, index) => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <button
                      key={index}
                      type="button"
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
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border hover:border-muted-foreground'
                      }`}
                    >
                      {option}
                    </button>
                  );
                });
              })()}
            </div>
            {Array.isArray(answers[question.id]) && answers[question.id].length > 0 && (
              <p className="text-xs text-muted-foreground">
                Valda: {answers[question.id].join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const companyName = job.profiles?.company_name || 
    `${job.profiles?.first_name} ${job.profiles?.last_name}` || 
    'Företag';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Ansök till {job.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {companyName}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {questions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Inga specifika frågor från arbetsgivaren. Klicka på "Skicka ansökan" för att visa ditt intresse.
              </p>
            </div>
          ) : (
            questions
              .sort((a, b) => a.order_index - b.order_index)
              .map(renderQuestion)
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Skickar...' : 'Skicka ansökan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobApplicationDialog;
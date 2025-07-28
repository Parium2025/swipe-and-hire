import { useState } from 'react';
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
    const missingAnswers = requiredQuestions.filter(q => !answers[q.id] || answers[q.id] === '');
    
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
          <Textarea
            placeholder="Skriv ditt svar här..."
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="min-h-[80px]"
          />
        )}

        {question.question_type === 'video' && (
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="Länk till videosvar (YouTube, Vimeo, etc.)"
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ladda upp din video på YouTube, Vimeo eller annan plattform och klistra in länken här
            </p>
          </div>
        )}

        {question.question_type === 'multiple_choice' && (
          <Select
            value={answers[question.id] || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Välj ett alternativ" />
            </SelectTrigger>
            <SelectContent>
              {Array.isArray(question.options) && question.options.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
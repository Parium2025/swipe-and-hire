import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, GripVertical, HelpCircle } from 'lucide-react';

interface JobQuestion {
  id?: string;
  question_text: string;
  question_type: 'yes_no' | 'text' | 'video' | 'multiple_choice';
  options?: string[];
  is_required: boolean;
  order_index: number;
}

interface JobQuestionsManagerProps {
  jobId: string | null;
  onQuestionsChange?: () => void;
}

const JobQuestionsManager = ({ jobId, onQuestionsChange }: JobQuestionsManagerProps) => {
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (jobId) {
      fetchQuestions();
    }
  }, [jobId]);

  const fetchQuestions = async () => {
    if (!jobId) return;

    try {
      const { data, error } = await supabase
        .from('job_questions')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index');

      if (error) throw error;

      const formattedQuestions = data.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type as JobQuestion['question_type'],
        options: q.options ? JSON.parse(q.options as string) : undefined,
        is_required: q.is_required,
        order_index: q.order_index
      }));

      setQuestions(formattedQuestions);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const addQuestion = () => {
    const newQuestion: JobQuestion = {
      question_text: '',
      question_type: 'text',
      is_required: false,
      order_index: questions.length
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<JobQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    // Update order_index for remaining questions
    updated.forEach((q, i) => q.order_index = i);
    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    const options = updated[questionIndex].options || [];
    updated[questionIndex].options = [...options, ''];
    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions];
    const options = [...(updated[questionIndex].options || [])];
    options[optionIndex] = value;
    updated[questionIndex].options = options;
    setQuestions(updated);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    const options = updated[questionIndex].options || [];
    updated[questionIndex].options = options.filter((_, i) => i !== optionIndex);
    setQuestions(updated);
  };

  const saveQuestions = async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      // Delete existing questions
      await supabase
        .from('job_questions')
        .delete()
        .eq('job_id', jobId);

      // Insert new questions
      const questionsToInsert = questions
        .filter(q => q.question_text && q.question_text.trim().length > 0)
        .map(q => ({
          job_id: jobId,
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          options: q.options && q.options.length > 0 ? JSON.stringify(q.options.filter(o => o && o.trim().length > 0)) : null,
          is_required: q.is_required,
          order_index: q.order_index
        }));

      console.log('Questions to insert:', questionsToInsert);

      if (questionsToInsert.length > 0) {
        const { error } = await supabase
          .from('job_questions')
          .insert(questionsToInsert);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        
        console.log('Questions inserted successfully');
      } else {
        console.log('No questions to insert - all questions are empty');
      }

      toast({
        title: "Frågor sparade!",
        description: "Ansökningsfrågorna har uppdaterats."
      });

      onQuestionsChange?.();
      fetchQuestions();
    } catch (error) {
      toast({
        title: "Fel vid sparning",
        description: "Kunde inte spara frågorna.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getQuestionTypeLabel = (type: JobQuestion['question_type']) => {
    const labels = {
      yes_no: 'Ja/Nej',
      text: 'Text',
      video: 'Video',
      multiple_choice: 'Flervalsalternativ'
    };
    return labels[type];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Ansökningsfrågor
          </h3>
          <p className="text-sm text-muted-foreground">
            Lägg till egna frågor som jobbsökare måste svara på
          </p>
        </div>
        <Button onClick={addQuestion} size="sm" className="border border-white/20 hover:border-white/40">
          <Plus className="h-4 w-4 mr-2" />
          Lägg till fråga
        </Button>
      </div>

      {questions.map((question, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">{getQuestionTypeLabel(question.question_type)}</Badge>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <Label htmlFor={`required-${index}`} className="text-sm">
                  Obligatorisk
                </Label>
                <Switch
                  id={`required-${index}`}
                  checked={question.is_required}
                  onCheckedChange={(checked) => updateQuestion(index, { is_required: checked })}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeQuestion(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frågetyp</Label>
                <Select
                  value={question.question_type}
                  onValueChange={(value) => updateQuestion(index, { question_type: value as JobQuestion['question_type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Textfråga</SelectItem>
                    <SelectItem value="yes_no">Ja/Nej-fråga</SelectItem>
                    <SelectItem value="multiple_choice">Flervalsalternativ</SelectItem>
                    <SelectItem value="video">Videosvar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fråga</Label>
                <Input
                  value={question.question_text}
                  onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
                  placeholder="Skriv din fråga här..."
                />
              </div>
            </div>

            {question.question_type === 'multiple_choice' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Svarsalternativ</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(index)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Lägg till alternativ
                  </Button>
                </div>
                <div className="space-y-2">
                  {(question.options || []).map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                        placeholder={`Alternativ ${optionIndex + 1} (t.ex. B-kort, Krankort)`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeOption(index, optionIndex)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {questions.length > 0 && (
        <div className="flex justify-end pt-4">
          <Button onClick={saveQuestions} disabled={loading}>
            {loading ? 'Sparar...' : 'Spara frågor'}
          </Button>
        </div>
      )}

      {questions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-center py-8">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Inga ansökningsfrågor än</h3>
            <p className="text-muted-foreground mb-4">
              Lägg till egna frågor för att få mer information från jobbsökare
            </p>
            <Button onClick={addQuestion} className="border border-white/20 hover:border-white/40">
              <Plus className="h-4 w-4 mr-2" />
              Lägg till första frågan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JobQuestionsManager;
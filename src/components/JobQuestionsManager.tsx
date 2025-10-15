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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface JobQuestion {
  id?: string;
  question_text: string;
  description?: string;
  question_type: 'yes_no' | 'text' | 'video' | 'multiple_choice';
  options?: string[];
  is_required: boolean;
  order_index: number;
}

interface JobQuestionsManagerProps {
  jobId: string | null;
  onQuestionsChange?: () => void;
}

// Sortable Question Card Component
interface SortableQuestionProps {
  question: JobQuestion;
  index: number;
  updateQuestion: (index: number, updates: Partial<JobQuestion>) => void;
  removeQuestion: (index: number) => void;
  addOption: (questionIndex: number) => void;
  updateOption: (questionIndex: number, optionIndex: number, value: string) => void;
  removeOption: (questionIndex: number, optionIndex: number) => void;
  getQuestionTypeLabel: (type: JobQuestion['question_type']) => string;
}

const SortableQuestionCard = ({
  question,
  index,
  updateQuestion,
  removeQuestion,
  addOption,
  updateOption,
  removeOption,
  getQuestionTypeLabel
}: SortableQuestionProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id || `question-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-white" />
          </div>
          <Badge variant="outline" className="text-white border-white/20">{getQuestionTypeLabel(question.question_type)}</Badge>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Label htmlFor={`required-${index}`} className="text-sm text-white">
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
            <Label className="text-white">Frågetyp</Label>
            <Select
              value={question.question_type}
              onValueChange={(value) => updateQuestion(index, { question_type: value as JobQuestion['question_type'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Siffra</SelectItem>
                <SelectItem value="yes_no">Ja/Nej</SelectItem>
                <SelectItem value="multiple_choice">Flerval</SelectItem>
                <SelectItem value="video">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-white">Fråga</Label>
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
  );
};

const JobQuestionsManager = ({ jobId, onQuestionsChange }: JobQuestionsManagerProps) => {
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [selectedType, setSelectedType] = useState<JobQuestion['question_type'] | null>(null);
  const [questionDraft, setQuestionDraft] = useState<JobQuestion | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        description: q.description || '',
        question_type: q.question_type as JobQuestion['question_type'],
        options: Array.isArray(q.options)
          ? (q.options as string[])
          : (typeof q.options === 'string' && q.options.trim().startsWith('[')
            ? JSON.parse(q.options)
            : undefined),
        is_required: q.is_required,
        order_index: q.order_index
      }));

      setQuestions(formattedQuestions);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const addQuestion = () => {
    setAddingQuestion(true);
    setSelectedType(null);
    setQuestionDraft(null);
  };

  const selectQuestionType = (type: JobQuestion['question_type']) => {
    setSelectedType(type);
    setQuestionDraft({
      question_text: '',
      description: '',
      question_type: type,
      is_required: false,
      order_index: questions.length,
      options: type === 'multiple_choice' ? [''] : undefined
    });
  };

  const confirmAddQuestion = () => {
    if (questionDraft && questionDraft.question_text.trim()) {
      setQuestions([...questions, questionDraft]);
      setAddingQuestion(false);
      setSelectedType(null);
      setQuestionDraft(null);
    }
  };

  const cancelAddQuestion = () => {
    setAddingQuestion(false);
    setSelectedType(null);
    setQuestionDraft(null);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => (item.id || `question-${items.indexOf(item)}`) === active.id);
        const newIndex = items.findIndex((item) => (item.id || `question-${items.indexOf(item)}`) === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        // Update order_index for all questions after reordering
        reordered.forEach((q, i) => q.order_index = i);
        return reordered;
      });
    }
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
          description: q.description?.trim() || null,
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
      text: 'Siffra',
      video: 'Text',
      multiple_choice: 'Flerval'
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

      {/* Ny fråga dialog */}
      {addingQuestion && questionDraft && (
        <Card className="border-2 border-primary/50 bg-card">
          <CardHeader>
            <CardTitle className="text-xl">Ny fråga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Typ */}
            <div className="space-y-2">
              <Label htmlFor="question-type">Typ</Label>
              <Select
                value={questionDraft.question_type}
                onValueChange={(value) => setQuestionDraft({ 
                  ...questionDraft, 
                  question_type: value as JobQuestion['question_type'],
                  options: value === 'multiple_choice' ? (questionDraft.options || ['']) : undefined
                })}
              >
                <SelectTrigger id="question-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Textfråga</SelectItem>
                  <SelectItem value="yes_no">Ja/Nej</SelectItem>
                  <SelectItem value="multiple_choice">Flervalsalternativ</SelectItem>
                  <SelectItem value="video">Videosvar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rubrik */}
            <div className="space-y-2">
              <Label htmlFor="question-title">Rubrik</Label>
              <Input
                id="question-title"
                value={questionDraft.question_text}
                onChange={(e) => setQuestionDraft({ ...questionDraft, question_text: e.target.value })}
                placeholder="Gillar du äpplen?"
              />
            </div>

            {/* Beskrivning */}
            <div className="space-y-2">
              <Label htmlFor="question-description">Beskrivning</Label>
              <Textarea
                id="question-description"
                value={questionDraft.description || ''}
                onChange={(e) => setQuestionDraft({ ...questionDraft, description: e.target.value })}
                placeholder="Beskrivning av frågan..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Används när en fråga kan behöva förtydligas.
              </p>
            </div>

            {/* Obligatorisk */}
            <div className="flex items-center gap-2">
              <Switch
                id="draft-required"
                checked={questionDraft.is_required}
                onCheckedChange={(checked) => setQuestionDraft({ ...questionDraft, is_required: checked })}
              />
              <Label htmlFor="draft-required" className="cursor-pointer">
                Gör frågan obligatorisk
              </Label>
            </div>

            {/* Flervalsalternativ */}
            {questionDraft.question_type === 'multiple_choice' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Svarsalternativ</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const options = questionDraft.options || [];
                      setQuestionDraft({ ...questionDraft, options: [...options, ''] });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Lägg till alternativ
                  </Button>
                </div>
                <div className="space-y-2">
                  {(questionDraft.options || []).map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const options = [...(questionDraft.options || [])];
                          options[optionIndex] = e.target.value;
                          setQuestionDraft({ ...questionDraft, options });
                        }}
                        placeholder={`Alternativ ${optionIndex + 1}`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const options = (questionDraft.options || []).filter((_, i) => i !== optionIndex);
                          setQuestionDraft({ ...questionDraft, options });
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={cancelAddQuestion}>
                Avbryt
              </Button>
              <Button 
                onClick={confirmAddQuestion}
                disabled={!questionDraft.question_text.trim()}
              >
                Spara
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questions.map((q, i) => q.id || `question-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          {questions.map((question, index) => (
            <SortableQuestionCard
              key={question.id || `question-${index}`}
              question={question}
              index={index}
              updateQuestion={updateQuestion}
              removeQuestion={removeQuestion}
              addOption={addOption}
              updateOption={updateOption}
              removeOption={removeOption}
              getQuestionTypeLabel={getQuestionTypeLabel}
            />
          ))}
        </SortableContext>
      </DndContext>

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
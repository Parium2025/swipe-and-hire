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
import { Plus, Trash2, GripVertical, HelpCircle, Search } from 'lucide-react';
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
  onEdit: (index: number) => void;
}

const SortableQuestionCard = ({
  question,
  index,
  updateQuestion,
  removeQuestion,
  addOption,
  updateOption,
  removeOption,
  getQuestionTypeLabel,
  onEdit
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
    <Card 
      ref={setNodeRef} 
      style={style}
      className="bg-white/10 backdrop-blur-sm border-white/20 shadow-sm hover:shadow-md transition-shadow mb-3"
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header med grip, typ och actions */}
          <div className="flex items-start gap-3">
            <div 
              {...attributes} 
              {...listeners} 
              className="cursor-grab active:cursor-grabbing pt-1 flex-shrink-0"
            >
              <GripVertical className="h-5 w-5 text-white/70 hover:text-white" />
            </div>
            
            <div className="flex-1 space-y-2">
              {/* Frågetext */}
              <div>
                <p className="text-white font-medium text-base">
                  {question.question_text || 'Skriv din fråga...'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="outline" 
                    className="text-xs text-white/80 border-white/30 bg-white/5"
                  >
                    Typ: {getQuestionTypeLabel(question.question_type)}
                  </Badge>
                  <Badge 
                    variant={question.is_required ? "default" : "outline"}
                    className={question.is_required 
                      ? "text-xs bg-white/20 text-white border-white/30" 
                      : "text-xs text-white/60 border-white/20 bg-transparent"
                    }
                  >
                    {question.is_required ? 'Obligatorisk' : 'Frivillig'}
                  </Badge>
                </div>
              </div>

              {/* Alternativ för flervalsfrågor */}
              {question.question_type === 'multiple_choice' && question.options && question.options.length > 0 && (
                <div className="pl-2 border-l-2 border-white/20">
                  <p className="text-xs text-white/60 mb-1">Alternativ:</p>
                  <div className="space-y-1">
                    {question.options.map((option, idx) => (
                      <p key={idx} className="text-sm text-white/80">
                        • {option || `Alternativ ${idx + 1}`}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => onEdit(index)}
              >
                <svg className="text-[hsl(var(--pure-white))]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => removeQuestion(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const JobQuestionsManager = ({ jobId, onQuestionsChange }: JobQuestionsManagerProps) => {
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<JobQuestion['question_type'] | null>(null);
  const [questionDraft, setQuestionDraft] = useState<JobQuestion | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  const startEditQuestion = (index: number) => {
    setEditingQuestionIndex(index);
    setQuestionDraft({ ...questions[index] });
    setAddingQuestion(true);
  };

  const confirmEditQuestion = () => {
    if (editingQuestionIndex !== null && questionDraft && questionDraft.question_text.trim()) {
      const updated = [...questions];
      updated[editingQuestionIndex] = questionDraft;
      setQuestions(updated);
      setAddingQuestion(false);
      setEditingQuestionIndex(null);
      setQuestionDraft(null);
    }
  };

  const cancelEditQuestion = () => {
    setAddingQuestion(false);
    setEditingQuestionIndex(null);
    setQuestionDraft(null);
    setSelectedType(null);
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

  // Filter questions based on search query
  const filteredQuestions = questions.filter(q => 
    q.question_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Ansökningsfrågor
        </h3>
        <p className="text-sm text-muted-foreground">
          Lägg till egna frågor som jobbsökare måste svara på
        </p>
      </div>

      {/* Search field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök efter fråga..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Add question button - always visible */}
      <Button 
        onClick={addQuestion}
        className="w-full bg-primary hover:bg-primary/90 text-white"
      >
        <Plus className="h-4 w-4 mr-2 text-[hsl(var(--pure-white))]" />
        Skapa ny fråga
      </Button>

      {/* Ny/Redigera fråga dialog */}
      {addingQuestion && questionDraft && (
        <Card className="border-2 border-primary/50 bg-card">
          <CardHeader>
            <CardTitle className="text-xl">
              {editingQuestionIndex !== null ? 'Redigera fråga' : 'Ny fråga'}
            </CardTitle>
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
                className="h-9 text-sm"
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
                    <Plus className="h-4 w-4 mr-1 text-[hsl(var(--pure-white))]" />
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
                        className="h-9 text-sm"
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
              <Button variant="outline" onClick={editingQuestionIndex !== null ? cancelEditQuestion : cancelAddQuestion}>
                Avbryt
              </Button>
              <Button 
                onClick={editingQuestionIndex !== null ? confirmEditQuestion : confirmAddQuestion}
                disabled={!questionDraft.question_text.trim()}
              >
                Spara
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions list */}
      {filteredQuestions.length > 0 && (
        <div className="space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredQuestions.map((q, i) => q.id || `question-${i}`)}
              strategy={verticalListSortingStrategy}
            >
              {filteredQuestions.map((question, index) => {
                const actualIndex = questions.findIndex(q => q === question);
                return (
                  <SortableQuestionCard
                    key={question.id || `question-${index}`}
                    question={question}
                    index={actualIndex}
                    updateQuestion={updateQuestion}
                    removeQuestion={removeQuestion}
                    addOption={addOption}
                    updateOption={updateOption}
                    removeOption={removeOption}
                    getQuestionTypeLabel={getQuestionTypeLabel}
                    onEdit={startEditQuestion}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      )}

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
            <p className="text-muted-foreground">
              Klicka på "Skapa ny fråga" ovan för att lägga till din första fråga
            </p>
          </CardContent>
        </Card>
      )}

      {searchQuery && filteredQuestions.length === 0 && questions.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="text-center py-8">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Inga resultat</h3>
            <p className="text-muted-foreground">
              Hittade inga frågor som matchar "{searchQuery}"
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JobQuestionsManager;
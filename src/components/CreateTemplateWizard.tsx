import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { searchOccupations } from '@/lib/occupations';
import { ArrowLeft, ArrowRight, Loader2, X, ChevronDown, Plus, Trash2, GripVertical } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { AnimatedBackground } from '@/components/AnimatedBackground';
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
  question_type: 'text' | 'yes_no' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range' | 'video';
  options?: string[];
  is_required: boolean;
  order_index: number;
  min_value?: number;
  max_value?: number;
  placeholder_text?: string;
}

interface TemplateFormData {
  name: string;
  title: string;
  description: string;
  requirements: string;
  location: string;
  salary_min: string;
  salary_max: string;
  employment_type: string;
  work_schedule: string;
  contact_email: string;
  application_instructions: string;
}

interface CreateTemplateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateCreated: () => void;
}

// Sortable Question Item Component
const SortableQuestionItem = ({ 
  question, 
  onEdit, 
  onDelete 
}: { 
  question: JobQuestion;
  onEdit: (question: JobQuestion) => void;
  onDelete: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white/5 rounded-lg p-4 border border-white/20"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="text-white/40 hover:text-white/70 cursor-grab active:cursor-grabbing pt-1 touch-none"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          
          <div className="flex-1">
            <div className="text-white font-medium text-sm mb-1">
              {question.question_text || 'Ingen frågetext'}
            </div>
            <div className="text-white/60 text-xs mb-2">
              Typ: {question.question_type === 'text' ? 'Text' : 
                    question.question_type === 'yes_no' ? 'Ja/Nej' :
                    question.question_type === 'multiple_choice' ? 'Flervalsval' :
                    question.question_type === 'number' ? 'Siffra' : question.question_type}
              {question.is_required && ' • Obligatorisk'}
            </div>
            {question.question_type === 'multiple_choice' && question.options && (
              <div className="text-white/50 text-xs">
                Alternativ: {question.options.filter(o => o.trim()).join(', ')}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <Button
            onClick={() => onEdit(question)}
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
          >
            ✏️
          </Button>
          <Button
            onClick={() => onDelete(question.id!)}
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const CreateTemplateWizard = ({ open, onOpenChange, onTemplateCreated }: CreateTemplateWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<JobQuestion[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<JobQuestion | null>(null);
  const [employmentTypeSearchTerm, setEmploymentTypeSearchTerm] = useState('');
  const [showEmploymentTypeDropdown, setShowEmploymentTypeDropdown] = useState(false);
  const [questionTypeSearchTerm, setQuestionTypeSearchTerm] = useState('');
  const [showQuestionTypeDropdown, setShowQuestionTypeDropdown] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    title: '',
    description: '',
    requirements: '',
    location: '',
    salary_min: '',
    salary_max: '',
    employment_type: '',
    work_schedule: '',
    contact_email: '',
    application_instructions: ''
  });

  const steps = [
    {
      title: 'Mallnamn & Grundinfo',
      fields: ['name', 'title', 'description', 'employment_type']
    },
    {
      title: 'Ansökningsfrågor',
      fields: []
    }
  ];

  const questionTypes = [
    { value: 'text', label: 'Text' },
    { value: 'yes_no', label: 'Ja/Nej' },
    { value: 'multiple_choice', label: 'Flervalsval' },
    { value: 'number', label: 'Siffra' }
  ];

  const handleInputChange = (field: keyof TemplateFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateCurrentStep = () => {
    if (currentStep === 0) {
      return formData.name.trim() && 
             formData.title.trim() && 
             formData.description.trim() &&
             formData.employment_type;
    }
    return true;
  };

  const nextStep = () => {
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
      }, 0);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
      }, 0);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setFormData({
      name: '',
      title: '',
      description: '',
      requirements: '',
      location: '',
      salary_min: '',
      salary_max: '',
      employment_type: '',
      work_schedule: '',
      contact_email: '',
      application_instructions: ''
    });
    setCustomQuestions([]);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!user || !validateCurrentStep()) return;

    setLoading(true);

    try {
      const templateData = {
        employer_id: user.id,
        name: formData.name,
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || null,
        location: formData.location || '',
        employment_type: formData.employment_type || null,
        work_schedule: formData.work_schedule || null,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        questions: customQuestions.length > 0 ? customQuestions.map(q => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || [],
          is_required: q.is_required,
          order_index: q.order_index,
          placeholder_text: q.placeholder_text || null
        })) : [],
        is_default: false
      };

      const { error } = await supabase
        .from('job_templates')
        .insert([templateData]);

      if (error) {
        toast({
          title: "Fel vid skapande av mall",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Mall skapad!",
        description: `Mallen "${formData.name}" har skapats.`
      });

      handleClose();
      onTemplateCreated();

    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skapa mallen.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Question management functions
  const addCustomQuestion = () => {
    const newQuestion: JobQuestion = {
      id: `temp_${Date.now()}`,
      question_text: '',
      question_type: 'text',
      is_required: true,
      order_index: customQuestions.length,
      options: []
    };
    setEditingQuestion(newQuestion);
    setShowQuestionForm(true);
  };

  const saveCustomQuestion = () => {
    if (!editingQuestion?.question_text.trim()) return;
    
    const filteredQuestion = {
      ...editingQuestion,
      options: editingQuestion.question_type === 'multiple_choice' 
        ? editingQuestion.options?.filter(opt => opt.trim() !== '')
        : editingQuestion.options
    };
    
    if (customQuestions.find(q => q.id === filteredQuestion.id)) {
      setCustomQuestions(prev => 
        prev.map(q => q.id === filteredQuestion.id ? filteredQuestion : q)
      );
    } else {
      setCustomQuestions(prev => [...prev, filteredQuestion]);
    }
    
    setShowQuestionForm(false);
    setEditingQuestion(null);
  };

  const deleteCustomQuestion = (questionId: string) => {
    setCustomQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  const editCustomQuestion = (question: JobQuestion) => {
    setEditingQuestion(question);
    setShowQuestionForm(true);
  };

  const updateQuestionField = (field: keyof JobQuestion, value: any) => {
    if (!editingQuestion) return;
    
    let updatedQuestion = { ...editingQuestion, [field]: value };
    
    if (field === 'question_type') {
      updatedQuestion = {
        ...updatedQuestion,
        options: value === 'multiple_choice' ? [''] : undefined,
      };
    }
    
    setEditingQuestion(updatedQuestion);
  };

  const addOption = () => {
    if (!editingQuestion) return;
    const newOptions = [...(editingQuestion.options || []), ''];
    setEditingQuestion({
      ...editingQuestion,
      options: newOptions
    });
  };

  const updateOption = (index: number, value: string) => {
    if (!editingQuestion) return;
    const newOptions = [...(editingQuestion.options || [])];
    newOptions[index] = value;
    setEditingQuestion({
      ...editingQuestion,
      options: newOptions
    });
  };

  const removeOption = (index: number) => {
    if (!editingQuestion) return;
    const newOptions = [...(editingQuestion.options || [])];
    newOptions.splice(index, 1);
    setEditingQuestion({
      ...editingQuestion,
      options: newOptions
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCustomQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        return reorderedItems.map((item, index) => ({
          ...item,
          order_index: index
        }));
      });
    }
  };

  const handleEmploymentTypeSearch = (value: string) => {
    setEmploymentTypeSearchTerm(value);
    setShowEmploymentTypeDropdown(value.length >= 0);
  };

  const handleEmploymentTypeSelect = (type: { value: string, label: string }) => {
    handleInputChange('employment_type', type.value);
    setEmploymentTypeSearchTerm(type.label);
    setShowEmploymentTypeDropdown(false);
  };

  const handleEmploymentTypeClick = () => {
    setEmploymentTypeSearchTerm('');
    setShowEmploymentTypeDropdown(!showEmploymentTypeDropdown);
  };

  const handleQuestionTypeSearch = (value: string) => {
    setQuestionTypeSearchTerm(value);
    setShowQuestionTypeDropdown(value.length >= 0);
  };

  const handleQuestionTypeSelect = (type: { value: string, label: string }) => {
    updateQuestionField('question_type', type.value);
    setQuestionTypeSearchTerm(type.label);
    setShowQuestionTypeDropdown(false);
  };

  const handleQuestionTypeClick = () => {
    setQuestionTypeSearchTerm('');
    setShowQuestionTypeDropdown(!showQuestionTypeDropdown);
  };

  const filteredEmploymentTypes = employmentTypeSearchTerm.length > 0 
    ? EMPLOYMENT_TYPES.filter(type => 
        type.label.toLowerCase().includes(employmentTypeSearchTerm.toLowerCase())
      )
    : EMPLOYMENT_TYPES;

  const filteredQuestionTypes = questionTypeSearchTerm.length > 0
    ? questionTypes.filter(type => 
        type.label.toLowerCase().includes(questionTypeSearchTerm.toLowerCase())
      )
    : questionTypes;

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] max-h-[800px] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden">
        <AnimatedBackground showBubbles={false} />
        <div className="flex flex-col h-full relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/20 flex-shrink-0 rounded-t-[24px] bg-background/10">
            <DialogHeader className="flex-1">
              <DialogTitle className="text-white text-lg">
                {showQuestionForm ? 'Lägg till fråga' : steps[currentStep].title}
              </DialogTitle>
              {!showQuestionForm && (
                <div className="text-sm text-white">
                  Steg {currentStep + 1} av {steps.length}
                </div>
              )}
            </DialogHeader>
            <Button
              variant="ghost"
              size="icon"
              onClick={showQuestionForm ? () => setShowQuestionForm(false) : handleClose}
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          {!showQuestionForm && (
            <div className="px-4 py-2 flex-shrink-0">
              <Progress 
                value={progress} 
                className="h-1 bg-white/20 [&>div]:bg-white"
              />
            </div>
          )}

          {/* Scrollable Content */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Question Form */}
            {showQuestionForm && editingQuestion && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Frågetext *</Label>
                  <Input
                    value={editingQuestion.question_text}
                    onChange={(e) => updateQuestionField('question_text', e.target.value)}
                    placeholder="Skriv din fråga här"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Frågetyp *</Label>
                  <div className="relative question-type-dropdown">
                    <Input
                      value={questionTypeSearchTerm || questionTypes.find(t => t.value === editingQuestion.question_type)?.label || ''}
                      onChange={(e) => handleQuestionTypeSearch(e.target.value)}
                      onClick={handleQuestionTypeClick}
                      placeholder="Välj frågetyp"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showQuestionTypeDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredQuestionTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleQuestionTypeSelect(type)}
                            className="w-full px-3 py-3 text-left hover:bg-gray-700 text-white text-base border-b border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {editingQuestion.question_type === 'multiple_choice' && (
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Svarsalternativ</Label>
                    {editingQuestion.options?.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Alternativ ${index + 1}`}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                        <Button
                          onClick={() => removeOption(index)}
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      onClick={addOption}
                      variant="outline"
                      className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Lägg till alternativ
                    </Button>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={saveCustomQuestion}
                    disabled={!editingQuestion.question_text.trim()}
                    className="flex-1"
                  >
                    Spara fråga
                  </Button>
                  <Button
                    onClick={() => setShowQuestionForm(false)}
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Avbryt
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Grundinfo */}
            {!showQuestionForm && currentStep === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Mallnamn *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="t.ex. Standard Lagerarbetare"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Jobbtitel *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="t.ex. Lagerarbetare"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Anställningsform *</Label>
                  <div className="relative employment-type-dropdown">
                    <Input
                      value={employmentTypeSearchTerm || EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label || ''}
                      onChange={(e) => handleEmploymentTypeSearch(e.target.value)}
                      onClick={handleEmploymentTypeClick}
                      placeholder="Välj anställningsform"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showEmploymentTypeDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredEmploymentTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleEmploymentTypeSelect(type)}
                            className="w-full px-3 py-3 text-left hover:bg-gray-700 text-white text-base border-b border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Beskrivning *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..."
                    rows={4}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Krav och kvalifikationer</Label>
                  <Textarea
                    value={formData.requirements}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                    placeholder="Beskriv vilka krav och kvalifikationer som krävs..."
                    rows={3}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Minimilön (kr/mån)</Label>
                    <Input
                      type="number"
                      value={formData.salary_min}
                      onChange={(e) => handleInputChange('salary_min', e.target.value)}
                      placeholder="25000"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Maxlön (kr/mån)</Label>
                    <Input
                      type="number"
                      value={formData.salary_max}
                      onChange={(e) => handleInputChange('salary_max', e.target.value)}
                      placeholder="35000"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Arbetstider</Label>
                  <Input
                    value={formData.work_schedule}
                    onChange={(e) => handleInputChange('work_schedule', e.target.value)}
                    placeholder="t.ex. 08:00-17:00, Skiftarbete"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Kontakt-email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder="kontakt@företag.se"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Questions */}
            {!showQuestionForm && currentStep === 1 && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-white/70 text-sm mb-4">
                    Lägg till ansökningsfrågor som kommer att användas som standard för denna mall.
                  </p>
                  <Button
                    onClick={addCustomQuestion}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Lägg till fråga
                  </Button>
                </div>

                {customQuestions.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={customQuestions.map(q => q.id!)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {customQuestions.map((question) => (
                          <SortableQuestionItem
                            key={question.id}
                            question={question}
                            onEdit={editCustomQuestion}
                            onDelete={deleteCustomQuestion}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          {!showQuestionForm && (
            <div className="flex-shrink-0 p-4 border-t border-white/20 bg-background/10">
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button
                    onClick={prevStep}
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Tillbaka
                  </Button>
                )}
                
                {!isLastStep && (
                  <Button
                    onClick={nextStep}
                    disabled={!validateCurrentStep()}
                    className="flex-1"
                  >
                    Nästa
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                
                {isLastStep && (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !validateCurrentStep()}
                    className="flex-1"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Skapa mall
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTemplateWizard;

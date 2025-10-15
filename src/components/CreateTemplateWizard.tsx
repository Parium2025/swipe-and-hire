import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
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
  occupation: string;
  salary_min: string;
  salary_max: string;
  employment_type: string;
  salary_type: string;
  positions_count: string;
  work_location_type: string;
  remote_work_possible: string;
  workplace_name: string;
  workplace_address: string;
  workplace_postal_code: string;
  workplace_city: string;
  work_schedule: string;
  contact_email: string;
  application_instructions: string;
  pitch: string;
}

interface CreateTemplateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateCreated: () => void;
  templateToEdit?: any;
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
            className="text-white hover:text-white cursor-grab active:cursor-grabbing pt-1 touch-none"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          
          <div className="flex-1">
            <div className="text-white font-medium text-sm mb-1">
              {question.question_text || 'Ingen frågetext'}
            </div>
            <div className="text-white text-xs mb-2">
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
            className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const CreateTemplateWizard = ({ open, onOpenChange, onTemplateCreated, templateToEdit }: CreateTemplateWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [customQuestions, setCustomQuestions] = useState<JobQuestion[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<JobQuestion | null>(null);
  const [employmentTypeSearchTerm, setEmploymentTypeSearchTerm] = useState('');
  const [showEmploymentTypeDropdown, setShowEmploymentTypeDropdown] = useState(false);
  const [questionTypeSearchTerm, setQuestionTypeSearchTerm] = useState('');
  const [showQuestionTypeDropdown, setShowQuestionTypeDropdown] = useState(false);
  const [occupationSearchTerm, setOccupationSearchTerm] = useState('');
  const [showOccupationDropdown, setShowOccupationDropdown] = useState(false);
  const [salaryTypeSearchTerm, setSalaryTypeSearchTerm] = useState('');
  const [showSalaryTypeDropdown, setShowSalaryTypeDropdown] = useState(false);
  const [workLocationSearchTerm, setWorkLocationSearchTerm] = useState('');
  const [showWorkLocationDropdown, setShowWorkLocationDropdown] = useState(false);
  const [remoteWorkSearchTerm, setRemoteWorkSearchTerm] = useState('');
  const [showRemoteWorkDropdown, setShowRemoteWorkDropdown] = useState(false);
  
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
    occupation: '',
    salary_min: '',
    salary_max: '',
    employment_type: '',
    salary_type: '',
    positions_count: '1',
    work_location_type: 'på-plats',
    remote_work_possible: 'nej',
    workplace_name: '',
    workplace_address: '',
    workplace_postal_code: '',
    workplace_city: '',
    work_schedule: '',
    contact_email: '',
    application_instructions: '',
    pitch: ''
  });

  // Load user profile for company info
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setProfile(data);
      
      if (data?.company_name && !formData.workplace_name) {
        setFormData(prev => ({
          ...prev,
          workplace_name: data.company_name
        }));
      }
      
      if (!formData.contact_email && user.email) {
        setFormData(prev => ({
          ...prev,
          contact_email: user.email
        }));
      }
    };

    if (open) {
      fetchProfile();
    }
  }, [user, open]);

  // Load template data when editing
  useEffect(() => {
    if (templateToEdit && open) {
      setFormData({
        name: templateToEdit.name || '',
        title: templateToEdit.title || '',
        occupation: templateToEdit.occupation || '',
        description: templateToEdit.description || '',
        pitch: templateToEdit.pitch || '',
        employment_type: templateToEdit.employment_type || '',
        work_schedule: templateToEdit.work_schedule || '',
        salary_type: templateToEdit.salary_type || '',
        salary_min: templateToEdit.salary_min?.toString() || '',
        salary_max: templateToEdit.salary_max?.toString() || '',
        positions_count: templateToEdit.positions_count || '1',
        work_location_type: templateToEdit.work_location_type || 'på-plats',
        remote_work_possible: templateToEdit.remote_work_possible || 'nej',
        workplace_name: templateToEdit.workplace_name || '',
        workplace_address: templateToEdit.workplace_address || '',
        workplace_postal_code: templateToEdit.workplace_postal_code || '',
        workplace_city: templateToEdit.workplace_city || '',
        requirements: templateToEdit.requirements || '',
        contact_email: templateToEdit.contact_email || '',
        application_instructions: templateToEdit.application_instructions || '',
        location: ''
      });
      
      if (templateToEdit.questions && Array.isArray(templateToEdit.questions)) {
        // Ensure each question has a unique ID
        const questionsWithIds = templateToEdit.questions.map((q: JobQuestion, index: number) => ({
          ...q,
          id: q.id || `temp_${Date.now()}_${index}`,
          order_index: index
        }));
        setCustomQuestions(questionsWithIds);
      }
    } else if (!open) {
      // Reset when dialog closes
      setFormData({
        name: '',
        title: '',
        description: '',
        requirements: '',
        location: '',
        occupation: '',
        salary_min: '',
        salary_max: '',
        employment_type: '',
        salary_type: '',
        positions_count: '1',
        work_location_type: 'på-plats',
        remote_work_possible: 'nej',
        workplace_name: '',
        workplace_address: '',
        workplace_postal_code: '',
        workplace_city: '',
        work_schedule: '',
        contact_email: '',
        application_instructions: '',
        pitch: ''
      });
      setCustomQuestions([]);
      setCurrentStep(0);
    }
  }, [templateToEdit, open]);

  const steps = [
    {
      title: "Mallnamn",
      fields: ['name']
    },
    {
      title: "Grundinfo",
      fields: ['title', 'occupation', 'description', 'employment_type', 'salary_type', 'positions_count']
    },
    {
      title: "Var finns jobbet?",
      fields: ['work_location_type', 'remote_work_possible', 'workplace_name', 'contact_email', 'workplace_postal_code', 'workplace_city']
    },
    {
      title: "Ansökningsfrågor",
      fields: []
    }
  ];

  const questionTypes = [
    { value: 'text', label: 'Text' },
    { value: 'yes_no', label: 'Ja/Nej' },
    { value: 'multiple_choice', label: 'Flervalsval' },
    { value: 'number', label: 'Siffra' }
  ];

  const salaryTypes = [
    { value: 'fast', label: 'Fast månads- vecko- eller timlön' },
    { value: 'rorlig', label: 'Rörlig ackord- eller provisionslön' },
    { value: 'fast-rorlig', label: 'Fast och rörlig lön' }
  ];

  const workLocationTypes = [
    { value: 'på-plats', label: 'På plats' },
    { value: 'hemarbete', label: 'Hemarbete' },
    { value: 'hybridarbete', label: 'Hybridarbete' },
    { value: 'fältarbete', label: 'Fältarbete/ute' },
    { value: 'utomlands', label: 'Utomlands' }
  ];

  const remoteWorkOptions = [
    { value: 'nej', label: 'Nej' },
    { value: 'delvis', label: 'Delvis' },
    { value: 'ja', label: 'Ja, helt' }
  ];

  const handleInputChange = (field: keyof TemplateFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOccupationSearch = (value: string) => {
    setOccupationSearchTerm(value);
    handleInputChange('occupation', value);
    setShowOccupationDropdown(value.length > 0);
  };

  const handleOccupationSelect = (occupation: string) => {
    handleInputChange('occupation', occupation);
    setOccupationSearchTerm(occupation);
    setShowOccupationDropdown(false);
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

  const handleSalaryTypeSearch = (value: string) => {
    setSalaryTypeSearchTerm(value);
    setShowSalaryTypeDropdown(value.length >= 0);
  };

  const handleSalaryTypeSelect = (type: { value: string, label: string }) => {
    handleInputChange('salary_type', type.value);
    setSalaryTypeSearchTerm(type.label);
    setShowSalaryTypeDropdown(false);
  };

  const handleSalaryTypeClick = () => {
    setSalaryTypeSearchTerm('');
    setShowSalaryTypeDropdown(!showSalaryTypeDropdown);
  };

  const handleWorkLocationSearch = (value: string) => {
    setWorkLocationSearchTerm(value);
    setShowWorkLocationDropdown(value.length >= 0);
  };

  const handleWorkLocationSelect = (type: { value: string, label: string }) => {
    handleInputChange('work_location_type', type.value);
    setWorkLocationSearchTerm(type.label);
    setShowWorkLocationDropdown(false);
  };

  const handleWorkLocationClick = () => {
    setWorkLocationSearchTerm('');
    setShowWorkLocationDropdown(!showWorkLocationDropdown);
  };

  const handleRemoteWorkSearch = (value: string) => {
    setRemoteWorkSearchTerm(value);
    setShowRemoteWorkDropdown(value.length >= 0);
  };

  const handleRemoteWorkSelect = (type: { value: string, label: string }) => {
    handleInputChange('remote_work_possible', type.value);
    setRemoteWorkSearchTerm(type.label);
    setShowRemoteWorkDropdown(false);
  };

  const handleRemoteWorkClick = () => {
    setRemoteWorkSearchTerm('');
    setShowRemoteWorkDropdown(!showRemoteWorkDropdown);
  };

  const handleWorkplacePostalCodeChange = useCallback((postalCode: string) => {
    handleInputChange('workplace_postal_code', postalCode);
  }, []);

  const handleWorkplaceLocationChange = useCallback((location: string) => {
    setFormData(prev => ({
      ...prev,
      workplace_city: location,
      location: location
    }));
  }, []);

  const filteredEmploymentTypes = employmentTypeSearchTerm.length > 0 
    ? EMPLOYMENT_TYPES.filter(type => 
        type.label.toLowerCase().includes(employmentTypeSearchTerm.toLowerCase())
      )
    : EMPLOYMENT_TYPES;

  const filteredSalaryTypes = salaryTypeSearchTerm.length > 0
    ? salaryTypes.filter(type => 
        type.label.toLowerCase().includes(salaryTypeSearchTerm.toLowerCase())
      )
    : salaryTypes;

  const filteredWorkLocationTypes = workLocationSearchTerm.length > 0
    ? workLocationTypes.filter(type => 
        type.label.toLowerCase().includes(workLocationSearchTerm.toLowerCase())
      )
    : workLocationTypes;

  const filteredRemoteWorkOptions = remoteWorkSearchTerm.length > 0
    ? remoteWorkOptions.filter(type => 
        type.label.toLowerCase().includes(remoteWorkSearchTerm.toLowerCase())
      )
    : remoteWorkOptions;

  const filteredOccupations = occupationSearchTerm.length > 0 ? searchOccupations(occupationSearchTerm) : [];

  const filteredQuestionTypes = questionTypeSearchTerm.length > 0
    ? questionTypes.filter(type => 
        type.label.toLowerCase().includes(questionTypeSearchTerm.toLowerCase())
      )
    : questionTypes;

  const validateCurrentStep = () => {
    if (currentStep === 0) {
      return formData.name.trim();
    }
    if (currentStep === 1) {
      return formData.title.trim() && 
             formData.occupation.trim() && 
             formData.description.trim() &&
             formData.employment_type &&
             formData.salary_type &&
             parseInt(formData.positions_count) > 0;
    }
    if (currentStep === 2) {
      return formData.work_location_type && 
             formData.remote_work_possible && 
             formData.workplace_name.trim() && 
             formData.contact_email.trim() && 
             formData.workplace_postal_code.trim() && 
             formData.workplace_city.trim();
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
      occupation: '',
      salary_min: '',
      salary_max: '',
      employment_type: '',
      salary_type: '',
      positions_count: '1',
      work_location_type: 'på-plats',
      remote_work_possible: 'nej',
      workplace_name: '',
      workplace_address: '',
      workplace_postal_code: '',
      workplace_city: '',
      work_schedule: '',
      contact_email: '',
      application_instructions: '',
      pitch: ''
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
        occupation: formData.occupation || null,
        employment_type: formData.employment_type || null,
        work_schedule: formData.work_schedule || null,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        salary_type: formData.salary_type || null,
        work_location_type: formData.work_location_type || null,
        remote_work_possible: formData.remote_work_possible || null,
        workplace_name: formData.workplace_name || null,
        workplace_address: formData.workplace_address || null,
        workplace_postal_code: formData.workplace_postal_code || null,
        workplace_city: formData.workplace_city || null,
        positions_count: formData.positions_count || null,
        pitch: formData.pitch || null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        questions: customQuestions.length > 0 ? customQuestions.map(q => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || [],
          is_required: q.is_required,
          order_index: q.order_index,
          placeholder_text: q.placeholder_text || null,
          min_value: q.min_value || null,
          max_value: q.max_value || null
        })) : [],
        is_default: false
      };

      if (templateToEdit) {
        // Update existing template
        const { error } = await supabase
          .from('job_templates')
          .update(templateData)
          .eq('id', templateToEdit.id);

        if (error) {
          toast({
            title: "Fel vid uppdatering av mall",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Mall uppdaterad!",
          description: `Mallen "${formData.name}" har uppdaterats.`
        });
      } else {
        // Create new template
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
      }

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
                {showQuestionForm ? 'Lägg till fråga' : (templateToEdit ? 'Redigera mall' : steps[currentStep].title)}
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

                {editingQuestion.question_type === 'text' && (
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Rubrik *</Label>
                    <Input
                      value={editingQuestion.question_text}
                      onChange={(e) => updateQuestionField('question_text', e.target.value)}
                      placeholder="T.ex. Beskriv dina erfarenheter inom..."
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  </div>
                )}

                {editingQuestion.question_type === 'yes_no' && (
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Rubrik *</Label>
                    <Input
                      value={editingQuestion.question_text}
                      onChange={(e) => updateQuestionField('question_text', e.target.value)}
                      placeholder="T.ex. Har du körkort?, Kan du arbeta helger?..."
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  </div>
                )}

                {editingQuestion.question_type === 'number' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Rubrik *</Label>
                      <Input
                        value={editingQuestion.question_text}
                        onChange={(e) => updateQuestionField('question_text', e.target.value)}
                        placeholder="T.ex. Ålder, Antal års erfarenhet..."
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Min värde</Label>
                        <Input
                          type="number"
                          value={editingQuestion.min_value ?? ''}
                          onChange={(e) => updateQuestionField('min_value', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="0"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Max värde</Label>
                        <Input
                          type="number"
                          value={editingQuestion.max_value ?? ''}
                          onChange={(e) => updateQuestionField('max_value', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="100"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>
                    </div>
                  </>
                )}

                {editingQuestion.question_type === 'multiple_choice' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Rubrik *</Label>
                      <Input
                        value={editingQuestion.question_text}
                        onChange={(e) => updateQuestionField('question_text', e.target.value)}
                        placeholder="T.ex. Vilka behörigheter har du?"
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white font-medium">Svarsalternativ</Label>
                      <div className="space-y-2">
                        {(editingQuestion.options || []).map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(index, e.target.value)}
                              placeholder={`Alternativ ${index + 1}`}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                            />
                            <Button
                              onClick={() => removeOption(index)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          onClick={addOption}
                          variant="outline"
                          size="sm"
                          className="border-white/40 text-white bg-transparent hover:bg-transparent hover:border-white/60"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Lägg till alternativ
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center space-x-3">
                  <Switch
                    checked={editingQuestion.is_required || false}
                    onCheckedChange={(checked) => updateQuestionField('is_required', checked)}
                  />
                  <Label className="text-white font-medium">Obligatorisk fråga</Label>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={saveCustomQuestion}
                    disabled={!editingQuestion.question_text?.trim()}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Spara fråga
                  </Button>
                </div>
              </div>
            )}

            {/* Step 0: Mallnamn */}
            {!showQuestionForm && currentStep === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Mallnamn *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="t.ex. Standard Lagerarbetare"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                  />
                </div>
              </div>
            )}

            {/* Step 1: Grundinfo - EXAKT SAMMA SOM MOBILEJOBWIZARD */}
            {!showQuestionForm && currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Jobbtitel *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="t.ex. Lagerarbetare"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Yrke *</Label>
                  <div className="relative occupation-dropdown">
                    <Input
                      value={formData.occupation}
                      onChange={(e) => handleOccupationSearch(e.target.value)}
                      onFocus={() => setShowOccupationDropdown(occupationSearchTerm.length > 0)}
                      placeholder="t.ex. Mjukvaru- och systemutvecklare"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                    
                    {showOccupationDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredOccupations.map((occupation, index) => (
                          <button
                            key={`${occupation}-${index}`}
                            type="button"
                            onClick={() => handleOccupationSelect(occupation)}
                            className="w-full px-3 py-3 text-left hover:bg-gray-700 text-white text-base border-b border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium">{occupation}</div>
                          </button>
                        ))}
                        
                        {occupationSearchTerm.trim().length >= 2 &&
                         filteredOccupations.length === 0 && (
                          <button
                            type="button"
                            onClick={() => handleOccupationSelect(occupationSearchTerm)}
                            className="w-full px-3 py-3 text-left hover:bg-gray-700 text-white text-base border-t border-gray-700/30"
                          >
                            <span className="font-medium">Använd "{occupationSearchTerm}"</span>
                          </button>
                        )}
                        
                        {occupationSearchTerm.trim().length > 0 && occupationSearchTerm.trim().length < 2 && (
                          <div className="py-4 px-3 text-center text-white not-italic text-sm">
                            Skriv minst 2 bokstäver för att söka
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Jobbeskrivning *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..."
                    rows={4}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base resize-none leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Anställningsform *</Label>
                  <div className="relative employment-type-dropdown">
                    <Input
                      value={employmentTypeSearchTerm || (formData.employment_type ? EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label || '' : '')}
                      onChange={(e) => handleEmploymentTypeSearch(e.target.value)}
                      onClick={handleEmploymentTypeClick}
                      placeholder="Välj anställningsform"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showEmploymentTypeDropdown && (
                       <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 shadow-lg">
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
                  <Label className="text-white font-medium">Lönetyp</Label>
                  <div className="relative salary-type-dropdown">
                    <Input
                      value={salaryTypeSearchTerm || (formData.salary_type ? salaryTypes.find(t => t.value === formData.salary_type)?.label || '' : '')}
                      onChange={(e) => handleSalaryTypeSearch(e.target.value)}
                      onClick={handleSalaryTypeClick}
                      placeholder="Välj lönetyp"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showSalaryTypeDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredSalaryTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleSalaryTypeSelect(type)}
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
                  <Label className="text-white font-medium">Antal personer att rekrytera</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.positions_count}
                    onChange={(e) => handleInputChange('positions_count', e.target.value)}
                    placeholder="1"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Var finns jobbet - EXAKT SAMMA SOM MOBILEJOBWIZARD */}
            {!showQuestionForm && currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Var utförs arbetet? *</Label>
                  <div className="relative work-location-dropdown">
                    <Input
                      value={workLocationSearchTerm || (formData.work_location_type ? workLocationTypes.find(t => t.value === formData.work_location_type)?.label || '' : '')}
                      onChange={(e) => handleWorkLocationSearch(e.target.value)}
                      onClick={handleWorkLocationClick}
                      placeholder="Välj arbetsplats"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showWorkLocationDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredWorkLocationTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleWorkLocationSelect(type)}
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
                  <Label className="text-white font-medium">Är distansarbete möjligt? *</Label>
                  <div className="relative remote-work-dropdown">
                    <Input
                      value={remoteWorkSearchTerm || (formData.remote_work_possible ? remoteWorkOptions.find(t => t.value === formData.remote_work_possible)?.label || '' : '')}
                      onChange={(e) => handleRemoteWorkSearch(e.target.value)}
                      onClick={handleRemoteWorkClick}
                      placeholder="Välj alternativ"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showRemoteWorkDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredRemoteWorkOptions.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleRemoteWorkSelect(type)}
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
                  <Label className="text-white font-medium">Arbetsplatsens namn *</Label>
                  <Input
                    value={formData.workplace_name}
                    onChange={(e) => handleInputChange('workplace_name', e.target.value)}
                    placeholder={profile?.company_name ? `t.ex. ${profile.company_name}` : "t.ex. IKEA Kungens Kurva"}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Kontakt e-mail *</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder={user?.email || "kontakt@företag.se"}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Gatuadress (frivilligt)</Label>
                  <Input
                    value={formData.workplace_address}
                    onChange={(e) => handleInputChange('workplace_address', e.target.value)}
                    placeholder="t.ex. Modulvägen 1"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Ansökningsfrågor - EXAKT SAMMA SOM MOBILEJOBWIZARD */}
            {!showQuestionForm && currentStep === 3 && (
              <div className="space-y-6">
                {/* Rubrik för automatiska frågor */}
                <h3 className="text-white text-sm font-medium text-center">
                  Dessa frågor fylls automatiskt från jobbsökarens profil
                </h3>

                {/* Automatiska frågor info */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/20">
                  <div className="text-white text-sm space-y-1">
                    <p>• Namn och efternamn</p>
                    <p>• Ålder</p>
                    <p>• E-post</p>
                    <p>• Telefonnummer</p>
                    <p>• Ort/stad</p>
                    <p>• Presentation</p>
                    <p>• CV</p>
                    <p>• Nuvarande anställningsform</p>
                    <p>• Tillgänglighet</p>
                  </div>
                </div>

                {/* Anpassade frågor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium">Anpassade frågor (valfritt)</h4>
                    <Button
                      onClick={addCustomQuestion}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Lägg till fråga
                    </Button>
                  </div>
                  
                  {customQuestions.length === 0 ? (
                    <div className="text-white text-sm bg-white/5 rounded-lg p-3 border border-white/20">
                      Saknas något? Klicka på "Lägg till fråga" och skapa de frågor du vill att kandidaten ska svara på
                    </div>
                  ) : (
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
                    {templateToEdit ? 'Uppdatera mall' : 'Skapa mall'}
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

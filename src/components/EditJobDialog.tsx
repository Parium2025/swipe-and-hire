import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYMENT_TYPES, normalizeEmploymentType } from '@/lib/employmentTypes';
import { ArrowLeft, ArrowRight, Loader2, X, ChevronDown, Plus, Trash2, GripVertical, Pencil, Minus } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { Progress } from '@/components/ui/progress';
import { searchOccupations } from '@/lib/occupations';
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
import modernMobileBg from '@/assets/modern-mobile-bg.jpg';
import JobPreview from '@/components/JobPreview';

interface JobQuestion {
  id?: string;
  template_id?: string;
  question_text: string;
  question_type: 'text' | 'yes_no' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range' | 'video';
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
  description: string;
  requirements?: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  employment_type?: string;
  positions_count?: number;
  work_schedule?: string;
  contact_email?: string;
  application_instructions?: string;
  occupation?: string;
  salary_type?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  workplace_name?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_city?: string;
  pitch?: string;
  job_image_url?: string;
}

interface JobFormData {
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
  job_image_url: string;
}

interface EditJobDialogProps {
  job: JobPosting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobUpdated: () => void;
}

// Sortable Question Item Component
interface SortableQuestionItemProps {
  question: JobQuestion;
  onEdit: (question: JobQuestion) => void;
  onDelete: (id: string) => void;
}

const SortableQuestionItem = ({ question, onEdit, onDelete }: SortableQuestionItemProps) => {
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
                    question.question_type === 'number' ? 'Siffra' :
                    question.question_type === 'date' ? 'Datum' :
                    question.question_type === 'file' ? 'Fil' :
                    question.question_type === 'range' ? 'Intervall' :
                    question.question_type === 'video' ? 'Video' : question.question_type}
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
            <Pencil className="h-4 w-4" />
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

const EditJobDialog = ({ job, open, onOpenChange, onJobUpdated }: EditJobDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [customQuestions, setCustomQuestions] = useState<JobQuestion[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showQuestionTemplates, setShowQuestionTemplates] = useState(false);
  const [questionTemplates, setQuestionTemplates] = useState<JobQuestion[]>([]);
  const [questionSearchTerm, setQuestionSearchTerm] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<JobQuestion | null>(null);
  
  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [initialFormData, setInitialFormData] = useState<JobFormData | null>(null);
  
  const [occupationSearchTerm, setOccupationSearchTerm] = useState('');
  const [showOccupationDropdown, setShowOccupationDropdown] = useState(false);
  const [employmentTypeSearchTerm, setEmploymentTypeSearchTerm] = useState('');
  const [showEmploymentTypeDropdown, setShowEmploymentTypeDropdown] = useState(false);
  const [salaryTypeSearchTerm, setSalaryTypeSearchTerm] = useState('');
  const [showSalaryTypeDropdown, setShowSalaryTypeDropdown] = useState(false);
  const [workLocationSearchTerm, setWorkLocationSearchTerm] = useState('');
  const [showWorkLocationDropdown, setShowWorkLocationDropdown] = useState(false);
  const [remoteWorkSearchTerm, setRemoteWorkSearchTerm] = useState('');
  const [showRemoteWorkDropdown, setShowRemoteWorkDropdown] = useState(false);
  const [questionTypeSearchTerm, setQuestionTypeSearchTerm] = useState('');
  const [showQuestionTypeDropdown, setShowQuestionTypeDropdown] = useState(false);

  const [formData, setFormData] = useState<JobFormData>({
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
    work_location_type: '',
    remote_work_possible: '',
    workplace_name: '',
    workplace_address: '',
    workplace_postal_code: '',
    workplace_city: '',
    work_schedule: '',
    contact_email: '',
    application_instructions: '',
    pitch: '',
    job_image_url: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Drag and drop sensors
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

  const steps = [
    {
      title: "Grundinfo",
      fields: ['title', 'occupation', 'description', 'employment_type', 'positions_count']
    },
    {
      title: "Var finns jobbet?",
      fields: ['work_location_type', 'remote_work_possible', 'workplace_name', 'workplace_address', 'workplace_postal_code', 'workplace_city']
    },
    {
      title: "Ansökningsfrågor",
      fields: []
    },
    {
      title: "Förhandsvisning",
      fields: ['contact_email', 'requirements']
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

  // Fetch profile
  useEffect(() => {
    if (user && open) {
      fetchProfile();
      fetchQuestionTemplates();
    }
  }, [user, open]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    setProfile(data);
  };

  const fetchQuestionTemplates = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('job_question_templates')
      .select('*')
      .eq('employer_id', user.id)
      .order('usage_count', { ascending: false });
    
    if (!error && data) {
      setQuestionTemplates(data.map(t => ({
        id: t.id,
        question_text: t.question_text,
        question_type: t.question_type as any,
        options: (t.options as string[]) || [],
        is_required: true,
        order_index: 0,
        placeholder_text: t.placeholder_text || undefined
      })));
    }
  };

  // Fetch job questions when dialog opens
  useEffect(() => {
    if (job && open) {
      fetchJobQuestions();
    }
  }, [job, open]);

  const fetchJobQuestions = async () => {
    if (!job) return;
    
    const { data, error } = await supabase
      .from('job_questions')
      .select('*')
      .eq('job_id', job.id)
      .order('order_index');
    
    if (!error && data) {
      setCustomQuestions(data.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type as any,
        options: q.options as string[] || [],
        is_required: q.is_required,
        order_index: q.order_index,
        min_value: q.min_value || undefined,
        max_value: q.max_value || undefined,
        placeholder_text: q.placeholder_text || undefined
      })));
    }
  };

  // Sync incoming job to form
  useEffect(() => {
    if (job && open) {
      const newFormData: JobFormData = {
        title: job.title || '',
        description: job.description || '',
        requirements: job.requirements || '',
        location: job.location || '',
        occupation: job.occupation || '',
        salary_min: job.salary_min?.toString() || '',
        salary_max: job.salary_max?.toString() || '',
        employment_type: normalizeEmploymentType(job.employment_type || ''),
        salary_type: job.salary_type || '',
        positions_count: (job.positions_count ?? 1).toString(),
        work_location_type: job.work_location_type || '',
        remote_work_possible: job.remote_work_possible || '',
        workplace_name: job.workplace_name || '',
        workplace_address: job.workplace_address || '',
        workplace_postal_code: job.workplace_postal_code || '',
        workplace_city: job.workplace_city || '',
        work_schedule: job.work_schedule || '',
        contact_email: job.contact_email || '',
        application_instructions: job.application_instructions || '',
        pitch: job.pitch || '',
        job_image_url: job.job_image_url || ''
      };
      setFormData(newFormData);
      setInitialFormData(newFormData);
      setHasUnsavedChanges(false);
      setCurrentStep(0); // Always start from step 0
    }
  }, [job, open]);

  // Track unsaved changes
  useEffect(() => {
    if (!initialFormData || !open) return;
    
    const changed = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    setHasUnsavedChanges(changed);
  }, [formData, initialFormData, open]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setPendingClose(true);
      setShowUnsavedDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedDialog(false);
    setPendingClose(false);
    setHasUnsavedChanges(false);
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowUnsavedDialog(false);
    setPendingClose(false);
  };

  const handleInputChange = (field: keyof JobFormData, value: string) => {
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

  const filteredOccupations = searchOccupations(occupationSearchTerm);
  const filteredEmploymentTypes = EMPLOYMENT_TYPES.filter(t =>
    t.label.toLowerCase().includes(employmentTypeSearchTerm.toLowerCase())
  );
  const filteredSalaryTypes = salaryTypes.filter(t =>
    t.label.toLowerCase().includes(salaryTypeSearchTerm.toLowerCase())
  );
  const filteredWorkLocationTypes = workLocationTypes.filter(t =>
    t.label.toLowerCase().includes(workLocationSearchTerm.toLowerCase())
  );
  const filteredRemoteWorkOptions = remoteWorkOptions.filter(t =>
    t.label.toLowerCase().includes(remoteWorkSearchTerm.toLowerCase())
  );
  const filteredQuestionTypes = questionTypes.filter(t =>
    t.label.toLowerCase().includes(questionTypeSearchTerm.toLowerCase())
  );

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
    setShowEmploymentTypeDropdown(!showEmploymentTypeDropdown);
    setEmploymentTypeSearchTerm('');
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
    setShowSalaryTypeDropdown(!showSalaryTypeDropdown);
    setSalaryTypeSearchTerm('');
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
    setShowWorkLocationDropdown(!showWorkLocationDropdown);
    setWorkLocationSearchTerm('');
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
    setShowRemoteWorkDropdown(!showRemoteWorkDropdown);
    setRemoteWorkSearchTerm('');
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
    setShowQuestionTypeDropdown(!showQuestionTypeDropdown);
    setQuestionTypeSearchTerm('');
  };

  const handleWorkplacePostalCodeChange = (value: string) => {
    handleInputChange('workplace_postal_code', value);
  };

  const handleWorkplaceLocationChange = (value: string) => {
    handleInputChange('workplace_city', value);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showOccupationDropdown && !(event.target as Element).closest('.occupation-dropdown')) {
        setShowOccupationDropdown(false);
      }
      if (showEmploymentTypeDropdown && !(event.target as Element).closest('.employment-type-dropdown')) {
        setShowEmploymentTypeDropdown(false);
      }
      if (showSalaryTypeDropdown && !(event.target as Element).closest('.salary-type-dropdown')) {
        setShowSalaryTypeDropdown(false);
      }
      if (showWorkLocationDropdown && !(event.target as Element).closest('.work-location-dropdown')) {
        setShowWorkLocationDropdown(false);
      }
      if (showRemoteWorkDropdown && !(event.target as Element).closest('.remote-work-dropdown')) {
        setShowRemoteWorkDropdown(false);
      }
      if (showQuestionTypeDropdown && !(event.target as Element).closest('.question-type-dropdown')) {
        setShowQuestionTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOccupationDropdown, showEmploymentTypeDropdown, showSalaryTypeDropdown, showWorkLocationDropdown, showRemoteWorkDropdown, showQuestionTypeDropdown]);

  // Question management functions
  const addCustomQuestion = () => {
    setShowQuestionTemplates(true);
  };

  const createNewQuestion = () => {
    const newQuestion: JobQuestion = {
      question_text: '',
      question_type: 'text',
      is_required: true,
      order_index: customQuestions.length,
      options: []
    };
    setEditingQuestion(newQuestion);
    setShowQuestionTemplates(false);
    setShowQuestionForm(true);
  };

  const useQuestionTemplate = async (template: any) => {
    const filteredOptions = template.options?.filter((opt: string) => opt.trim() !== '') || [];
    
    const newQuestion: JobQuestion = {
      id: `temp_${Date.now()}`,
      template_id: template.id,
      question_text: template.question_text,
      question_type: template.question_type,
      is_required: true,
      order_index: customQuestions.length,
      options: filteredOptions
    };
    
    setCustomQuestions(prev => [...prev, newQuestion]);
    setShowQuestionTemplates(false);
    
    try {
      await supabase
        .from('job_question_templates')
        .update({ usage_count: template.usage_count + 1 })
        .eq('id', template.id);
    } catch (error) {
      console.error('Error updating template usage:', error);
    }
  };

  const saveCustomQuestion = async () => {
    if (!editingQuestion?.question_text.trim() || !user) return;
    
    const filteredQuestion = {
      ...editingQuestion,
      options: editingQuestion.question_type === 'multiple_choice' 
        ? editingQuestion.options?.filter(opt => opt.trim() !== '')
        : editingQuestion.options
    };
    
    if (filteredQuestion.id) {
      setCustomQuestions(prev => 
        prev.map(q => q.id === filteredQuestion.id ? filteredQuestion : q)
      );
      
      if (filteredQuestion.template_id) {
        try {
          await supabase
            .from('job_question_templates')
            .update({
              question_text: filteredQuestion.question_text,
              question_type: filteredQuestion.question_type,
              options: filteredQuestion.options,
              placeholder_text: filteredQuestion.placeholder_text,
              updated_at: new Date().toISOString()
            })
            .eq('id', filteredQuestion.template_id);
          
          await fetchQuestionTemplates();
        } catch (error) {
          console.error('Error updating question template:', error);
          toast({
            title: "Kunde inte uppdatera mall",
            description: "Frågan är uppdaterad men mallen kunde inte synkroniseras",
            variant: "destructive",
          });
        }
      }
    } else {
      const newQuestion = {
        ...filteredQuestion,
        id: `temp_${Date.now()}`,
        order_index: customQuestions.length
      };
      setCustomQuestions(prev => [...prev, newQuestion]);
      
      try {
        const { data, error } = await supabase
          .from('job_question_templates')
          .insert({
            employer_id: user.id,
            question_text: filteredQuestion.question_text,
            question_type: filteredQuestion.question_type,
            options: filteredQuestion.options,
            placeholder_text: filteredQuestion.placeholder_text
          })
          .select()
          .single();
        
        if (error) throw error;
        
        if (data) {
          setCustomQuestions(prev => 
            prev.map(q => q.id === newQuestion.id ? { ...q, template_id: data.id } : q)
          );
        }
        
        await fetchQuestionTemplates();
      } catch (error) {
        console.error('Error saving question template:', error);
      }
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

  const updateQuestionField = (field: keyof JobQuestion, value: any) => {
    if (!editingQuestion) return;
    
    let updatedQuestion = { ...editingQuestion, [field]: value };
    
    if (field === 'question_type') {
      updatedQuestion = {
        ...updatedQuestion,
        options: value === 'multiple_choice' ? [''] : undefined,
        min_value: ['range', 'number'].includes(value) ? undefined : undefined,
        max_value: ['range', 'number'].includes(value) ? undefined : undefined,
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

  const canProceed = () => {
    const step = steps[currentStep];
    
    if (currentStep === 0) {
      return formData.title.trim() && formData.description.trim();
    }
    
    if (currentStep === 1) {
      return formData.work_location_type && formData.remote_work_possible && 
             formData.workplace_name.trim() && formData.contact_email.trim();
    }
    
    return true;
  };

  const handleNext = () => {
    if (canProceed() && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || !job) return;

    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || null,
        location: formData.location,
        occupation: formData.occupation || null,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        employment_type: formData.employment_type || null,
        salary_type: formData.salary_type || null,
        positions_count: formData.positions_count ? parseInt(formData.positions_count) : 1,
        work_location_type: formData.work_location_type || null,
        remote_work_possible: formData.remote_work_possible || null,
        workplace_name: formData.workplace_name || null,
        workplace_address: formData.workplace_address || null,
        workplace_postal_code: formData.workplace_postal_code || null,
        workplace_city: formData.workplace_city || null,
        work_schedule: formData.work_schedule || null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        pitch: formData.pitch || null,
        job_image_url: formData.job_image_url || null
      };

      const { error } = await supabase
        .from('job_postings')
        .update(payload)
        .eq('id', job.id);

      if (error) {
        toast({ title: 'Fel vid uppdatering', description: error.message, variant: 'destructive' });
        return;
      }

      // Update job questions
      // First, delete all existing questions
      await supabase
        .from('job_questions')
        .delete()
        .eq('job_id', job.id);

      // Then insert new/updated questions
      if (customQuestions.length > 0) {
        const questionsToInsert = customQuestions.map(q => ({
          job_id: job.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || null,
          is_required: q.is_required,
          order_index: q.order_index,
          min_value: q.min_value || null,
          max_value: q.max_value || null,
          placeholder_text: q.placeholder_text || null
        }));

        await supabase
          .from('job_questions')
          .insert(questionsToInsert);
      }

      toast({ title: 'Annons uppdaterad', description: 'Dina ändringar har sparats.' });
      setHasUnsavedChanges(false);
      onOpenChange(false);
      onJobUpdated();
    } catch (err) {
      toast({ title: 'Ett fel uppstod', description: 'Kunde inte uppdatera annonsen.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        } else {
          onOpenChange(isOpen);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-parium-gradient border-none shadow-none p-0">
          <div className="bg-white/10 backdrop-blur-sm border-transparent rounded-lg overflow-hidden h-full flex flex-col">
            <DialogHeader className="p-6 pb-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-white text-2xl">
                  {steps[currentStep].title}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/70">
                  <span>Steg {currentStep + 1} av {steps.length}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {!job ? (
                <div className="py-10 text-center text-white">
                  <p>Laddar annons...</p>
                </div>
              ) : (
                <>
                  {/* Step 1: Grundinfo */}
                  {currentStep === 0 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Jobbtitel *</Label>
                        <Input
                          value={formData.title}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          placeholder="t.ex. Truckförare"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Yrke *</Label>
                        <div className="relative occupation-dropdown">
                          <Input
                            value={occupationSearchTerm || formData.occupation}
                            onChange={(e) => handleOccupationSearch(e.target.value)}
                            placeholder="t.ex. Mjukvaru- och systemutvecklare"
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                          />
                          
                          {showOccupationDropdown && filteredOccupations.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                              {filteredOccupations.slice(0, 10).map((occupation) => (
                                <button
                                  key={occupation}
                                  type="button"
                                  onClick={() => handleOccupationSelect(occupation)}
                                  className="w-full px-3 py-3 text-left hover:bg-gray-700 text-white text-base border-b border-gray-700 last:border-b-0"
                                >
                                  {occupation}
                                </button>
                              ))}
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
                          rows={6}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0 resize-none"
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
                    </div>
                  )}

                  {/* Step 2: Var finns jobbet? */}
                  {currentStep === 1 && (
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

                      <WorkplacePostalCodeSelector
                        postalCodeValue={formData.workplace_postal_code}
                        cityValue={formData.workplace_city}
                        onPostalCodeChange={handleWorkplacePostalCodeChange}
                        onLocationChange={handleWorkplaceLocationChange}
                      />
                    </div>
                  )}

                  {/* Step 3: Ansökningsfrågor */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      {!showQuestionForm && !showQuestionTemplates ? (
                        <>
                          <h3 className="text-white text-sm font-medium text-center">
                            Dessa frågor fylls automatiskt från jobbsökarens profil
                          </h3>

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
                        </>
                      ) : showQuestionTemplates ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-white font-medium text-lg">Välj fråga</h3>
                            <Button
                              onClick={() => {
                                setShowQuestionTemplates(false);
                                setQuestionSearchTerm('');
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-white/70 hover:text-white hover:bg-white/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="relative">
                            <Input
                              value={questionSearchTerm}
                              onChange={(e) => setQuestionSearchTerm(e.target.value)}
                              placeholder="Sök efter fråga..."
                              className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                            />
                          </div>

                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {questionTemplates.filter(template => 
                              template.question_text.toLowerCase().includes(questionSearchTerm.toLowerCase())
                            ).length > 0 ? (
                              <>
                                {questionTemplates
                                  .filter(template => 
                                    template.question_text.toLowerCase().includes(questionSearchTerm.toLowerCase())
                                  )
                                  .map((template) => (
                                  <div
                                    key={template.id}
                                    className="w-full bg-white/5 rounded-lg p-4 border border-white/20 flex items-center justify-between gap-3"
                                  >
                                    <button
                                      onClick={() => useQuestionTemplate(template)}
                                      className="flex-1 text-left hover:opacity-80 transition-opacity"
                                    >
                                      <div className="text-white font-medium text-sm mb-1">
                                        {template.question_text}
                                      </div>
                                      <div className="text-white/95 text-xs">
                                        {template.question_type === 'text' ? 'Text' : 
                                         template.question_type === 'yes_no' ? 'Ja/Nej' :
                                         template.question_type === 'multiple_choice' ? 'Flerval' :
                                         template.question_type === 'number' ? 'Siffra' : template.question_type}
                                      </div>
                                    </button>
                                    <Button
                                      onClick={async () => {
                                        if (!(template as any).id) return;
                                        try {
                                          const { error } = await supabase
                                            .from('job_question_templates')
                                            .delete()
                                            .eq('id', (template as any).id);
                                          
                                          if (error) throw error;
                                          
                                          setQuestionTemplates(prev => prev.filter(t => (t as any).id !== (template as any).id));
                                          toast({
                                            title: "Fråga borttagen"
                                          });
                                        } catch (error) {
                                          console.error('Error deleting template:', error);
                                          toast({
                                            title: "Kunde inte ta bort frågan",
                                            variant: "destructive"
                                          });
                                        }
                                      }}
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 h-8 w-8 p-0 flex-shrink-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <div className="text-white/60 text-sm text-center py-8">
                                Du har inga sparade frågor än
                              </div>
                            )}
                          </div>

                          <div className="pt-2">
                            <Button
                              onClick={createNewQuestion}
                              variant="outline"
                              size="sm"
                              className="w-full border-white/40 text-white bg-transparent hover:bg-transparent hover:border-white/60"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Skapa ny fråga
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-white font-medium text-lg">
                              {editingQuestion?.id?.startsWith('temp_') ? 'Redigera fråga' : 'Ny fråga'}
                            </h3>
                            <Button
                              onClick={() => {
                                setShowQuestionForm(false);
                                setEditingQuestion(null);
                                setShowQuestionTemplates(true);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-white/70 hover:text-white hover:bg-white/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white font-medium">Frågetext *</Label>
                            <Input
                              value={editingQuestion?.question_text || ''}
                              onChange={(e) => updateQuestionField('question_text', e.target.value)}
                              placeholder="t.ex. Har du körkort?"
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white font-medium">Frågetyp *</Label>
                            <div className="relative question-type-dropdown">
                              <Input
                                value={questionTypeSearchTerm || (editingQuestion?.question_type ? questionTypes.find(t => t.value === editingQuestion.question_type)?.label || '' : '')}
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

                          {editingQuestion?.question_type === 'multiple_choice' && (
                            <div className="space-y-2">
                              <Label className="text-white font-medium">Alternativ</Label>
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
                                    className="text-destructive hover:text-destructive/90"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                onClick={addOption}
                                variant="outline"
                                size="sm"
                                className="w-full border-white/40 text-white"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Lägg till alternativ
                              </Button>
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              onClick={() => {
                                setShowQuestionForm(false);
                                setEditingQuestion(null);
                                setShowQuestionTemplates(true);
                              }}
                              variant="outline"
                              className="border-white/40 text-white"
                            >
                              Avbryt
                            </Button>
                            <Button
                              onClick={saveCustomQuestion}
                              className="bg-primary hover:bg-primary/90"
                              disabled={!editingQuestion?.question_text.trim()}
                            >
                              Spara fråga
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Förhandsvisning */}
                  {currentStep === 3 && job && (
                    <div className="space-y-6">
                      <h3 className="text-white text-lg font-medium text-center">
                        Så kommer ansökningsformuläret att se ut på mobil
                      </h3>

                      <div className="flex justify-center">
                        <div 
                          className="relative bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl"
                          style={{
                            width: '375px',
                            height: '667px',
                            border: '14px solid #1f1f1f',
                          }}
                        >
                          <div className="w-full h-full bg-white rounded-[1.75rem] overflow-hidden">
                            <div className="p-4 text-center text-gray-600">
                              <p className="font-semibold mb-2">{profile?.company_name || 'Företag'}</p>
                              <p className="text-lg font-bold mb-1">{formData.title}</p>
                              <p className="text-sm mb-2">{formData.workplace_city || formData.location}</p>
                              <p className="text-xs text-gray-500">{formData.description}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Jobbild (valfritt)</Label>
                        <Input
                          value={formData.job_image_url}
                          onChange={(e) => handleInputChange('job_image_url', e.target.value)}
                          placeholder="URL till jobbild"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex-shrink-0 p-6 pt-0 flex justify-between gap-3">
              <Button
                onClick={handleBack}
                disabled={currentStep === 0}
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  Nästa
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sparar...
                    </>
                  ) : (
                    'Spara ändringar'
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
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

export default EditJobDialog;
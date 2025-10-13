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
import { ArrowLeft, ArrowRight, Loader2, X, ChevronDown, Plus, Trash2, GripVertical, Pencil } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { Progress } from '@/components/ui/progress';
import { searchOccupations } from '@/lib/occupations';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import modernMobileBg from '@/assets/modern-mobile-bg.jpg';
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

// Sortable Question Item Component (samma som i MobileJobWizard)
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Always start from step 0 when opening
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
    }
  }, [open]);

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
    if (currentStep === 0) {
      return formData.title.trim() && formData.occupation.trim() && formData.description.trim() && formData.employment_type;
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
      // Scroll to top
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      // Scroll to top
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
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

      // Update job questions - delete all existing and insert new ones
      await supabase
        .from('job_questions')
        .delete()
        .eq('job_id', job.id);

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

      toast({ title: 'Annons uppdaterad!', description: 'Dina ändringar har sparats.' });
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
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md h-[90vh] max-h-[800px] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden">
          <AnimatedBackground showBubbles={false} />
          <div className="flex flex-col h-full relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/20 flex-shrink-0 rounded-t-[24px] bg-background/10">
              <DialogHeader className="flex-1">
                <DialogTitle className="text-white text-lg">
                  {steps[currentStep].title}
                </DialogTitle>
                <div className="text-sm text-white">
                  Steg {currentStep + 1} av {steps.length}
                </div>
              </DialogHeader>
              {!showQuestionTemplates && !showQuestionForm && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="px-4 py-2 flex-shrink-0">
              <Progress 
                value={progress} 
                className="h-1 bg-white/20 [&>div]:bg-white"
              />
            </div>

            {/* Scrollable Content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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

                      {/* Kravprofil */}
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Kravprofil:</Label>
                        <Textarea
                          value={formData.requirements}
                          onChange={(e) => handleInputChange('requirements', e.target.value)}
                          placeholder="Beskriv vilka krav ni har på kandidaten..."
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
                    </div>
                  )}

                  {/* Step 2: Var finns jobbet? */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Arbetets plats *</Label>
                        <div className="relative work-location-dropdown">
                          <Input
                            value={workLocationSearchTerm || (formData.work_location_type ? workLocationTypes.find(t => t.value === formData.work_location_type)?.label || '' : '')}
                            onChange={(e) => handleWorkLocationSearch(e.target.value)}
                            onClick={handleWorkLocationClick}
                            placeholder="Välj plats"
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
                        <Label className="text-white font-medium">Fjärr-/distansarbete *</Label>
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
                          placeholder="Företagets namn"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Adress</Label>
                        <Input
                          value={formData.workplace_address}
                          onChange={(e) => handleInputChange('workplace_address', e.target.value)}
                          placeholder="Gatuadress"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Postnummer</Label>
                      <WorkplacePostalCodeSelector
                        postalCodeValue={formData.workplace_postal_code}
                        cityValue={formData.workplace_city}
                        onPostalCodeChange={handleWorkplacePostalCodeChange}
                        onLocationChange={handleWorkplaceLocationChange}
                      />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Kontaktmail *</Label>
                        <Input
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => handleInputChange('contact_email', e.target.value)}
                          placeholder="kontakt@foretaget.se"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Ansökningsfrågor */}
                  {currentStep === 2 && (
                    <>
                      {!showQuestionTemplates && !showQuestionForm && (
                        <>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white text-lg font-semibold">Ansökningsfrågor</h3>
                            <Button
                              onClick={addCustomQuestion}
                              variant="outline"
                              className="flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Lägg till fråga
                            </Button>
                          </div>

                          {customQuestions.length === 0 ? (
                            <div className="text-white/70 text-center py-10">
                              Inga frågor tillagda ännu.
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
                                  {customQuestions.map(question => (
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
                        </>
                      )}

                      {showQuestionTemplates && (
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white text-lg font-semibold">Välj mall för fråga</h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowQuestionTemplates(false)}
                              className="text-white/70 hover:text-white hover:bg-white/10"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          </div>

                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {questionTemplates.length === 0 ? (
                              <div className="text-white/70 text-center py-10">
                                Inga mallar tillgängliga.
                              </div>
                            ) : (
                              questionTemplates.map(template => (
                                <div
                                  key={template.id}
                                  className="bg-white/10 rounded-md p-3 cursor-pointer hover:bg-white/20"
                                  onClick={() => useQuestionTemplate(template)}
                                >
                                  <div className="font-medium text-white">{template.question_text}</div>
                                  <div className="text-white/60 text-sm">
                                    Typ: {template.question_type}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowQuestionTemplates(false)}>
                              Avbryt
                            </Button>
                            <Button onClick={createNewQuestion}>Skapa ny fråga</Button>
                          </div>
                        </div>
                      )}

                      {showQuestionForm && editingQuestion && (
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white text-lg font-semibold">
                              {editingQuestion.id ? 'Redigera fråga' : 'Ny fråga'}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setShowQuestionForm(false);
                                setEditingQuestion(null);
                              }}
                              className="text-white/70 hover:text-white hover:bg-white/10"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <Label className="text-white font-medium">Frågetext *</Label>
                              <Input
                                value={editingQuestion.question_text}
                                onChange={(e) => updateQuestionField('question_text', e.target.value)}
                                placeholder="Skriv frågetext"
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                              />
                            </div>

                            <div>
                              <Label className="text-white font-medium">Frågetyp *</Label>
                              <div className="relative question-type-dropdown">
                                <Input
                                  value={questionTypeSearchTerm || questionTypes.find(t => t.value === editingQuestion.question_type)?.label || ''}
                                  onChange={(e) => handleQuestionTypeSearch(e.target.value)}
                                  onClick={handleQuestionTypeClick}
                                  placeholder="Välj frågetyp"
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
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
                              <div>
                                <Label className="text-white font-medium">Alternativ</Label>
                                <div className="space-y-2">
                                  {(editingQuestion.options || []).map((option, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <Input
                                        value={option}
                                        onChange={(e) => updateOption(index, e.target.value)}
                                        placeholder={`Alternativ ${index + 1}`}
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-10 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeOption(index)}
                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 h-8 w-8 p-0"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button variant="outline" onClick={addOption} className="w-full">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Lägg till alternativ
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editingQuestion.is_required}
                                onChange={(e) => updateQuestionField('is_required', e.target.checked)}
                                id="required-checkbox"
                                className="accent-primary"
                              />
                              <Label htmlFor="required-checkbox" className="text-white select-none">
                                Obligatorisk fråga
                              </Label>
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowQuestionForm(false);
                                  setEditingQuestion(null);
                                }}
                              >
                                Avbryt
                              </Button>
                              <Button onClick={saveCustomQuestion}>Spara fråga</Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Step 4: Förhandsvisning */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Kontaktmail *</Label>
                        <Input
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => handleInputChange('contact_email', e.target.value)}
                          placeholder="kontakt@foretaget.se"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Kravprofil</Label>
                        <Textarea
                          value={formData.requirements}
                          onChange={(e) => handleInputChange('requirements', e.target.value)}
                          placeholder="Beskriv vilka krav ni har på kandidaten..."
                          rows={4}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base resize-none leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                        />
                      </div>

                      <div className="bg-white/10 rounded-lg p-4">
                        <h4 className="text-white font-semibold mb-2">Förhandsvisning av annons</h4>
                        <div className="text-white text-sm space-y-1">
                          <div><strong>Titel:</strong> {formData.title}</div>
                          <div><strong>Yrke:</strong> {formData.occupation}</div>
                          <div><strong>Beskrivning:</strong> {formData.description}</div>
                          <div><strong>Anställningsform:</strong> {EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label || ''}</div>
                          <div><strong>Arbetsplats:</strong> {workLocationTypes.find(t => t.value === formData.work_location_type)?.label || ''}</div>
                          <div><strong>Fjärr-/distansarbete:</strong> {remoteWorkOptions.find(t => t.value === formData.remote_work_possible)?.label || ''}</div>
                          <div><strong>Kontaktmail:</strong> {formData.contact_email}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="p-4 border-t border-white/20 flex-shrink-0 flex justify-between gap-3">
              <Button
                onClick={handleBack}
                disabled={currentStep === 0}
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>

              {isLastStep ? (
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
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
                >
                  Nästa
                  <ArrowRight className="h-4 w-4 ml-2" />
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

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
import { ArrowLeft, ArrowRight, Loader2, X, ChevronDown, Plus, Trash2, GripVertical, Search, Pencil, Check, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { Switch } from '@/components/ui/switch';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { getCachedPostalCodeInfo, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
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
  template_id?: string; // Link to template for syncing updates
  question_text: string;
  question_type: 'text' | 'yes_no' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range' | 'video';
  options?: string[];
  is_required: boolean;
  order_index: number;
  min_value?: number;
  max_value?: number;
  placeholder_text?: string;
  usage_count?: number;
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
  salary_transparency: string;
  positions_count: string;
  work_location_type: string;
  remote_work_possible: string;
  workplace_name: string;
  workplace_address: string;
  workplace_postal_code: string;
  workplace_city: string;
  work_schedule: string;
  work_start_time: string;
  work_end_time: string;
  contact_email: string;
  application_instructions: string;
  pitch: string;
  benefits: string[];
}

interface CreateTemplateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateCreated: () => void;
  templateToEdit?: any;
  onBack?: () => void;
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
      className="bg-white/5 rounded-md p-2 border border-white/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="text-white hover:text-white cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium text-sm leading-tight truncate">
              {question.question_text || 'Ingen frågetext'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(question)}
            className="p-1.5 text-white hover:bg-white/10 rounded-full transition-all duration-300"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(question.id!)}
            className="p-1.5 text-white hover:text-red-300 hover:bg-red-500/10 rounded-full transition-all duration-300"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateTemplateWizard = ({ open, onOpenChange, onTemplateCreated, templateToEdit, onBack }: CreateTemplateWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  // isReady controls opacity transition - starts false to prevent flash
  const [isReady, setIsReady] = useState(false);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [customQuestions, setCustomQuestions] = useState<JobQuestion[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showQuestionTemplates, setShowQuestionTemplates] = useState(false);
  const [questionTemplates, setQuestionTemplates] = useState<JobQuestion[]>([]);
  const [questionSearchTerm, setQuestionSearchTerm] = useState('');
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
  const [salaryTransparencySearchTerm, setSalaryTransparencySearchTerm] = useState('');
  const [showSalaryTransparencyDropdown, setShowSalaryTransparencyDropdown] = useState(false);
  const [showBenefitsDropdown, setShowBenefitsDropdown] = useState(false);
  const [customBenefitInput, setCustomBenefitInput] = useState('');
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [initialFormData, setInitialFormData] = useState<TemplateFormData | null>(null);
  const [initialCustomQuestions, setInitialCustomQuestions] = useState<JobQuestion[]>([]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const workEndTimeRef = useRef<HTMLInputElement>(null);
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
    salary_transparency: '',
    positions_count: '1',
    work_location_type: 'på-plats',
    remote_work_possible: 'nej',
    workplace_name: '',
    workplace_address: '',
    workplace_postal_code: '',
    workplace_city: '',
    work_schedule: '',
    work_start_time: '',
    work_end_time: '',
    contact_email: '',
    application_instructions: '',
    pitch: '',
    benefits: []
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
      fetchQuestionTemplates();
    }
  }, [user, open]);

  // Fetch question templates from database
  const fetchQuestionTemplates = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('job_question_templates')
        .select('*')
        .eq('employer_id', user.id)
        .order('question_text', { ascending: true });
      
      if (error) throw error;
      
      const mappedTemplates = (data || []).map(template => ({
        id: template.id,
        question_text: template.question_text,
        question_type: template.question_type as 'text' | 'yes_no' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range' | 'video',
        options: template.options as string[] || [],
        is_required: true,
        order_index: 0,
        placeholder_text: template.placeholder_text || undefined,
        usage_count: template.usage_count
      }));
      
      setQuestionTemplates(mappedTemplates as any);
    } catch (error) {
      console.error('Error fetching question templates:', error);
    }
  };

  // Load template data when editing OR reset when opening fresh
  useEffect(() => {
    // Clear any pending ready timer
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }

    if (templateToEdit && open) {
      // First hide content
      setIsReady(false);
      
      const loadedFormData = {
        name: templateToEdit.name || '',
        title: templateToEdit.title || '',
        occupation: templateToEdit.occupation || '',
        description: templateToEdit.description || '',
        pitch: templateToEdit.pitch || '',
        employment_type: templateToEdit.employment_type || '',
        work_schedule: templateToEdit.work_schedule || '',
        salary_type: templateToEdit.salary_type || '',
        salary_transparency: templateToEdit.salary_transparency || '',
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
        work_start_time: templateToEdit.work_start_time || '',
        work_end_time: templateToEdit.work_end_time || '',
        contact_email: templateToEdit.contact_email || '',
        application_instructions: templateToEdit.application_instructions || '',
        location: '',
        benefits: templateToEdit.benefits || []
      };
      setFormData(loadedFormData);
      setInitialFormData(loadedFormData);
      
      if (templateToEdit.questions && Array.isArray(templateToEdit.questions)) {
        // Ensure each question has a unique ID
        const questionsWithIds = templateToEdit.questions.map((q: JobQuestion, index: number) => ({
          ...q,
          id: q.id || `temp_${Date.now()}_${index}`,
          order_index: index
        }));
        setCustomQuestions(questionsWithIds);
        setInitialCustomQuestions(questionsWithIds);
      } else {
        setCustomQuestions([]);
        setInitialCustomQuestions([]);
      }
      
      setCurrentStep(0);
      setHasUnsavedChanges(false);
      
      // Show content after state is settled
      readyTimerRef.current = setTimeout(() => {
        setIsReady(true);
      }, 50);
    } else if (open && !templateToEdit) {
      // New template - first hide content, then set empty state
      setIsReady(false);
      
      const emptyFormData: TemplateFormData = {
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
        salary_transparency: '',
        positions_count: '1',
        work_location_type: 'på-plats',
        remote_work_possible: 'nej',
        workplace_name: '',
        workplace_address: '',
        workplace_postal_code: '',
        workplace_city: '',
        work_schedule: '',
        work_start_time: '',
        work_end_time: '',
        contact_email: '',
        application_instructions: '',
        pitch: '',
        benefits: []
      };
      setFormData(emptyFormData);
      setInitialFormData(emptyFormData);
      setCustomQuestions([]);
      setInitialCustomQuestions([]);
      setCurrentStep(0);
      setHasUnsavedChanges(false);
      
      // Show content after state is settled
      readyTimerRef.current = setTimeout(() => {
        setIsReady(true);
      }, 50);
    } else if (!open) {
      // Reset when dialog closes
      setIsReady(false);
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
        salary_transparency: '',
        positions_count: '1',
        work_location_type: 'på-plats',
        remote_work_possible: 'nej',
        workplace_name: '',
        workplace_address: '',
        workplace_postal_code: '',
        workplace_city: '',
        work_schedule: '',
        work_start_time: '',
        work_end_time: '',
        contact_email: '',
        application_instructions: '',
        pitch: '',
        benefits: []
      });
      setCustomQuestions([]);
      setCurrentStep(0);
      
      // Nollställ alla search terms
      setEmploymentTypeSearchTerm('');
      setSalaryTypeSearchTerm('');
      setWorkLocationSearchTerm('');
      setRemoteWorkSearchTerm('');
      setOccupationSearchTerm('');
      setQuestionTypeSearchTerm('');
      
      // Stäng alla dropdowns
      setShowEmploymentTypeDropdown(false);
      setShowSalaryTypeDropdown(false);
      setShowWorkLocationDropdown(false);
      setShowRemoteWorkDropdown(false);
      setShowOccupationDropdown(false);
      setShowQuestionTypeDropdown(false);
    }
    
    return () => {
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
      }
    };
  }, [templateToEdit, open]);

  // Track unsaved changes
  useEffect(() => {
    if (!initialFormData || !open) return;
    
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    const questionsChanged = JSON.stringify(customQuestions) !== JSON.stringify(initialCustomQuestions);
    
    setHasUnsavedChanges(formChanged || questionsChanged);
  }, [formData, customQuestions, initialFormData, initialCustomQuestions, open]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is outside all dropdowns
      const isInsideDropdown = 
        target.closest('.employment-type-dropdown') ||
        target.closest('.salary-type-dropdown') ||
        target.closest('.salary-transparency-dropdown') ||
        target.closest('.work-location-dropdown') ||
        target.closest('.remote-work-dropdown') ||
        target.closest('.benefits-dropdown') ||
        target.closest('.occupation-dropdown') ||
        target.closest('.question-type-dropdown');
      
      if (!isInsideDropdown) {
        closeAllDropdowns();
        setShowBenefitsDropdown(false);
        setShowOccupationDropdown(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

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
    },
    {
      title: "Förhandsvisning",
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

  const salaryTransparencyOptions = [
    { value: '0-5000', label: '0 - 5 000 kr' },
    { value: '5000-10000', label: '5 000 - 10 000 kr' },
    { value: '10000-15000', label: '10 000 - 15 000 kr' },
    { value: '15000-20000', label: '15 000 - 20 000 kr' },
    { value: '20000-25000', label: '20 000 - 25 000 kr' },
    { value: '25000-30000', label: '25 000 - 30 000 kr' },
    { value: '30000-40000', label: '30 000 - 40 000 kr' },
    { value: '40000-45000', label: '40 000 - 45 000 kr' },
    { value: '45000-50000', label: '45 000 - 50 000 kr' },
    { value: '50000-55000', label: '50 000 - 55 000 kr' },
    { value: '55000-60000', label: '55 000 - 60 000 kr' },
    { value: '60000-65000', label: '60 000 - 65 000 kr' },
    { value: '65000-70000', label: '65 000 - 70 000 kr' },
    { value: '70000-75000', label: '70 000 - 75 000 kr' },
    { value: '75000-80000', label: '75 000 - 80 000 kr' },
    { value: '80000-85000', label: '80 000 - 85 000 kr' },
    { value: '85000-90000', label: '85 000 - 90 000 kr' },
    { value: '90000-100000', label: '90 000 - 100 000 kr' },
    { value: '100000+', label: '100 000+ kr' }
  ];

  const benefitOptions = [
    { value: 'friskvard', label: 'Friskvårdsbidrag' },
    { value: 'tjanstepension', label: 'Tjänstepension' },
    { value: 'kollektivavtal', label: 'Kollektivavtal' },
    { value: 'flexibla-tider', label: 'Flexibla arbetstider' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'tjanstebil', label: 'Tjänstebil' },
    { value: 'mobiltelefon', label: 'Mobiltelefon' },
    { value: 'utbildning', label: 'Utbildning/kompetensutveckling' },
    { value: 'forsakringar', label: 'Försäkringar' },
    { value: 'extra-semester', label: 'Extra semesterdagar' },
    { value: 'gym', label: 'Gym/träning' },
    { value: 'foraldraledithet', label: 'Föräldraledighetstillägg' },
    { value: 'lunch', label: 'Lunch/mat' },
    { value: 'fri-parkering', label: 'Fri parkering' },
    { value: 'personalrabatter', label: 'Personalrabatter' },
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

  // Helper function to close all dropdowns
  const closeAllDropdowns = () => {
    setShowEmploymentTypeDropdown(false);
    setShowSalaryTypeDropdown(false);
    setShowSalaryTransparencyDropdown(false);
    setShowWorkLocationDropdown(false);
    setShowRemoteWorkDropdown(false);
    setShowQuestionTypeDropdown(false);
  };

  const handleEmploymentTypeClick = () => {
    const isCurrentlyOpen = showEmploymentTypeDropdown;
    closeAllDropdowns();
    setEmploymentTypeSearchTerm('');
    setShowEmploymentTypeDropdown(!isCurrentlyOpen);
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
    const isCurrentlyOpen = showSalaryTypeDropdown;
    closeAllDropdowns();
    setSalaryTypeSearchTerm('');
    setShowSalaryTypeDropdown(!isCurrentlyOpen);
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
    const isCurrentlyOpen = showWorkLocationDropdown;
    closeAllDropdowns();
    setWorkLocationSearchTerm('');
    setShowWorkLocationDropdown(!isCurrentlyOpen);
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
    const isCurrentlyOpen = showRemoteWorkDropdown;
    closeAllDropdowns();
    setRemoteWorkSearchTerm('');
    setShowRemoteWorkDropdown(!isCurrentlyOpen);
  };

  const handleSalaryTransparencySearch = (value: string) => {
    setSalaryTransparencySearchTerm(value);
    setShowSalaryTransparencyDropdown(value.length >= 0);
  };

  const handleSalaryTransparencySelect = (option: { value: string, label: string }) => {
    handleInputChange('salary_transparency', option.value);
    setSalaryTransparencySearchTerm(option.label);
    setShowSalaryTransparencyDropdown(false);
  };

  const handleSalaryTransparencyClick = () => {
    const isCurrentlyOpen = showSalaryTransparencyDropdown;
    closeAllDropdowns();
    setSalaryTransparencySearchTerm('');
    setShowSalaryTransparencyDropdown(!isCurrentlyOpen);
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

  const filteredSalaryTransparencyOptions = salaryTransparencySearchTerm.length > 0
    ? salaryTransparencyOptions.filter(option => 
        option.label.toLowerCase().includes(salaryTransparencySearchTerm.toLowerCase())
      )
    : salaryTransparencyOptions;

  const filteredOccupations = occupationSearchTerm.length > 0 ? searchOccupations(occupationSearchTerm) : [];

  const filteredQuestionTypes = questionTypeSearchTerm.length > 0
    ? questionTypes.filter(type => 
        type.label.toLowerCase().includes(questionTypeSearchTerm.toLowerCase())
      )
    : questionTypes;

  // Close all transient UI elements when navigating between steps
  const closeTransientUI = useCallback(() => {
    setShowEmploymentTypeDropdown(false);
    setShowSalaryTypeDropdown(false);
    setShowWorkLocationDropdown(false);
    setShowRemoteWorkDropdown(false);
    setShowOccupationDropdown(false);
    setShowQuestionTypeDropdown(false);
    setShowQuestionTemplates(false);
  }, []);

  // Auto-close transient UI when step changes
  useEffect(() => {
    closeTransientUI();
  }, [currentStep, closeTransientUI]);

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
             formData.salary_transparency &&
             parseInt(formData.positions_count) > 0;
    }
    if (currentStep === 2) {
      return (
        !!formData.work_location_type &&
        !!formData.remote_work_possible &&
        formData.workplace_name.trim() &&
        formData.contact_email.trim()
      );
    }
    return true;
  };

  const nextStep = () => {
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      closeTransientUI();
      const el = document.activeElement as HTMLElement | null;
      if (el?.blur) el.blur();
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
      closeTransientUI();
      const el = document.activeElement as HTMLElement | null;
      if (el?.blur) el.blur();
      setCurrentStep(currentStep - 1);
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
      }, 0);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
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
      salary_transparency: '',
      positions_count: '1',
      work_location_type: 'på-plats',
      remote_work_possible: 'nej',
      workplace_name: '',
      workplace_address: '',
      workplace_postal_code: '',
      workplace_city: '',
      work_schedule: '',
      work_start_time: '',
      work_end_time: '',
      contact_email: '',
      application_instructions: '',
      pitch: '',
      benefits: []
    });
    setCustomQuestions([]);
    setHasUnsavedChanges(false);
    setShowUnsavedDialog(false);
    if (onBack) {
      onBack();
    } else {
      onOpenChange(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !validateCurrentStep()) return;

    setLoading(true);

    try {
      // Hämta län och kommun från postnummer
      let workplaceCounty = null;
      let workplaceMunicipality = null;
      if (formData.workplace_postal_code && isValidSwedishPostalCode(formData.workplace_postal_code)) {
        const postalInfo = await getCachedPostalCodeInfo(formData.workplace_postal_code);
        if (postalInfo) {
          workplaceCounty = postalInfo.county || null;
          workplaceMunicipality = postalInfo.municipality || null;
        }
      }
      
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
        workplace_county: workplaceCounty,
        workplace_municipality: workplaceMunicipality,
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

      resetAndClose();
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
    // Show template list first
    setEditingQuestion(null);
    setShowQuestionForm(false);
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
    // Filter out empty options before adding
    const filteredOptions = template.options?.filter((opt: string) => opt.trim() !== '') || [];
    
    // Add template to questions with link to template
    const newQuestion: JobQuestion = {
      id: `temp_${Date.now()}`,
      template_id: template.id, // Save template ID for syncing
      question_text: template.question_text,
      question_type: template.question_type,
      is_required: true,
      order_index: customQuestions.length,
      options: filteredOptions
    };
    
    setCustomQuestions(prev => [...prev, newQuestion]);
    setShowQuestionTemplates(false);
    
    // Increment usage count
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
      // Update existing question
      setCustomQuestions(prev => 
        prev.map(q => q.id === filteredQuestion.id ? filteredQuestion : q)
      );
      
      // If question is linked to a template, update the template too
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
          
          // Refresh templates to show updated version
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
      // Add new question
      const newQuestion = {
        ...filteredQuestion,
        id: `temp_${Date.now()}`,
        order_index: customQuestions.length
      };
      setCustomQuestions(prev => [...prev, newQuestion]);
      
      // Save as template for future use
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
        
        // Link the new question to its template
        if (data) {
          setCustomQuestions(prev => 
            prev.map(q => q.id === newQuestion.id ? { ...q, template_id: data.id } : q)
          );
        }
        
        // Refresh templates
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
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}>
      <DialogContent 
        forceMount
        className="parium-panel max-w-md h-auto max-h-[90vh] md:max-h-[800px] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200"
        style={{ display: (!open || !isReady) ? 'none' : undefined }}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AnimatedBackground showBubbles={false} variant="card" />
        {/* Content container */}
        <div className="flex flex-col max-h-[90vh] relative z-10 overflow-hidden">
          {/* Header */}
          <div className="relative flex items-center justify-center p-4 border-b border-white/20 flex-shrink-0 bg-background/10">
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-white text-lg">
                {showQuestionForm ? 'Lägg till fråga' : (templateToEdit ? 'Redigera mall' : steps[currentStep].title)}
              </DialogTitle>
              {!showQuestionForm && (
                <div className="text-sm text-white">
                  Steg {currentStep + 1} av {steps.length}
                </div>
              )}
            </DialogHeader>
            {!showQuestionForm && !showQuestionTemplates && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="absolute right-4 top-4 h-8 w-8 text-white/70 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {showQuestionForm && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowQuestionForm(false);
                  setEditingQuestion(null);
                }}
                className="absolute right-4 top-4 h-8 w-8 text-white/70 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
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
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1.5">
            
            {/* Question Form */}
            {showQuestionForm && editingQuestion && (
              <div className="space-y-1.5">
                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Frågetyp *</Label>
                  <div className="relative question-type-dropdown">
                    <Input
                      value={questionTypeSearchTerm || questionTypes.find(t => t.value === editingQuestion.question_type)?.label || ''}
                      onChange={(e) => handleQuestionTypeSearch(e.target.value)}
                      onClick={handleQuestionTypeClick}
                      placeholder="Välj frågetyp"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showQuestionTypeDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredQuestionTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleQuestionTypeSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors"
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
                    <Label className="text-white font-medium text-sm">Rubrik *</Label>
                    <Input
                      value={editingQuestion.question_text}
                      onChange={(e) => updateQuestionField('question_text', e.target.value)}
                      placeholder="T.ex. Beskriv dina erfarenheter inom..."
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                    />
                  </div>
                )}

                {editingQuestion.question_type === 'yes_no' && (
                  <div className="space-y-2">
                    <Label className="text-white font-medium text-sm">Rubrik *</Label>
                    <Input
                      value={editingQuestion.question_text}
                      onChange={(e) => updateQuestionField('question_text', e.target.value)}
                      placeholder="T.ex. Har du körkort?, Kan du arbeta helger?..."
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                    />
                  </div>
                )}

                {editingQuestion.question_type === 'number' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-white font-medium text-sm">Rubrik *</Label>
                      <Input
                        value={editingQuestion.question_text}
                        onChange={(e) => updateQuestionField('question_text', e.target.value)}
                        placeholder="T.ex. Ålder, Antal års erfarenhet..."
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium text-sm">Min värde</Label>
                        <Input
                          type="number"
                          value={editingQuestion.min_value ?? ''}
                          onChange={(e) => updateQuestionField('min_value', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="0"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white font-medium text-sm">Max värde</Label>
                        <Input
                          type="number"
                          value={editingQuestion.max_value ?? ''}
                          onChange={(e) => updateQuestionField('max_value', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="100"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                        />
                      </div>
                    </div>
                  </>
                )}

                {editingQuestion.question_type === 'multiple_choice' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-white font-medium text-sm">Rubrik *</Label>
                      <Input
                        value={editingQuestion.question_text}
                        onChange={(e) => updateQuestionField('question_text', e.target.value)}
                        placeholder="T.ex. Vilka behörigheter har du?"
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white font-medium text-sm">Svarsalternativ</Label>
                      <div className="space-y-2">
                        {(editingQuestion.options || []).map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(index, e.target.value)}
                              placeholder={`Alternativ ${index + 1}`}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(index)}
                              className="p-1.5 text-white hover:text-red-300 hover:bg-red-500/10 rounded-full transition-all duration-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addOption}
                          className="bg-white/10 border border-white/20 text-white hover:border-white/40 px-3 py-2 rounded-md text-sm flex items-center gap-1 transition-all duration-300"
                        >
                          Lägg till alternativ
                          <Plus className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center space-x-3">
                  <Switch
                    checked={editingQuestion.is_required || false}
                    onCheckedChange={(checked) => updateQuestionField('is_required', checked)}
                  />
                  <Label className="text-white font-medium text-sm">Obligatorisk fråga</Label>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={saveCustomQuestion}
                    disabled={!editingQuestion.question_text?.trim()}
                    className="bg-primary hover:bg-primary/90 text-white touch-border-white-thick"
                  >
                    Spara fråga
                  </Button>
                </div>
              </div>
            )}

            {/* Step 0: Mallnamn */}
            {!showQuestionForm && currentStep === 0 && (
              <div className="space-y-1.5 max-w-2xl mx-auto w-full">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Mallnamn *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="t.ex. Standard Lagerarbetare"
                    className="bg-white/10 border-white/20 hover:border-white/50 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                  />
                </div>
              </div>
            )}

            {/* Step 1: Grundinfo - EXAKT SAMMA SOM MOBILEJOBWIZARD */}
            {!showQuestionForm && currentStep === 1 && (
              <div className="space-y-1.5 max-w-2xl mx-auto w-full">
                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Jobbtitel *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="t.ex. Lagerarbetare"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Yrke *</Label>
                  <div className="relative occupation-dropdown">
                    <Input
                      value={formData.occupation}
                      onChange={(e) => handleOccupationSearch(e.target.value)}
                      onFocus={() => setShowOccupationDropdown(occupationSearchTerm.length > 0)}
                      placeholder="t.ex. Mjukvaru- och systemutvecklare"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 focus:border-white/40"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                    
                    {showOccupationDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                        {filteredOccupations.map((occupation, index) => (
                          <button
                            key={`${occupation}-${index}`}
                            type="button"
                            onClick={() => handleOccupationSelect(occupation)}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium">{occupation}</div>
                          </button>
                        ))}
                        
                        {occupationSearchTerm.trim().length >= 2 &&
                         filteredOccupations.length === 0 && (
                          <button
                            type="button"
                            onClick={() => handleOccupationSelect(occupationSearchTerm)}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-t border-white/10 transition-colors"
                          >
                            <span className="font-medium">Använd "{occupationSearchTerm}"</span>
                          </button>
                        )}
                        
                        {occupationSearchTerm.trim().length > 0 && occupationSearchTerm.trim().length < 2 && (
                          <div className="py-3 px-3 text-center text-white not-italic text-sm">
                            Skriv minst 2 bokstäver för att söka
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Jobbeskrivning *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..."
                    rows={3}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 p-2 text-sm resize-none leading-tight focus:border-white/40 min-h-[80px] sm:min-h-[200px]"
                  />
                </div>

                {/* Förmåner / Benefits */}
                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Förmåner som erbjuds</Label>
                  <div className="relative benefits-dropdown">
                    <div
                      onClick={() => setShowBenefitsDropdown(!showBenefitsDropdown)}
                      className="flex items-center justify-between bg-white/10 border border-white/20 rounded-md px-3 py-2 h-11 cursor-pointer hover:border-white/40 transition-colors"
                    >
                      <span className="text-sm text-white">
                        {formData.benefits.length > 0 
                          ? `${formData.benefits.length} förmån${formData.benefits.length > 1 ? 'er' : ''} valda`
                          : 'Välj förmåner'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-white/60" />
                    </div>
                    
                    {showBenefitsDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {benefitOptions.map((benefit) => (
                          <button
                            key={benefit.value}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (formData.benefits.includes(benefit.value)) {
                                setFormData(prev => ({ ...prev, benefits: prev.benefits.filter(b => b !== benefit.value) }));
                              } else {
                                setFormData(prev => ({ ...prev, benefits: [...prev.benefits, benefit.value] }));
                              }
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 flex items-center gap-2"
                          >
                            <div className={`w-4 h-4 rounded border ${formData.benefits.includes(benefit.value) ? 'bg-white border-white' : 'border-white/30 bg-white/10'} flex items-center justify-center`}>
                              {formData.benefits.includes(benefit.value) && (
                                <Check className="w-3 h-3 text-primary" />
                              )}
                            </div>
                            <span>{benefit.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Valda förmåner som badges */}
                  {formData.benefits.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.benefits.map((benefitValue) => {
                        const benefit = benefitOptions.find(b => b.value === benefitValue);
                        const label = benefit ? benefit.label : benefitValue;
                        return (
                          <span
                            key={benefitValue}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-white text-xs rounded-full border border-primary/30"
                          >
                            {label}
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, benefits: prev.benefits.filter(b => b !== benefitValue) }))}
                              className="hover:text-white/60"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Övrigt / Custom benefit */}
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={customBenefitInput}
                      onChange={(e) => setCustomBenefitInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customBenefitInput.trim()) {
                          e.preventDefault();
                          setFormData(prev => ({ ...prev, benefits: [...prev.benefits, customBenefitInput.trim()] }));
                          setCustomBenefitInput('');
                        }
                      }}
                      placeholder="Lägg till egen förmån"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white h-11 text-sm focus:border-white/40 flex-1"
                    />
                    <div
                      onClick={() => {
                        if (customBenefitInput.trim()) {
                          setFormData(prev => ({ ...prev, benefits: [...prev.benefits, customBenefitInput.trim()] }));
                          setCustomBenefitInput('');
                        }
                      }}
                      className="bg-white/10 border border-white/20 text-white/60 hover:border-white/40 h-11 w-11 flex items-center justify-center rounded-md cursor-pointer transition-all duration-300"
                    >
                      <Plus className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Anställningsform *</Label>
                  <div className="relative employment-type-dropdown">
                    <Input
                      value={employmentTypeSearchTerm || (formData.employment_type ? EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label || '' : '')}
                      onChange={(e) => handleEmploymentTypeSearch(e.target.value)}
                      onClick={handleEmploymentTypeClick}
                      placeholder="Välj anställningsform"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showEmploymentTypeDropdown && (
                       <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 shadow-lg">
                        {filteredEmploymentTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleEmploymentTypeSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Lönetyp *</Label>
                  <div className="relative salary-type-dropdown">
                    <Input
                      value={salaryTypeSearchTerm || (formData.salary_type ? salaryTypes.find(t => t.value === formData.salary_type)?.label || '' : '')}
                      onChange={(e) => handleSalaryTypeSearch(e.target.value)}
                      onClick={handleSalaryTypeClick}
                      placeholder="Välj lönetyp"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showSalaryTypeDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredSalaryTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleSalaryTypeSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Lönetransparens (EU 2026) *</Label>
                  <div className="relative salary-transparency-dropdown">
                    <Input
                      value={salaryTransparencySearchTerm || (formData.salary_transparency ? salaryTransparencyOptions.find(t => t.value === formData.salary_transparency)?.label || '' : '')}
                      onChange={(e) => handleSalaryTransparencySearch(e.target.value)}
                      onClick={handleSalaryTransparencyClick}
                      placeholder="Välj lönespann"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showSalaryTransparencyDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredSalaryTransparencyOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSalaryTransparencySelect(option)}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium">{option.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Antal personer att rekrytera *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.positions_count}
                    onChange={(e) => handleInputChange('positions_count', e.target.value)}
                    placeholder="1"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                  />
                </div>

              </div>
            )}

            {/* Step 2: Var finns jobbet - EXAKT SAMMA SOM MOBILEJOBWIZARD */}
            {!showQuestionForm && currentStep === 2 && (
              <div className="space-y-1.5 max-w-2xl mx-auto w-full">
                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Var utförs arbetet? *</Label>
                  <div className="relative work-location-dropdown">
                    <Input
                      value={workLocationSearchTerm || (formData.work_location_type ? workLocationTypes.find(t => t.value === formData.work_location_type)?.label || '' : '')}
                      onChange={(e) => handleWorkLocationSearch(e.target.value)}
                      onClick={handleWorkLocationClick}
                      placeholder="Välj arbetsplats"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showWorkLocationDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredWorkLocationTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleWorkLocationSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Är distansarbete möjligt? *</Label>
                  <div className="relative remote-work-dropdown">
                    <Input
                      value={remoteWorkSearchTerm || (formData.remote_work_possible ? remoteWorkOptions.find(t => t.value === formData.remote_work_possible)?.label || '' : '')}
                      onChange={(e) => handleRemoteWorkSearch(e.target.value)}
                      onClick={handleRemoteWorkClick}
                      placeholder="Välj alternativ"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {showRemoteWorkDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredRemoteWorkOptions.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleRemoteWorkSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Arbetsplatsens namn *</Label>
                  <Input
                    value={formData.workplace_name}
                    onChange={(e) => handleInputChange('workplace_name', e.target.value)}
                    placeholder={profile?.company_name ? `t.ex. ${profile.company_name}` : "t.ex. IKEA Kungens Kurva"}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Kontakt e-mail *</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder={user?.email || "kontakt@företag.se"}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Gatuadress (frivilligt)</Label>
                  <Input
                    value={formData.workplace_address}
                    onChange={(e) => handleInputChange('workplace_address', e.target.value)}
                    placeholder="t.ex. Modulvägen 1"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Ansökningsfrågor - EXAKT SAMMA SOM MOBILEJOBWIZARD */}
            {!showQuestionForm && currentStep === 3 && (
              <div className="space-y-6 max-w-2xl mx-auto w-full">
                {!showQuestionTemplates ? (
                  <>
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
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-white font-medium">Anpassade frågor (valfritt)</h4>
                        <Button
                          onClick={addCustomQuestion}
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-white touch-border-white px-6 font-medium"
                        >
                          Lägg till fråga
                          <Plus className="h-4 w-4 ml-1 text-[hsl(var(--pure-white))]" />
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
                            <div className="space-y-2">
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
                ) : (
                  /* Template Selection */
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
                        className="text-white/70 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
                      >
                        <X className="h-4 w-4 text-[hsl(var(--pure-white))]" />
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

                    <div className="flex justify-center">
                      <Button
                        onClick={createNewQuestion}
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-white touch-border-white px-6 font-medium"
                      >
                        Skapa ny fråga
                        <Plus className="h-4 w-4 ml-1 text-[hsl(var(--pure-white))]" />
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {(() => {
                        const filteredTemplates = questionTemplates.filter(template => 
                          template.question_text.toLowerCase().includes(questionSearchTerm.toLowerCase())
                        );

                        if (filteredTemplates.length === 0) {
                          return (
                            <div className="text-white text-sm text-center py-8">
                              Du har inga sparade frågor.
                            </div>
                          );
                        }

                        const groupedQuestions = {
                          yes_no: filteredTemplates.filter(t => t.question_type === 'yes_no'),
                          text: filteredTemplates.filter(t => t.question_type === 'text'),
                          number: filteredTemplates.filter(t => t.question_type === 'number'),
                          multiple_choice: filteredTemplates.filter(t => t.question_type === 'multiple_choice'),
                        };

                        const typeLabels = {
                          yes_no: 'Ja/Nej',
                          text: 'Text',
                          number: 'Siffra',
                          multiple_choice: 'Flerval'
                        };

                        return (
                          <>
                            {Object.entries(groupedQuestions).map(([type, templates]) => {
                              if (templates.length === 0) return null;
                              
                              return (
                                <div key={type} className="space-y-2">
                                  <h4 className="text-white text-sm font-semibold px-1 pt-2">
                                    {typeLabels[type as keyof typeof typeLabels]}
                                  </h4>
                                  {templates.map((template) => (
                                    <div
                                      key={template.id}
                                      className="w-full bg-white/5 rounded-md p-2 border border-white/20 flex items-center justify-between gap-2"
                                    >
                                      <button
                                        onClick={() => useQuestionTemplate(template)}
                                        className="flex-1 text-left hover:opacity-80 transition-opacity min-w-0"
                                      >
                                        <div className="text-white font-medium text-sm leading-tight truncate">
                                          {template.question_text}
                                        </div>
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            // Edit template - open it in edit mode
                                            setEditingQuestion({
                                              ...template,
                                              template_id: template.id
                                            });
                                            setShowQuestionTemplates(false);
                                            setShowQuestionForm(true);
                                          }}
                                          className="p-1.5 text-white hover:bg-white/10 rounded-full transition-all duration-300 flex-shrink-0"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!template.id) return;
                                            try {
                                              const { error } = await supabase
                                                .from('job_question_templates')
                                                .delete()
                                                .eq('id', template.id);
                                              
                                              if (error) throw error;
                                              
                                              setQuestionTemplates(prev => prev.filter(t => t.id !== template.id));
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
                                          className="p-1.5 text-white hover:text-red-300 hover:bg-red-500/10 rounded-full transition-all duration-300 flex-shrink-0"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Förhandsvisning */}
            {!showQuestionForm && currentStep === 4 && (
              <div className="space-y-6 max-w-2xl mx-auto w-full">
                <h3 className="text-white font-medium text-center">Mallöversikt</h3>
                
                <div className="bg-white/5 rounded-lg p-6 border border-white/20 space-y-4">
                  <div>
                    <p className="text-white text-sm mb-1">Mallnamn</p>
                    <p className="text-white font-medium">{formData.name || '-'}</p>
                  </div>
                  <div className="border-t border-white/30" />
                  
                  <div>
                    <p className="text-white text-sm mb-1">Jobbtitel</p>
                    <p className="text-white font-medium">{formData.title || '-'}</p>
                  </div>
                  <div className="border-t border-white/30" />
                  
                  <div>
                    <p className="text-white text-sm mb-1">Yrke</p>
                    <p className="text-white font-medium">{formData.occupation || '-'}</p>
                  </div>
                  <div className="border-t border-white/30" />
                  
                  <div>
                    <p className="text-white text-sm mb-1">Anställningstyp</p>
                    <p className="text-white">{EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label || '-'}</p>
                  </div>
                  <div className="border-t border-white/30" />
                  
                  <div>
                    <p className="text-white text-sm mb-1">Lönetyp</p>
                    <p className="text-white">{salaryTypes.find(t => t.value === formData.salary_type)?.label || '-'}</p>
                  </div>
                  <div className="border-t border-white/30" />
                  
                  <div>
                    <p className="text-white text-sm mb-1">Lönetransparens</p>
                    <p className="text-white">{salaryTransparencyOptions.find(t => t.value === formData.salary_transparency)?.label || '-'}</p>
                  </div>
                  <div className="border-t border-white/30" />
                  
                  <div>
                    <p className="text-white text-sm mb-1">Antal att rekrytera</p>
                    <p className="text-white">{formData.positions_count || '-'}</p>
                  </div>
                  <div className="border-t border-white/30" />
                  
                  {formData.benefits && formData.benefits.length > 0 && (
                    <>
                      <div>
                        <p className="text-white text-sm mb-1">Förmåner</p>
                        <p className="text-white">{formData.benefits.join(', ')}</p>
                      </div>
                      <div className="border-t border-white/30" />
                    </>
                  )}
                  
                  <div>
                    <p className="text-white text-sm mb-1">Beskrivning</p>
                    <p className="text-white">{formData.description || '-'}</p>
                  </div>
                  <div className="border-t border-white/30" />
                  
                  <div>
                    <p className="text-white text-sm mb-1">Arbetsplats</p>
                    <p className="text-white">{formData.workplace_name || '-'}</p>
                  </div>
                  
                  {formData.workplace_address && (
                    <>
                      <div className="border-t border-white/30" />
                      <div>
                        <p className="text-white text-sm mb-1">Gatuadress</p>
                        <p className="text-white">{formData.workplace_address}</p>
                      </div>
                    </>
                  )}
                  
                  <div className="border-t border-white/30" />
                  <div>
                    <p className="text-white text-sm mb-1">Anpassade frågor</p>
                    <p className="text-white">{customQuestions.length}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation - exakt samma styling som MobileJobWizard */}
          {!showQuestionForm && (
            <div className={`flex items-center p-4 border-t border-white/20 flex-shrink-0 ${currentStep === 0 ? 'justify-center' : 'justify-between'}`}>
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={prevStep}
                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 transition-all duration-300 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Tillbaka
                </Button>
              )}

              {isLastStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !validateCurrentStep()}
                  className="bg-green-600/80 hover:bg-green-600 md:hover:bg-green-600 text-white px-8 py-2 transition-all duration-300"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sparar...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {templateToEdit ? 'Uppdatera mall' : 'Skapa mall'}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!validateCurrentStep()}
                  className="bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 touch-border-white transition-all duration-300 focus:outline-none"
                >
                  Nästa
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>
      
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={resetAndClose}
        onCancel={() => setShowUnsavedDialog(false)}
      />
    </>
  );
};

export default CreateTemplateWizard;

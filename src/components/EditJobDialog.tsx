import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYMENT_TYPES, normalizeEmploymentType, getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { ArrowLeft, ArrowRight, Loader2, X, ChevronDown, Plus, Trash2, GripVertical, Pencil, Briefcase, MapPin, Mail, Banknote, Users, FileText, Video, Bookmark, Heart, Building2 } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { searchOccupations } from '@/lib/occupations';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import FileUpload from '@/components/FileUpload';
import ImageEditor from '@/components/ImageEditor';
import { createSignedUrl } from '@/utils/storageUtils';
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
      className="bg-white/5 rounded-md p-2 border border-white/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div
            {...attributes}
            {...listeners}
            className="text-white/40 hover:text-white/70 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium text-xs leading-tight truncate">
              {question.question_text || 'Ingen frågetext'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-1.5 flex-shrink-0">
          <Button
            onClick={() => onEdit(question)}
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-6 w-6 p-0"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            onClick={() => onDelete(question.id!)}
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
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
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);
  const [showCompanyTooltip, setShowCompanyTooltip] = useState(false);
  const [isScrolledTop, setIsScrolledTop] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [jobImageDisplayUrl, setJobImageDisplayUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [manualFocus, setManualFocus] = useState<number | null>(null);
  
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
  const occupationRef = useRef<HTMLDivElement>(null);

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

  // Helper functions
  const formatCity = (value?: string) => {
    if (!value) return '';
    return value
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const getWorkLocationDisplayText = () => {
    const locationType = workLocationTypes.find(t => t.value === formData.work_location_type);
    
    let displayText = locationType?.label || 'På plats';
    
    if (formData.remote_work_possible === 'ja') {
      displayText += ', distans helt möjligt';
    } else if (formData.remote_work_possible === 'delvis') {
      displayText += ', delvis distans';
    }
    
    const capitalizedText = displayText.charAt(0).toUpperCase() + displayText.slice(1).toLowerCase();
    
    return `(${capitalizedText})`;
  };

  const formatSalaryInfo = () => {
    const parts = [];
    
    if (formData.salary_min || formData.salary_max) {
      if (formData.salary_min && formData.salary_max) {
        parts.push(`${parseInt(formData.salary_min).toLocaleString()} - ${parseInt(formData.salary_max).toLocaleString()} kr/mån`);
      } else if (formData.salary_min) {
        parts.push(`Från ${parseInt(formData.salary_min).toLocaleString()} kr/mån`);
      } else if (formData.salary_max) {
        parts.push(`Upp till ${parseInt(formData.salary_max).toLocaleString()} kr/mån`);
      }
    }
    
    if (formData.salary_type) {
      const salaryType = salaryTypes.find(t => t.value === formData.salary_type);
      if (salaryType) {
        parts.push(salaryType.label);
      }
    }
    
    return parts;
  };

  const formatPositionsCount = () => {
    const count = parseInt(formData.positions_count) || 1;
    if (count === 1) {
      return '1 person';
    } else {
      return `${count} personer`;
    }
  };

  const getEmailTextSize = (email: string) => {
    if (!email) return 'text-xs';
    
    const length = email.length;
    if (length <= 15) return 'text-xs';
    if (length <= 25) return 'text-[10px]';
    if (length <= 35) return 'text-[9px]';
    return 'text-[8px]';
  };

  const getDisplayTitle = () => {
    return formData.title || 'Jobbtitel';
  };

  const formatCityWithMainCity = (city: string) => {
    if (!city) return '';
    return formatCity(city);
  };

  const getMetaLine = (employment?: string, city?: string) => {
    const emp = getEmploymentTypeLabel(employment);
    const c = formatCityWithMainCity(city || '');
    return [emp, c].filter(Boolean).join(' • ');
  };

  const getSmartTextSizes = () => {
    const companyName = profile?.company_name || 'Företag';
    const jobTitle = getDisplayTitle();
    const metaLine = getMetaLine(formData.employment_type, formData.workplace_city || formData.location);

    const companyLength = companyName.length;
    const titleLength = jobTitle.length;
    const metaLength = metaLine.length;

    let companySizeClass = 'text-xs';
    let titleSizeClass = 'text-lg';
    let metaSizeClass = 'text-sm';

    if (titleLength > 50) {
      titleSizeClass = 'text-base';
      companySizeClass = 'text-xs';
      metaSizeClass = 'text-xs';
    } else if (titleLength > 30) {
      titleSizeClass = 'text-lg';
      companySizeClass = 'text-xs';
      metaSizeClass = 'text-sm';
    } else if (titleLength < 20) {
      titleSizeClass = 'text-xl';
      companySizeClass = 'text-sm';
      metaSizeClass = 'text-base';
    }

    if (companyLength > 15) {
      companySizeClass = 'text-xs';
    } else if (companyLength < 8) {
      companySizeClass = 'text-sm';
    }

    if (metaLength > 20) {
      metaSizeClass = 'text-xs';
    } else if (metaLength < 10) {
      metaSizeClass = 'text-sm';
    }

    return {
      company: companySizeClass,
      title: titleSizeClass,
      meta: metaSizeClass
    };
  };

  const openImageEditor = async () => {
    try {
      const source = originalImageUrl || formData.job_image_url || jobImageDisplayUrl;
      if (!source) return;

      let urlToEdit = source;
      if (!source.startsWith('http')) {
        const signed = await createSignedUrl('job-applications', source, 86400);
        if (signed) urlToEdit = signed;
      }
      setEditingImageUrl(urlToEdit);
      setShowImageEditor(true);
    } catch (e) {
      console.error('Failed to open editor', e);
    }
  };

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

  // Load job image if exists - create signed URL for storage paths
  useEffect(() => {
    const loadJobImage = async () => {
      if (job?.job_image_url && open) {
        const url = job.job_image_url;
        
        // If it's a storage path (not a full URL), create a signed URL
        if (!url.startsWith('http')) {
          try {
            const signedUrl = await createSignedUrl('job-applications', url, 86400);
            if (signedUrl) {
              setJobImageDisplayUrl(signedUrl);
              setOriginalImageUrl(url); // Keep storage path as original
              return;
            }
          } catch (error) {
            console.error('Failed to create signed URL for job image:', error);
          }
        }
        
        // If it's already a full URL or signing failed, use as-is
        setJobImageDisplayUrl(url);
        setOriginalImageUrl(url);
      } else {
        setJobImageDisplayUrl(null);
        setOriginalImageUrl(null);
      }
    };
    
    loadJobImage();
  }, [job, open]);

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
      
      // Set search terms for dropdowns to show correct labels
      setOccupationSearchTerm(job.occupation || '');
      setEmploymentTypeSearchTerm(job.employment_type ? EMPLOYMENT_TYPES.find(t => t.value === normalizeEmploymentType(job.employment_type))?.label || '' : '');
      setSalaryTypeSearchTerm(job.salary_type ? salaryTypes.find(t => t.value === job.salary_type)?.label || '' : '');
      setWorkLocationSearchTerm(job.work_location_type ? workLocationTypes.find(t => t.value === job.work_location_type)?.label || '' : '');
      setRemoteWorkSearchTerm(job.remote_work_possible ? remoteWorkOptions.find(t => t.value === job.remote_work_possible)?.label || '' : '');
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
      return formData.title.trim() && 
             formData.occupation.trim() && 
             formData.description.trim() && 
             formData.employment_type &&
             formData.salary_type &&
             parseInt(formData.positions_count) > 0;
    }
    
    if (currentStep === 1) {
      return formData.work_location_type && 
             formData.remote_work_possible && 
             formData.workplace_name.trim() && 
             formData.contact_email.trim() &&
             formData.workplace_postal_code.trim() && 
             formData.workplace_city.trim();
    }
    
    return true;
  };

  const handleNext = () => {
    if (canProceed() && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  };

  const handleSubmit = async () => {
    if (!user || !job || loading) return;

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
      console.error('Edit job error:', err);
      toast({ title: 'Ett fel uppstod', description: 'Kunde inte uppdatera annonsen.', variant: 'destructive' });
    } finally {
      // Ensure loading is reset even if error occurs
      setTimeout(() => setLoading(false), 100);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-w-md h-[90vh] max-h-[800px] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <AnimatedBackground showBubbles={false} />
          <div className="flex flex-col h-full relative z-10">
            {/* Header */}
            <div className="relative flex items-center justify-center p-4 border-b border-white/20 flex-shrink-0 rounded-t-[24px] bg-background/10">
              <DialogHeader className="text-center sm:text-center">
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
                  className="absolute right-4 top-4 h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
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
                    <div className="space-y-4 max-w-2xl mx-auto w-full">
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

{/* Kravprofil borttagen för att matcha MobileJobWizard */}

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
                    <div className="space-y-4 max-w-2xl mx-auto w-full">
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
                    <div className="space-y-6 max-w-2xl mx-auto w-full">
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

                          <Button
                            onClick={createNewQuestion}
                            variant="outline"
                            size="sm"
                            className="w-full border-white/40 text-white bg-transparent hover:bg-transparent hover:border-white/60"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Skapa ny fråga
                          </Button>

                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {(() => {
                              const filteredTemplates = questionTemplates.filter(template => 
                                template.question_text.toLowerCase().includes(questionSearchTerm.toLowerCase())
                              );

                              if (filteredTemplates.length === 0) {
                                return (
                                  <div className="text-white/60 text-sm text-center py-8">
                                    Du har inga sparade frågor än
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
                                              <div className="text-white font-medium text-xs leading-tight truncate">
                                                {template.question_text}
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
                                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 h-6 w-6 p-0 flex-shrink-0"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
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

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-white font-medium">Frågetyp *</Label>
                              <div className="relative question-type-dropdown">
                                <Input
                                  value={questionTypeSearchTerm || (editingQuestion?.question_type ? questionTypes.find(t => t.value === editingQuestion.question_type)?.label || '' : '')}
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

                            {editingQuestion?.question_type === 'text' && (
                              <div className="space-y-2">
                                <Label className="text-white font-medium">Rubrik *</Label>
                                <Input
                                  value={editingQuestion?.question_text || ''}
                                  onChange={(e) => updateQuestionField('question_text', e.target.value)}
                                  placeholder="T.ex. Beskriv dina erfarenheter inom..."
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                />
                              </div>
                            )}

                            {editingQuestion?.question_type === 'yes_no' && (
                              <div className="space-y-2">
                                <Label className="text-white font-medium">Rubrik *</Label>
                                <Input
                                  value={editingQuestion?.question_text || ''}
                                  onChange={(e) => updateQuestionField('question_text', e.target.value)}
                                  placeholder="T.ex. Har du körkort?, Kan du arbeta helger?..."
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                />
                              </div>
                            )}

                            {editingQuestion?.question_type === 'number' && (
                              <>
                                <div className="space-y-2">
                                  <Label className="text-white font-medium">Rubrik *</Label>
                                  <Input
                                    value={editingQuestion?.question_text || ''}
                                    onChange={(e) => updateQuestionField('question_text', e.target.value)}
                                    placeholder="T.ex. Ålder, Antal års erfarenhet, Antal anställda..."
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                  />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-white font-medium">Min värde</Label>
                                    <Input
                                      type="number"
                                      value={editingQuestion?.min_value ?? ''}
                                      onChange={(e) => updateQuestionField('min_value', e.target.value ? parseInt(e.target.value) : undefined)}
                                      placeholder="0"
                                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-white font-medium">Max värde</Label>
                                    <Input
                                      type="number"
                                      value={editingQuestion?.max_value ?? ''}
                                      onChange={(e) => updateQuestionField('max_value', e.target.value ? parseInt(e.target.value) : undefined)}
                                      placeholder="100"
                                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {editingQuestion?.question_type === 'multiple_choice' && (
                              <div className="space-y-2">
                                <Label className="text-white font-medium">Rubrik *</Label>
                                <Input
                                  value={editingQuestion?.question_text || ''}
                                  onChange={(e) => updateQuestionField('question_text', e.target.value)}
                                  placeholder="T.ex. Vilka behörigheter har du?"
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                />
                              </div>
                            )}

                            {editingQuestion?.question_type === 'multiple_choice' && (
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
                            )}

                            <div className="flex items-center space-x-3">
                              <Switch
                                checked={editingQuestion?.is_required || false}
                                onCheckedChange={(checked) => updateQuestionField('is_required', checked)}
                              />
                              <Label className="text-white font-medium">Obligatorisk fråga</Label>
                            </div>

                            <div className="flex justify-end pt-4">
                              <Button
                                onClick={saveCustomQuestion}
                                disabled={!editingQuestion?.question_text?.trim()}
                                className="bg-primary hover:bg-primary/90 text-white"
                              >
                                Spara fråga
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Förhandsvisning */}
                  {currentStep === 3 && (
                    <div className="space-y-6 max-w-2xl mx-auto w-full">
                      <div className="flex flex-col items-center space-y-4">
                        <h3 className="text-white font-medium">Så kommer ansökningsformuläret att se ut på mobil. (Testa att trycka på mobilens skärm)</h3>
                        
                        <div className="relative flex items-center justify-center gap-4">
                          <section aria-label="Mobilansökningsformulär förhandsvisning" className="relative w-[160px] h-[320px]">
                            {showCompanyTooltip && showApplicationForm && isScrolledTop && (
                              <div className="pointer-events-none absolute z-[999] top-8 -left-28 flex items-center gap-1">
                                <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                                  Obs, tryck här!
                                </div>
                                <svg width="20" height="12" viewBox="0 0 48 28" className="text-white">
                                  <path d="M2 14 Q 24 0, 46 14" stroke="currentColor" strokeWidth="2" fill="none" markerEnd="url(#arrowheadRight)" />
                                  <defs>
                                    <marker id="arrowheadRight" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                                      <polygon points="0 0, 6 3, 0 6" fill="currentColor" />
                                    </marker>
                                  </defs>
                                </svg>
                              </div>
                            )}
                            
                            <div className="relative w-full h-full rounded-[2rem] bg-black p-1 shadow-xl">
                              <div className="relative w-full h-full rounded-[1.6rem] overflow-hidden bg-black">
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 h-1 w-8 rounded-full bg-black border border-gray-800"></div>

                                <div className="absolute inset-0 rounded-[1.6rem] overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}>
                                  <div className="h-1 bg-black relative z-10"></div>
                                  
                                  <div className={showApplicationForm ? 'flex flex-col h-full' : 'hidden'}>
                                    <div className="flex items-center justify-between px-2 py-1.5 bg-black/20 border-b border-white/20 relative z-10 flex-shrink-0 rounded-t-[1.6rem]">
                                      <div className="text-xs font-bold text-white">Ansökningsformulär</div>
                                      <button onClick={() => setShowApplicationForm(false)} className="text-xs text-white/80 hover:text-white" aria-label="Stäng ansökningsformulär">✕</button>
                                    </div>

                                    <div 
                                      className="px-2 py-2 overflow-y-auto relative z-10 custom-scrollbar flex-1"
                                      onScroll={(e) => {
                                        const target = e.currentTarget;
                                        setIsScrolledTop(target.scrollTop === 0);
                                      }}
                                    >
                                      <div className="space-y-3 pb-3">
                                        <div className="bg-white/10 rounded-lg p-2 border border-white/20 relative">
                                          <div className="flex items-center">
                                            {profile?.company_logo_url ? (
                                              <div className="w-4 h-4 rounded-full mr-1 overflow-hidden bg-white/10 flex items-center justify-center">
                                                <img 
                                                  src={profile.company_logo_url} 
                                                  alt="Företagslogotyp" 
                                                  className="w-full h-full object-contain"
                                                />
                                              </div>
                                            ) : (
                                              <div className="w-4 h-4 bg-primary/20 rounded-full mr-1 flex items-center justify-center">
                                                <Building2 className="h-2 w-2 text-primary-foreground" />
                                              </div>
                                            )}
                                            <button 
                                              onClick={() => setShowCompanyProfile(true)}
                                              className="text-xs font-bold text-white hover:text-primary transition-colors cursor-pointer"
                                            >
                                              {profile?.company_name || 'Företagsnamn'}
                                            </button>
                                          </div>
                                        </div>

                                        {formData.occupation && (
                                          <div className="bg-white/10 rounded-lg p-2 border border-white/20 mb-2">
                                            <h5 className="text-xs font-medium text-white mb-1 flex items-center">
                                              <Briefcase className="h-2 w-2 mr-1 text-white" />
                                              Yrke
                                            </h5>
                                            <div className="text-white">
                                              <div 
                                                ref={occupationRef}
                                                className="text-xs leading-relaxed break-words inline-block pr-2 overflow-visible"
                                              >
                                                {formData.occupation}
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {formData.description && (
                                          <div className="bg-white/10 rounded-lg p-2 border border-white/20 mb-2">
                                            <h5 className="text-xs font-medium text-white mb-1">Jobbeskrivning</h5>
                                            <div className="text-xs text-white leading-relaxed whitespace-pre-wrap break-words [&>*]:mb-1 [&>*:last-child]:mb-0">
                                              {formData.description.split('\n').map((line, index) => {
                                                const trimmedLine = line.trim();
                                                const bulletMatch = trimmedLine.match(/^([•\-\*]|\d+[\.\)])\s*(.*)$/);
                                                
                                                if (bulletMatch) {
                                                  const [, bullet, text] = bulletMatch;
                                                  return (
                                                    <div key={index} className="flex">
                                                      <span className="flex-shrink-0 mr-1">{bullet}</span>
                                                      <span className="flex-1 break-words">{text}</span>
                                                    </div>
                                                  );
                                                }
                                                
                                                return trimmedLine ? (
                                                  <div key={index}>{trimmedLine}</div>
                                                ) : (
                                                  <div key={index} className="h-3"></div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}

                                        {(formData.salary_min || formData.salary_max || formData.salary_type) && (
                                          <div className="bg-white/10 rounded-lg p-2 border border-white/20 mb-2">
                                            <h5 className="text-xs font-medium text-white mb-1 flex items-center">
                                              <Banknote className="h-2 w-2 mr-1 text-white" />
                                              Lön
                                            </h5>
                                            <div className="text-xs text-white leading-relaxed break-words space-y-0.5">
                                              {formatSalaryInfo().map((info, index) => (
                                                <div key={index} className="font-medium">{info}</div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                          <h5 className="text-xs font-medium text-white mb-1 flex items-center">
                                            <MapPin className="h-2 w-2 mr-1 text-white" />
                                            Arbetsplats
                                          </h5>
                                          <div className="text-xs text-white leading-relaxed break-words space-y-0.5">
                                            {formData.workplace_name && (
                                              <div className="font-medium">{formData.workplace_name}</div>
                                            )}
                                            {formData.workplace_address && (
                                              <div>{formData.workplace_address}</div>
                                            )}
                                            {(formData.workplace_postal_code || formData.workplace_city) && (
                                              <div>
                                                {formData.workplace_postal_code && formData.workplace_city ? (
                                                  <div>{formData.workplace_postal_code} {formData.workplace_city}</div>
                                                ) : formData.workplace_city ? (
                                                  <div>{formData.workplace_city}</div>
                                                ) : (
                                                  <div>{formData.workplace_postal_code}</div>
                                                )}
                                                <div>{getWorkLocationDisplayText()}</div>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {formData.positions_count && parseInt(formData.positions_count) > 0 && (
                                          <div className="bg-white/10 rounded-lg p-2 border border-white/20 mb-2">
                                            <h5 className="text-xs font-medium text-white mb-1 flex items-center whitespace-nowrap">
                                              <Users className="h-2 w-2 mr-1 text-white" />
                                              Antal rekryteringar
                                            </h5>
                                            <div className="text-xs text-white leading-relaxed break-words">
                                              <div className="font-medium">{formatPositionsCount()}</div>
                                            </div>
                                          </div>
                                        )}

                                        <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                          <h5 className="text-xs font-medium text-white mb-1 flex items-center">
                                            <Mail className="h-2 w-2 mr-1 text-white" />
                                            Kontakt
                                          </h5>
                                          <div className="text-xs text-white leading-relaxed break-words">
                                            {formData.contact_email && (
                                              <a 
                                                href={`mailto:${formData.contact_email}`}
                                                className={`text-blue-300 font-medium break-all hover:text-blue-200 underline cursor-pointer ${getEmailTextSize(formData.contact_email)}`}
                                              >
                                                {formData.contact_email}
                                              </a>
                                            )}
                                          </div>
                                        </div>

                                        {formData.requirements && (
                                          <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                            <h4 className="text-xs font-semibold text-white mb-1">Kvalifikationer</h4>
                                            <p className="text-xs text-white leading-relaxed">
                                              {formData.requirements.length > 100 
                                                ? formData.requirements.substring(0, 100) + '...' 
                                                : formData.requirements
                                              }
                                            </p>
                                          </div>
                                        )}

                                        <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                          <p className="text-xs text-white mb-3 leading-relaxed">
                                            Följande information samlas automatiskt in från alla kandidater som har sökt:
                                          </p>
                                          
                                          <div className="space-y-1.5">
                                            {[
                                              'Namn',
                                              'Efternamn',
                                              'Ålder',
                                              'E-post',
                                              'Telefonnummer',
                                              'Ort/stad',
                                              'Presentation',
                                              'CV',
                                              'Nuvarande anställningsform',
                                              'Tillgänglighet',
                                            ].map((label, idx) => (
                                              <div key={idx} className="text-xs flex">
                                                <span className="flex-shrink-0 mr-1 text-white">•</span>
                                                <span className="flex-1 text-white leading-tight break-words">{label}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Anpassade frågor - individuella kort */}
                                        {customQuestions.length > 0 && (
                                          <div className="space-y-1.5">
                                            {customQuestions.map((question, index) => {
                                              const typeLabels = {
                                                number: 'Siffra',
                                                text: 'Text',
                                                multiple_choice: 'Flerval',
                                                yes_no: 'Ja/Nej',
                                                date: 'Datum',
                                                file: 'Fil',
                                                video: 'Video',
                                              };

                                              return (
                                                <div key={question.id || index} className="bg-white/10 rounded-lg p-3 border border-white/20">
                                                  {/* Frågetext */}
                                                  <div className="mb-2">
                                                    <label className="text-xs font-medium text-white block leading-tight">
                                                      {question.question_text}
                                                    </label>
                                                  </div>
                                                  
                                                  {/* Input förhandsvisning baserat på frågetyp */}
                                                  {question.question_type === 'text' && (
                                                    <textarea
                                                      className="w-full border border-white/20 bg-white/10 rounded p-2 text-xs text-white placeholder:text-white/60 resize-none"
                                                      placeholder={question.placeholder_text || 'Skriv ditt svar...'}
                                                      rows={2}
                                                    />
                                                  )}
                                                  
                                                  {question.question_type === 'yes_no' && (
                                                    <div className="flex gap-1.5">
                                                      <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          const parent = e.currentTarget.parentElement;
                                                          const buttons = parent?.querySelectorAll('button');
                                                          buttons?.forEach(btn => {
                                                            btn.classList.remove('bg-secondary', 'border-secondary', 'text-white');
                                                            btn.classList.add('bg-white/10', 'border-white/20');
                                                          });
                                                          e.currentTarget.classList.remove('bg-white/10', 'border-white/20');
                                                          e.currentTarget.classList.add('bg-secondary', 'border-secondary', 'text-white');
                                                        }}
                                                        className="flex-1 bg-white/10 border border-white/20 rounded-md px-2 py-1 text-xs text-white transition-colors font-medium"
                                                      >
                                                        Ja
                                                      </button>
                                                      <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          const parent = e.currentTarget.parentElement;
                                                          const buttons = parent?.querySelectorAll('button');
                                                          buttons?.forEach(btn => {
                                                            btn.classList.remove('bg-secondary', 'border-secondary', 'text-white');
                                                            btn.classList.add('bg-white/10', 'border-white/20');
                                                          });
                                                          e.currentTarget.classList.remove('bg-white/10', 'border-white/20');
                                                          e.currentTarget.classList.add('bg-secondary', 'border-secondary', 'text-white');
                                                        }}
                                                        className="flex-1 bg-white/10 border border-white/20 rounded-md px-2 py-1 text-xs text-white transition-colors font-medium"
                                                      >
                                                        Nej
                                                      </button>
                                                    </div>
                                                  )}
                                                  
                                                  {question.question_type === 'multiple_choice' && (
                                                    <div className="space-y-1.5">
                                                      {(question.options || []).map((option: string, optionIndex: number) => (
                                                        <button
                                                          key={optionIndex}
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.preventDefault();
                                                            const parent = e.currentTarget.parentElement;
                                                            const buttons = parent?.querySelectorAll('button');
                                                            buttons?.forEach(btn => {
                                                              btn.classList.remove('bg-secondary', 'border-secondary');
                                                              btn.classList.add('bg-white/10', 'border-white/20');
                                                            });
                                                            e.currentTarget.classList.remove('bg-white/10', 'border-white/20');
                                                            e.currentTarget.classList.add('bg-secondary', 'border-secondary');
                                                          }}
                                                          className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-xs text-white text-left hover:bg-white/20 transition-colors"
                                                        >
                                                          {option}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  )}
                                                  
                                                  {question.question_type === 'number' && (
                                                    <div className="space-y-1.5">
                                                      <div className="text-center text-sm font-semibold text-white">
                                                        {question.min_value ?? 0}
                                                      </div>
                                                      <input
                                                        type="range"
                                                        min={question.min_value ?? 0}
                                                        max={question.max_value ?? 100}
                                                        defaultValue={question.min_value ?? 0}
                                                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-secondary"
                                                      />
                                                    </div>
                                                  )}
                                                  
                                                  {question.question_type === 'date' && (
                                                    <input
                                                      type="date"
                                                      className="w-full border border-white/20 bg-white/10 rounded p-2 text-xs text-white placeholder:text-white/60 h-9"
                                                      disabled
                                                    />
                                                  )}
                                                  
                                                  {(question.question_type === 'file' || question.question_type === 'video') && (
                                                    <div className="border-2 border-dashed border-white/30 rounded p-2 text-center bg-white/5">
                                                      {question.question_type === 'file' ? (
                                                        <FileText className="h-3 w-3 mx-auto mb-0.5 text-white/60" />
                                                      ) : (
                                                        <Video className="h-3 w-3 mx-auto mb-0.5 text-white/60" />
                                                      )}
                                                      <p className="text-xs text-white/60">
                                                        {question.question_type === 'file' ? 'Välj fil' : 'Spela in video'}
                                                      </p>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {!showApplicationForm && (
                                  <div className="absolute inset-0 z-10">
                                    {jobImageDisplayUrl ? (
                                      <img
                                        src={jobImageDisplayUrl}
                                        alt={`Jobbbild för ${formData.title}`}
                                        className="absolute inset-0 w-full h-full object-cover select-none"
                                        loading="eager"
                                        decoding="async"
                                      />
                                    ) : null}
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                    <div 
                                      className="absolute inset-0 flex flex-col justify-start items-center pt-10 p-3 text-white text-center cursor-pointer"
                                      onClick={() => setShowApplicationForm(true)}
                                    >
                                      {(() => {
                                        const textSizes = getSmartTextSizes();
                                        return (
                                          <>
                                            <button 
                                              onClick={() => setShowCompanyProfile(true)}
                                              className={`${textSizes.company} text-white font-medium mb-1 hover:text-primary transition-colors cursor-pointer text-left`}
                                            >
                                              {profile?.company_name || 'Företag'}
                                            </button>
                                            <h3 className={`${textSizes.title} text-white font-bold leading-tight mb-1`}>{getDisplayTitle()}</h3>
                                            <div className={`${textSizes.meta} text-white`}>
                                              {getMetaLine(formData.employment_type, formData.workplace_city || formData.location)}
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                    <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 pointer-events-none">
                                      <button aria-label="Nej tack" className="w-6 h-6 rounded-full bg-red-500 shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors pointer-events-auto">
                                        <X className="h-3 w-3 text-white" />
                                      </button>
                                      <button aria-label="Spara" className="w-6 h-6 rounded-full bg-blue-500 shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors pointer-events-auto">
                                        <Bookmark className="h-3 w-3 text-white" />
                                      </button>
                                      <button onClick={() => setShowApplicationForm(true)} aria-label="Ansök" className="w-6 h-6 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors pointer-events-auto">
                                        <Heart className="h-3 w-3 text-white fill-white" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </section>
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-lg p-4 border border-white/20">
                        <div className="text-white font-medium mb-3">Jobbild (valfritt)</div>
                        <p className="text-white text-sm mb-4">
                          Ladda upp en bild som representerar jobbet eller arbetsplatsen
                        </p>
                        
                        {!jobImageDisplayUrl && (
                          <FileUpload
                            onFileUploaded={async (storagePath, fileName) => {
                              handleInputChange('job_image_url', storagePath);
                              setOriginalImageUrl(storagePath);
                              
                              // Create signed URL for display
                              try {
                                const signedUrl = await createSignedUrl('job-applications', storagePath, 86400);
                                if (signedUrl) {
                                  setJobImageDisplayUrl(signedUrl);
                                }
                              } catch (error) {
                                console.error('Failed to create signed URL:', error);
                                setJobImageDisplayUrl(storagePath);
                              }
                            }}
                            acceptedFileTypes={['image/*']}
                            maxFileSize={5 * 1024 * 1024}
                          />
                        )}
                        
                        {jobImageDisplayUrl && (
                          <>
                            <div className="mt-3 relative">
                              <img 
                                src={jobImageDisplayUrl} 
                                alt="Job preview" 
                                className="w-full h-48 object-contain rounded-lg"
                              />
                              <button
                                onClick={() => {
                                  handleInputChange('job_image_url', '');
                                  setOriginalImageUrl(null);
                                  setJobImageDisplayUrl(null);
                                  setManualFocus(null);
                                }}
                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="mt-4 space-y-3">
                              <Button
                                onClick={openImageEditor}
                                className="w-full bg-transparent border border-white/40 text-white hover:bg-white/10"
                              >
                                Redigera bild
                              </Button>
                            </div>
                          </>
                        )}
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
                className="bg-transparent border border-white/40 text-white hover:bg-white/10 disabled:opacity-50 disabled:border-white/20"
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

      {showCompanyProfile && profile && (
        <CompanyProfileDialog 
          open={showCompanyProfile}
          onOpenChange={setShowCompanyProfile}
          companyId={profile?.user_id || ''}
        />
      )}
    </>
  );
};

export default EditJobDialog;
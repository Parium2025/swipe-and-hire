import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// ... keep existing imports
import modernMobileBg from '@/assets/modern-mobile-bg.jpg';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { TruncatedText } from '@/components/TruncatedText';
import { motion, AnimatePresence } from 'framer-motion';
import FileUpload from '@/components/FileUpload';
import JobPreview from '@/components/JobPreview';
import { useToast } from '@/hooks/use-toast';
import { categorizeJob } from '@/lib/jobCategorization';
import { EMPLOYMENT_TYPES, getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { filterCities, swedishCities } from '@/lib/swedishCities';
import { searchOccupations } from '@/lib/occupations';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, X, ChevronDown, MapPin, Building, Building2, Briefcase, Heart, Bookmark, Plus, Minus, Trash2, Clock, Banknote, FileText, CheckSquare, List, Video, Mail, Users, ArrowDown, Pencil, Smartphone, Monitor, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getCachedPostalCodeInfo, formatPostalCodeInput, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { CompanyProfileDialog } from '@/components/CompanyProfileDialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import ImageEditor from '@/components/ImageEditor';
import { createSignedUrl } from '@/utils/storageUtils';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';

import useSmartTextFit from '@/hooks/useSmartTextFit';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Import shared wizard components and types
import { SortableQuestionItem } from '@/components/wizard/SortableQuestionItem';
import { 
  JobQuestion, 
  JobFormData,
  JobTemplate,
  createEmptyJobFormData,
  createEmptyQuestion,
} from '@/types/jobWizard';

interface ExistingJob {
  id: string;
  title: string;
  description?: string | null;
  requirements?: string | null;
  location?: string | null;
  occupation?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  employment_type?: string | null;
  salary_type?: string | null;
  salary_transparency?: string | null;
  benefits?: string[] | null;
  positions_count?: number | null;
  work_location_type?: string | null;
  remote_work_possible?: string | null;
  workplace_name?: string | null;
  workplace_address?: string | null;
  workplace_postal_code?: string | null;
  workplace_city?: string | null;
  workplace_county?: string | null;
  workplace_municipality?: string | null;
  work_schedule?: string | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
  contact_email?: string | null;
  application_instructions?: string | null;
  pitch?: string | null;
  job_image_url?: string | null;
  is_active?: boolean;
  
}

interface MobileJobWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  selectedTemplate: JobTemplate | null;
  onJobCreated: (job: any) => void;
  onBack?: () => void;
  existingJob?: ExistingJob | null;
}

// Session storage key for persisting unsaved job form state across tab switches
const JOB_WIZARD_SESSION_KEY = 'job-wizard-unsaved-state';

const MobileJobWizard = ({
  open, 
  onOpenChange, 
  jobTitle, 
  selectedTemplate, 
  onJobCreated,
  onBack,
  existingJob
}: MobileJobWizardProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  
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
  
  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setIsInitializing(true);
    }
  }, [open]);
  
  // Start from step 0 when opening
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setIsInitializing(false);
      
      // Clear sessionStorage to prevent false unsaved changes detection
      sessionStorage.removeItem(JOB_WIZARD_SESSION_KEY);
      
      // Reset form state for fresh load
      setInitialFormData(null);
      setInitialCustomQuestions([]);
      setHasUnsavedChanges(false);
      
      // Load existing job data if editing a draft
      if (existingJob) {
        const loadedFormData: JobFormData = {
          title: existingJob.title || '',
          description: existingJob.description || '',
          requirements: existingJob.requirements || '',
          occupation: existingJob.occupation || '',
          salary_min: existingJob.salary_min?.toString() || '',
          salary_max: existingJob.salary_max?.toString() || '',
          salary_type: existingJob.salary_type || '',
          salary_transparency: existingJob.salary_transparency || '',
          benefits: existingJob.benefits || [],
          positions_count: existingJob.positions_count?.toString() || '1',
          work_location_type: existingJob.work_location_type || 'på-plats',
          remote_work_possible: existingJob.remote_work_possible || 'nej',
          workplace_name: existingJob.workplace_name || '',
          workplace_address: existingJob.workplace_address || '',
          workplace_postal_code: existingJob.workplace_postal_code || '',
          workplace_city: existingJob.workplace_city || '',
          workplace_county: existingJob.workplace_county || '',
          workplace_municipality: existingJob.workplace_municipality || '',
          employment_type: existingJob.employment_type || '',
          work_schedule: existingJob.work_schedule || '',
          work_start_time: existingJob.work_start_time || '',
          work_end_time: existingJob.work_end_time || '',
          contact_email: existingJob.contact_email || '',
          application_instructions: existingJob.application_instructions || '',
          pitch: existingJob.pitch || '',
          job_image_url: existingJob.job_image_url || '',
          job_image_desktop_url: (existingJob as any).job_image_desktop_url || '',
          location: existingJob.location || '',
        };
        setFormData(loadedFormData);
        
        // Load existing questions for this job and set both states together
        const loadExistingQuestions = async () => {
          const { data: questions } = await supabase
            .from('job_questions')
            .select('*')
            .eq('job_id', existingJob.id)
            .order('order_index');
          
          const loadedQuestions = questions && questions.length > 0 
            ? questions.map(q => ({
                id: q.id,
                question_text: q.question_text,
                question_type: q.question_type as JobQuestion['question_type'],
                options: q.options || [],
                is_required: q.is_required ?? true,
                order_index: q.order_index,
                placeholder_text: q.placeholder_text || '',
                min_value: q.min_value ?? undefined,
                max_value: q.max_value ?? undefined,
              }))
            : [];
          
          // Set BOTH customQuestions AND initialCustomQuestions to same value
          setCustomQuestions(loadedQuestions);
          setInitialCustomQuestions(loadedQuestions);
          // Set initialFormData AFTER questions are loaded to avoid race condition
          setInitialFormData(loadedFormData);
          setHasUnsavedChanges(false);
        };
        loadExistingQuestions();
      } else if (selectedTemplate) {
        // Force reload template data when opening
        const templateFormData: JobFormData = {
          title: jobTitle,
          description: selectedTemplate.description || '',
          requirements: selectedTemplate.requirements || '',
          occupation: selectedTemplate.occupation || '',
          salary_min: selectedTemplate.salary_min?.toString() || '',
          salary_max: selectedTemplate.salary_max?.toString() || '',
          salary_type: selectedTemplate.salary_type || '',
          salary_transparency: selectedTemplate.salary_transparency || '',
          benefits: selectedTemplate.benefits || [],
          employment_type: selectedTemplate.employment_type || '',
          work_location_type: selectedTemplate.work_location_type || 'på-plats',
          remote_work_possible: selectedTemplate.remote_work_possible || 'nej',
          workplace_name: selectedTemplate.workplace_name || '',
          workplace_address: selectedTemplate.workplace_address || '',
          workplace_postal_code: selectedTemplate.workplace_postal_code || '',
          workplace_city: selectedTemplate.workplace_city || '',
          workplace_county: (selectedTemplate as any).workplace_county || '',
          workplace_municipality: (selectedTemplate as any).workplace_municipality || '',
          positions_count: selectedTemplate.positions_count || '',
          work_schedule: selectedTemplate.work_schedule || '',
          contact_email: selectedTemplate.contact_email || '',
          application_instructions: selectedTemplate.application_instructions || '',
          pitch: selectedTemplate.pitch || '',
          location: selectedTemplate.location || '',
          job_image_url: '',
          job_image_desktop_url: '',
          work_start_time: '',
          work_end_time: '',
        };
        setFormData(templateFormData);
        
        // Load template questions if available
        let templateQuestions: JobQuestion[] = [];
        if (selectedTemplate.questions && Array.isArray(selectedTemplate.questions)) {
          templateQuestions = selectedTemplate.questions.map((q: any, index: number) => ({
            id: q.id || `template-q-${index}`,
            question_text: q.question_text || '',
            question_type: q.question_type || 'text',
            options: q.options || [],
            is_required: q.is_required !== false,
            order_index: q.order_index ?? index,
            placeholder_text: q.placeholder_text || '',
            min_value: q.min_value,
            max_value: q.max_value,
          }));
        }
        setCustomQuestions(templateQuestions);
        // Set BOTH initial states to same values
        setInitialFormData(templateFormData);
        setInitialCustomQuestions(templateQuestions);
        setHasUnsavedChanges(false);
      } else {
        // No template - reset to empty form
        const emptyFormData: JobFormData = {
          title: jobTitle,
          description: '',
          requirements: '',
          occupation: '',
          salary_min: '',
          salary_max: '',
          salary_type: '',
          salary_transparency: '',
          benefits: [],
          employment_type: '',
          work_location_type: 'på-plats',
          remote_work_possible: 'nej',
          workplace_name: '',
          workplace_address: '',
          workplace_postal_code: '',
          workplace_city: '',
          workplace_county: '',
          workplace_municipality: '',
          positions_count: '1',
          work_schedule: '',
          contact_email: '',
          application_instructions: '',
          pitch: '',
          location: '',
          job_image_url: '',
          job_image_desktop_url: '',
          work_start_time: '',
          work_end_time: '',
        };
        setFormData(emptyFormData);
        setCustomQuestions([]);
        // Set BOTH initial states to same values
        setInitialFormData(emptyFormData);
        setInitialCustomQuestions([]);
        setHasUnsavedChanges(false);
      }
    }
  }, [open, selectedTemplate, jobTitle, existingJob]);
  
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
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [initialFormData, setInitialFormData] = useState<JobFormData | null>(null);
  const [initialCustomQuestions, setInitialCustomQuestions] = useState<JobQuestion[]>([]);
  
  
  // Company profile dialog
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);
  const [showCompanyTooltip, setShowCompanyTooltip] = useState(false);
  const [isScrolledTop, setIsScrolledTop] = useState(true);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [showDesktopApplicationForm, setShowDesktopApplicationForm] = useState(false);

  // Utility function to truncate text for better display
  const truncateText = (text: string, maxLength: number = 35) => {
    if (!text) return text;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };


  // Smart text sizing for mobile preview based on content length and visual impact
  const getSmartTextStyle = (text: string) => {
    if (!text) return { fontSize: 'text-lg', lineHeight: 'leading-tight' };
    
    const length = text.length;
    
    // More aggressive sizing for maximum visual impact
    if (length <= 15) {
      return { fontSize: 'text-xl', lineHeight: 'leading-tight' };
    } else if (length <= 25) {
      return { fontSize: 'text-lg', lineHeight: 'leading-tight' };
    } else if (length <= 35) {
      return { fontSize: 'text-base', lineHeight: 'leading-tight' };
    } else if (length <= 50) {
      return { fontSize: 'text-sm', lineHeight: 'leading-tight' };
    } else if (length <= 70) {
      return { fontSize: 'text-sm', lineHeight: 'leading-tight' };
    } else {
      return { fontSize: 'text-sm', lineHeight: 'leading-none' };
    }
  };
  
  // Format city to Title Case
  const formatCity = (value?: string) => {
    if (!value) return '';
    return value
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Build meta line: "Deltid • Saltsjö-Boo, Stockholms län"
  const getMetaLine = (employment?: string, city?: string, county?: string) => {
    const emp = getEmploymentTypeLabel(employment);
    // Include county if available
    let locationPart = formatCity(city || '');
    if (county && county.trim()) {
      locationPart = locationPart ? `${locationPart}, ${county}` : county;
    }
    return [emp, locationPart].filter(Boolean).join(' • ');
  };

  // Smart location formatting with main city
  const formatCityWithMainCity = (city: string) => {
    if (!city) return '';
    
    const formattedCity = formatCity(city);
    
    // Check if we have postal code info to get the main city
    const postalCode = formData.workplace_postal_code;
    if (postalCode) {
      // Try to get city info from postal code
      const mainCity = getMainCityFromPostalCode(postalCode);
      if (mainCity && mainCity.toLowerCase() !== formattedCity.toLowerCase()) {
        return `${formattedCity}, ${mainCity}`;
      }
    }
    
    // Fallback: Smart mapping of common suburbs to main cities
    const cityMappings: Record<string, string> = {
      'vega': 'Stockholm',
      'haninge': 'Stockholm', 
      'tyresö': 'Stockholm',
      'nacka': 'Stockholm',
      'solna': 'Stockholm',
      'sundbyberg': 'Stockholm',
      'huddinge': 'Stockholm',
      'järfälla': 'Stockholm',
      'täby': 'Stockholm',
      'danderyd': 'Stockholm',
      'lidingö': 'Stockholm',
      'värmdö': 'Stockholm',
      'botkyrka': 'Stockholm',
      'salem': 'Stockholm',
      'nykvarn': 'Stockholm',
      'södertälje': 'Stockholm',
      'nynäshamn': 'Stockholm',
      'mölndal': 'Göteborg',
      'partille': 'Göteborg',
      'härryda': 'Göteborg',
      'lerum': 'Göteborg',
      'alingsås': 'Göteborg',
      'kungsbacka': 'Göteborg',
      'ale': 'Göteborg',
      'lilla edet': 'Göteborg',
      'stenungsund': 'Göteborg',
      'öckerö': 'Göteborg',
      'malmö': 'Malmö',
      'lund': 'Malmö',
      'helsingborg': 'Malmö',
      'landskrona': 'Malmö',
      'eslöv': 'Malmö',
      'höganäs': 'Malmö',
      'kävlinge': 'Malmö',
      'lomma': 'Malmö',
      'staffanstorp': 'Malmö',
      'svedala': 'Malmö',
      'trelleborg': 'Malmö',
      'vellinge': 'Malmö'
    };
    
    const mainCity = cityMappings[formattedCity.toLowerCase()];
    if (mainCity && mainCity.toLowerCase() !== formattedCity.toLowerCase()) {
      return `${formattedCity}, ${mainCity}`;
    }
    
    return formattedCity;
  };

  const getMainCityFromPostalCode = (postalCode: string): string | null => {
    // Import postal code data if needed
    try {
      const cleanedCode = postalCode.replace(/\s/g, '');
      // This would need the actual postal code lookup - for now return null
      // In a real implementation, you'd use the postalCodeAPI here
      return null;
    } catch {
      return null;
    }
  };

  // Smart text sizing based on content length and hierarchy
  const getSmartTextSizes = () => {
    const companyName = profile?.company_name || 'Företag';
    const jobTitle = getDisplayTitle();
    const metaLine = getMetaLine(formData.employment_type, formData.workplace_city || formData.location, formData.workplace_county);

    // Calculate optimal sizes based on content length and visual balance
    const companyLength = companyName.length;
    const titleLength = jobTitle.length;
    const metaLength = metaLine.length;

    // More aggressive sizing for better visual balance
    let companySizeClass = 'text-sm'; // Start smaller for company
    let titleSizeClass = 'text-lg';   // Make title more prominent 
    let metaSizeClass = 'text-sm';    // Readable meta info

    // Adjust title size based on length - this is the hero element
    if (titleLength > 50) {
      titleSizeClass = 'text-base';
      companySizeClass = 'text-sm';
      metaSizeClass = 'text-sm';
    } else if (titleLength > 30) {
      titleSizeClass = 'text-lg';
      companySizeClass = 'text-sm';
      metaSizeClass = 'text-sm';
    } else if (titleLength < 20) {
      titleSizeClass = 'text-xl';
      companySizeClass = 'text-sm';
      metaSizeClass = 'text-base';
    }

    // Adjust company name - keep it subtle but readable
    if (companyLength > 15) {
      companySizeClass = 'text-sm';
    } else if (companyLength < 8) {
      companySizeClass = 'text-sm';
    }

    // Ensure meta info is always readable
    if (metaLength > 20) {
      metaSizeClass = 'text-sm';
    } else if (metaLength < 10) {
      metaSizeClass = 'text-sm';
    }

    return {
      company: companySizeClass,
      title: titleSizeClass,
      meta: metaSizeClass
    };
  };
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [occupationSearchTerm, setOccupationSearchTerm] = useState('');
  const [showOccupationDropdown, setShowOccupationDropdown] = useState(false);
  const [questionTypeSearchTerm, setQuestionTypeSearchTerm] = useState('');
  const [showQuestionTypeDropdown, setShowQuestionTypeDropdown] = useState(false);
  const [employmentTypeSearchTerm, setEmploymentTypeSearchTerm] = useState('');
  const [showEmploymentTypeDropdown, setShowEmploymentTypeDropdown] = useState(false);
  const [salaryTypeSearchTerm, setSalaryTypeSearchTerm] = useState('');
  const [showSalaryTypeDropdown, setShowSalaryTypeDropdown] = useState(false);
  const [salaryTransparencySearchTerm, setSalaryTransparencySearchTerm] = useState('');
  const [showSalaryTransparencyDropdown, setShowSalaryTransparencyDropdown] = useState(false);
  const [showBenefitsDropdown, setShowBenefitsDropdown] = useState(false);
  const [customBenefitInput, setCustomBenefitInput] = useState('');
  const [workLocationSearchTerm, setWorkLocationSearchTerm] = useState('');
  const [showWorkLocationDropdown, setShowWorkLocationDropdown] = useState(false);
  const [remoteWorkSearchTerm, setRemoteWorkSearchTerm] = useState('');
  const [showRemoteWorkDropdown, setShowRemoteWorkDropdown] = useState(false);
  const [showHingePreview, setShowHingePreview] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [desktopPreviewAnswers, setDesktopPreviewAnswers] = useState<Record<string, string>>({});
  const [hingeMode, setHingeMode] = useState<'ad' | 'apply'>('ad');
  const screenRef = useRef<HTMLDivElement>(null);
  const workEndTimeRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);
  const BASE_WIDTH = 360;
  const BASE_HEIGHT = 720;

  useEffect(() => {
    if (!showHingePreview) return;
    const recalc = () => {
      const el = screenRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.min(w / BASE_WIDTH, h / BASE_HEIGHT);
      setScale(s);
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [showHingePreview]);
  const [jobImageDisplayUrl, setJobImageDisplayUrl] = useState<string | null>(null);
  const [jobImageDesktopDisplayUrl, setJobImageDesktopDisplayUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [originalDesktopImageUrl, setOriginalDesktopImageUrl] = useState<string | null>(null);
  const [originalStoragePath, setOriginalStoragePath] = useState<string | null>(null); // Original storage path before editing
  const [originalDesktopStoragePath, setOriginalDesktopStoragePath] = useState<string | null>(null);
  const [imageIsEdited, setImageIsEdited] = useState<boolean>(false); // Track if image has been cropped/edited
  const [desktopImageIsEdited, setDesktopImageIsEdited] = useState<boolean>(false);
  const [imageTimestamp, setImageTimestamp] = useState<number>(Date.now()); // For cache busting
  
  const [bgPosition, setBgPosition] = useState<string>('center 50%');
  const [manualFocus, setManualFocus] = useState<number | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [editingImageType, setEditingImageType] = useState<'mobile' | 'desktop'>('mobile');
  const [cachedPostalCodeInfo, setCachedPostalCodeInfo] = useState<{postalCode: string, city: string, municipality: string, county: string} | null>(null);
  
  // NOTE: formData initial state is always empty - actual state is loaded 
  // in the open useEffect at the top. This prevents sessionStorage race conditions.
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
    salary_transparency: '',
    benefits: [],
    positions_count: '1',
    work_start_time: '',
    work_end_time: '',
    work_location_type: 'på-plats',
    remote_work_possible: 'nej',
    workplace_name: '',
    workplace_address: '',
    workplace_postal_code: '',
    workplace_city: '',
    workplace_county: '',
    workplace_municipality: '',
    work_schedule: '',
    contact_email: '',
    application_instructions: '',
    pitch: '',
    job_image_url: '',
    job_image_desktop_url: ''
  });
  
  // Save form state to sessionStorage when there are unsaved changes
  useEffect(() => {
    if (open && hasUnsavedChanges) {
      try {
        sessionStorage.setItem(JOB_WIZARD_SESSION_KEY, JSON.stringify({
          formData,
          currentStep,
          customQuestions
        }));
      } catch (e) {
        console.warn('Failed to save job wizard state to sessionStorage');
      }
    }
  }, [formData, currentStep, customQuestions, hasUnsavedChanges, open]);
  
  // NOTE: Removed sessionStorage restoration useEffect as it caused race conditions
  // with the initialization useEffect at the top. The init useEffect handles all
  // state loading from existingJob or selectedTemplate, and clears sessionStorage
  // to prevent false "unsaved changes" detection when opening a fresh wizard.

  // Smart text fit for occupation - uses break-words but reduces font-size if it would wrap
  const occupationRef = useSmartTextFit<HTMLDivElement>(formData.occupation || '', { minFontPx: 10 });

  // Visningsnamn: visa alltid användarens titel (inte AI-förslag)
  const getDisplayTitle = () => {
    return formData.title || 'Jobbtitel';
  };

  const { user } = useAuth();
  const { toast } = useToast();

  // Load user profile and question templates when opening
  useEffect(() => {
    if (user && open) {
      fetchProfile();
      fetchQuestionTemplates();
      // NOTE: Template questions are now loaded ONLY in the main 'open' useEffect at the top
      // to avoid race conditions with initialCustomQuestions causing false "unsaved changes"
    }
  }, [user, open]);
  
  const fetchQuestionTemplates = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('job_question_templates')
        .select('*')
        .eq('employer_id', user.id)
        .order('question_text', { ascending: true }); // Alphabetical order
      
      if (error) throw error;
      
      // Map database templates to JobQuestion format
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
  
  // NOTE: Removed the useEffect that updated formData based on jobTitle/selectedTemplate
  // as it caused race conditions. All form data is now loaded ONLY in the 'open' useEffect
  // at the top of the component, which sets both formData AND initialFormData together.
  
  // NOTE: initialFormData and initialCustomQuestions are now set DIRECTLY 
  // in the loading useEffect above to avoid race conditions with async data loading
  
  
  // Track form changes
  useEffect(() => {
    if (!initialFormData || !open) return;
    
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    const questionsChanged = JSON.stringify(customQuestions) !== JSON.stringify(initialCustomQuestions);
    
    setHasUnsavedChanges(formChanged || questionsChanged);
  }, [formData, customQuestions, initialFormData, initialCustomQuestions, open]);

  // Show company tooltip only once when first reaching step 4, then keep it visible
  useEffect(() => {
    if (currentStep === 3 && open && !showCompanyTooltip) {
      setShowCompanyTooltip(true);
    }
  }, [currentStep, open]);

  // Resolve signed URL for uploaded job image preview (mobile)
  useEffect(() => {
    const url = formData.job_image_url;
    let cancelled = false;
    (async () => {
      if (!url) { setJobImageDisplayUrl(null); return; }
      if (url.startsWith('http')) { setJobImageDisplayUrl(url); return; }
      const signed = await createSignedUrl('job-images', url, 86400);
      if (!cancelled) setJobImageDisplayUrl(signed);
    })();
    return () => { cancelled = true; };
  }, [formData.job_image_url]);

  // Resolve signed URL for uploaded job image preview (desktop)
  useEffect(() => {
    const url = formData.job_image_desktop_url;
    let cancelled = false;
    (async () => {
      if (!url) { setJobImageDesktopDisplayUrl(null); return; }
      if (url.startsWith('http')) { setJobImageDesktopDisplayUrl(url); return; }
      const signed = await createSignedUrl('job-images', url, 86400);
      if (!cancelled) setJobImageDesktopDisplayUrl(signed);
    })();
    return () => { cancelled = true; };
  }, [formData.job_image_desktop_url]);

  // Auto-justera beskärning baserat på bildens aspektförhållande
  useEffect(() => {
    if (!jobImageDisplayUrl) { setBgPosition('center 50%'); return; }
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth || (img as any).width;
      const h = img.naturalHeight || (img as any).height;
      const ratio = w / h; // >1 = liggande, <1 = stående

      let posY = 50;
      if (ratio < 0.6) posY = 36;         // extremt stående (t.ex. telefon-screens)
      else if (ratio < 0.85) posY = 40;   // stående
      else if (ratio < 1.1) posY = 48;    // nära kvadrat
      else posY = 50;                     // liggande

      // Använd manuell justering om den är satt
      const finalY = manualFocus !== null ? manualFocus : posY;
      setBgPosition(`center ${finalY}%`);
    };
    img.src = jobImageDisplayUrl;
    return () => { cancelled = true; };
  }, [jobImageDisplayUrl, manualFocus]);

  // Remove the duplicate tooltip logic - handled by useEffect above

  const handleImageEdit = async (editedImageBlob: Blob): Promise<void> => {
    console.log('MobileJobWizard handleImageEdit: Received blob, size:', editedImageBlob.size, 'type:', editingImageType);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('Du måste vara inloggad för att ladda upp filer');
      }

      // Skapa ett unikt filnamn för den redigerade bilden
      const fileExt = 'png'; // ImageEditor sparar alltid som PNG
      const fileName = `${user.data.user.id}/${Date.now()}-edited-${editingImageType}-job-image.${fileExt}`;

      console.log('MobileJobWizard handleImageEdit: Uploading to path:', fileName);

      // Ladda upp den redigerade bilden till Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('job-images')
        .upload(fileName, editedImageBlob);

      if (uploadError) {
        console.error('MobileJobWizard handleImageEdit: Upload error:', uploadError);
        throw uploadError;
      }

      console.log('MobileJobWizard handleImageEdit: Upload successful');

      // Hämta public URL för job-images (public bucket)
      const { data: { publicUrl } } = supabase.storage
        .from('job-images')
        .getPublicUrl(fileName);

      console.log('MobileJobWizard handleImageEdit: Public URL:', publicUrl);

      // Förladdda bilden direkt i Service Worker (fire-and-forget, don't wait)
      import('@/lib/serviceWorkerManager').then(({ preloadSingleFile }) => {
        preloadSingleFile(publicUrl).catch(e => console.log('Preload error (non-blocking):', e));
      });

      // Update the correct image based on which one is being edited
      if (editingImageType === 'desktop') {
        handleInputChange('job_image_desktop_url', fileName);
        setJobImageDesktopDisplayUrl(publicUrl);
        setDesktopImageIsEdited(true);
        // Keep originalDesktopImageUrl unchanged for restore functionality
      } else {
        handleInputChange('job_image_url', fileName);
        setJobImageDisplayUrl(publicUrl);
        setImageIsEdited(true);
        setImageTimestamp(Date.now());
        setManualFocus(null);
        // Keep originalImageUrl unchanged for restore functionality
      }
      
      setShowImageEditor(false);
      setEditingImageUrl(null);
      
      console.log('MobileJobWizard handleImageEdit: Done, showing toast');
      
      toast({
        title: "Bild justerad",
        description: editingImageType === 'desktop' ? "Datorbilden har sparats" : "Mobilbilden har sparats",
      });
      
      console.log('MobileJobWizard handleImageEdit: Function complete');
    } catch (error) {
      console.error('MobileJobWizard handleImageEdit: Error:', error);
      toast({
        title: "Fel",
        description: error instanceof Error ? error.message : "Kunde inte spara den redigerade bilden",
        variant: "destructive",
      });
      throw error; // Re-throw så ImageEditor vet att det misslyckades
    }
  };

  // Återställ till originalbilden (ingen croppning)
  const handleRestoreOriginal = async () => {
    if (editingImageType === 'desktop') {
      if (!originalDesktopImageUrl || !originalDesktopStoragePath) {
        console.log('No original desktop image to restore');
        return;
      }
      setJobImageDesktopDisplayUrl(originalDesktopImageUrl);
      handleInputChange('job_image_desktop_url', originalDesktopStoragePath);
      setDesktopImageIsEdited(false);
    } else {
      if (!originalImageUrl || !originalStoragePath) {
        console.log('No original image URL or storage path to restore');
        return;
      }
      setJobImageDisplayUrl(originalImageUrl);
      handleInputChange('job_image_url', originalStoragePath);
      setImageIsEdited(false);
      setManualFocus(null);
      setImageTimestamp(Date.now());
    }
    
    toast({
      title: "Bild återställd",
      description: "Originalbilden har återställts",
    });
  };

  // Öppna editor med ALLTID originalbildens URL (inte den redigerade versionen)
  const openImageEditor = async () => {
    try {
      // ALLTID prioritera originalImageUrl för att redigera från originalet
      const source = originalImageUrl;
      if (!source) {
        console.log('No original image URL available');
        return;
      }

      let urlToEdit = source;
      if (!source.startsWith('http') && !source.startsWith('blob:') && !source.startsWith('data:')) {
        // Try job-images first (new public bucket), then job-applications as fallback (old private bucket)
        let signed = await createSignedUrl('job-images', source, 86400);
        if (!signed) {
          signed = await createSignedUrl('job-applications', source, 86400);
        }
        if (signed) urlToEdit = signed;
      }
      console.log('Opening image editor with:', urlToEdit);
      setEditingImageUrl(urlToEdit);
      setEditingImageType('mobile');
      setShowImageEditor(true);
    } catch (e) {
      console.error('Failed to open editor', e);
    }
  };

  // Öppna editor för datorbild - ALLTID använd originalbildens URL (inte den redigerade versionen)
  const openDesktopImageEditor = async () => {
    try {
      // ALLTID prioritera originalDesktopImageUrl för att redigera från originalet - precis som mobile
      const source = originalDesktopImageUrl;
      if (!source) {
        console.log('No original desktop image URL available');
        return;
      }

      let urlToEdit = source;
      if (!source.startsWith('http') && !source.startsWith('blob:') && !source.startsWith('data:')) {
        // Get public URL from storage
        const { data: { publicUrl } } = supabase.storage
          .from('job-images')
          .getPublicUrl(source);
        if (publicUrl) urlToEdit = publicUrl;
      }
      console.log('Opening desktop image editor with ORIGINAL:', urlToEdit);
      setEditingImageUrl(urlToEdit);
      setEditingImageType('desktop');
      setShowImageEditor(true);
    } catch (e) {
      console.error('Failed to open desktop editor', e);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    setProfile(data);
    
    // Auto-fill workplace name with company name
    if (data?.company_name && !formData.workplace_name) {
      setFormData(prev => ({
        ...prev,
        workplace_name: data.company_name
      }));
    }
    
    // Auto-fill contact email if not already set and use user email as fallback
    if (!formData.contact_email && user.email) {
      setFormData(prev => ({
        ...prev,
        contact_email: user.email
      }));
    }
  };

  // Functions for handling custom questions
  const addCustomQuestion = () => {
    // Show template list first
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
    
    // Filter out empty options for multiple choice questions
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
      } else {
        // Question exists but has no template - save it as a new template
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
          
          // Link the question to its new template
          if (data) {
            setCustomQuestions(prev => 
              prev.map(q => q.id === filteredQuestion.id ? { ...q, template_id: data.id } : q)
            );
          }
          
          await fetchQuestionTemplates();
        } catch (error) {
          console.error('Error saving question as template:', error);
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
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCustomQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        // Update order_index for all items
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
    
    // Reset type-specific fields when question type changes
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

  // NOTE: REMOVED the old useEffect that updated formData based on jobTitle/selectedTemplate
  // as it caused race conditions with initialFormData. All form data initialization is now
  // handled ONLY in the main 'open' useEffect at the top of the component (lines 134-301).
  // This ensures formData and initialFormData are always set together, preventing false
  // "unsaved changes" detection.
  
  // Auto-fill workplace name and contact email from profile/user when they become available
  // This only runs for new fields that weren't set during initialization
  useEffect(() => {
    if (!open) return; // Only run when wizard is open
    
    // Update workplace name if it's empty and we have company name
    if (!formData.workplace_name && profile?.company_name) {
      setFormData(prev => ({ ...prev, workplace_name: profile.company_name }));
      // Also update initialFormData to prevent false "unsaved changes"
      setInitialFormData(prev => prev ? { ...prev, workplace_name: profile.company_name } : null);
    }
    
    // Update contact email if it's empty and we have user email
    if (!formData.contact_email && user?.email) {
      setFormData(prev => ({ ...prev, contact_email: user.email }));
      // Also update initialFormData to prevent false "unsaved changes"
      setInitialFormData(prev => prev ? { ...prev, contact_email: user.email } : null);
    }
  }, [open, profile?.company_name, user?.email, formData.workplace_name, formData.contact_email]);

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

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCitySearch = (value: string) => {
    setCitySearchTerm(value);
    handleInputChange('location', value);
    setShowCityDropdown(value.length > 0);
  };

  const handleCitySelect = (cityName: string) => {
    handleInputChange('location', cityName);
    setCitySearchTerm(cityName);
    setShowCityDropdown(false);
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showQuestionTypeDropdown && !(event.target as Element).closest('.question-type-dropdown')) {
        setShowQuestionTypeDropdown(false);
      }
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
      if (showBenefitsDropdown && !(event.target as Element).closest('.benefits-dropdown')) {
        setShowBenefitsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuestionTypeDropdown, showOccupationDropdown, showEmploymentTypeDropdown, showSalaryTypeDropdown, showWorkLocationDropdown, showRemoteWorkDropdown, showBenefitsDropdown]);
  const questionTypes = [
    { value: 'text', label: 'Text' },
    { value: 'yes_no', label: 'Ja/Nej' },
    { value: 'multiple_choice', label: 'Flervalsval' },
    { value: 'number', label: 'Siffra' }
  ];

  // Salary type options
  const salaryTypes = [
    { value: 'fast', label: 'Fast månads- vecko- eller timlön' },
    { value: 'rorlig', label: 'Rörlig ackord- eller provisionslön' },
    { value: 'fast-rorlig', label: 'Fast och rörlig lön' }
  ];

  // Work location type options
  const workLocationTypes = [
    { value: 'på-plats', label: 'På plats' },
    { value: 'hemarbete', label: 'Hemarbete' },
    { value: 'hybridarbete', label: 'Hybridarbete' },
    { value: 'fältarbete', label: 'Fältarbete/ute' },
    { value: 'utomlands', label: 'Utomlands' }
  ];

  // Remote work options
  const remoteWorkOptions = [
    { value: 'nej', label: 'Nej' },
    { value: 'delvis', label: 'Delvis' },
    { value: 'ja', label: 'Ja, helt' }
  ];

  // Get display text for work location and remote work
  const getWorkLocationDisplayText = () => {
    const locationType = workLocationTypes.find(t => t.value === formData.work_location_type);
    
    let displayText = locationType?.label || 'På plats';
    
    // Add remote work info if relevant
    if (formData.remote_work_possible === 'ja') {
      displayText += ', distans helt möjligt';
    } else if (formData.remote_work_possible === 'delvis') {
      displayText += ', delvis distans';
    }
    
    // Capitalize first letter and make rest lowercase
    const capitalizedText = displayText.charAt(0).toUpperCase() + displayText.slice(1).toLowerCase();
    
    return `(${capitalizedText})`;
  };

  // Format salary information for display (without transparency - shown separately)
  const formatSalaryInfo = () => {
    const parts = [];
    
    // Add salary range if provided
    if (formData.salary_min || formData.salary_max) {
      if (formData.salary_min && formData.salary_max) {
        parts.push(`${parseInt(formData.salary_min).toLocaleString()} - ${parseInt(formData.salary_max).toLocaleString()} kr/mån`);
      } else if (formData.salary_min) {
        parts.push(`Från ${parseInt(formData.salary_min).toLocaleString()} kr/mån`);
      } else if (formData.salary_max) {
        parts.push(`Upp till ${parseInt(formData.salary_max).toLocaleString()} kr/mån`);
      }
    }
    
    // Add salary type if provided
    if (formData.salary_type) {
      const salaryType = salaryTypes.find(t => t.value === formData.salary_type);
      if (salaryType) {
        parts.push(salaryType.label);
      }
    }
    
    return parts;
  };

  // Format salary transparency for display (shown as separate section)
  const formatSalaryTransparency = () => {
    if (!formData.salary_transparency) return null;
    
    // First, try to find exact match in options
    const transparencyOption = salaryTransparencyOptions.find(t => t.value === formData.salary_transparency);
    if (transparencyOption) return transparencyOption.label;
    
    // Handle legacy format like "50000-60000" by converting to label
    const legacyMatch = formData.salary_transparency.match(/^(\d+)-(\d+)$/);
    if (legacyMatch) {
      const min = parseInt(legacyMatch[1]);
      const max = parseInt(legacyMatch[2]);
      // Check if it's the old format (values > 100 means it's in SEK, not thousands)
      if (min >= 1000 || max >= 1000) {
        return `${min.toLocaleString('sv-SE')} - ${max.toLocaleString('sv-SE')} kr`;
      }
    }
    
    // Handle "100+" format
    if (formData.salary_transparency === '100+') {
      return '100 000+ kr';
    }
    
    // Fallback: just display the raw value
    return formData.salary_transparency;
  };

  // Format positions count for display
  const formatPositionsCount = () => {
    const count = parseInt(formData.positions_count) || 1;
    if (count === 1) {
      return '1 person';
    } else {
      return `${count} personer`;
    }
  };

  // Smart email text sizing based on email length
  const getEmailTextSize = (email: string) => {
    if (!email) return 'text-sm';
    
    const length = email.length;
    if (length <= 15) return 'text-sm'; // Short emails get normal size
    if (length <= 25) return 'text-[10px]'; // Medium emails get smaller
    if (length <= 35) return 'text-[9px]'; // Long emails get even smaller
    return 'text-[8px]'; // Very long emails get tiny
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

  // Helper function to close all dropdowns
  const closeAllDropdowns = () => {
    setShowOccupationDropdown(false);
    setShowQuestionTypeDropdown(false);
    setShowEmploymentTypeDropdown(false);
    setShowSalaryTypeDropdown(false);
    setShowSalaryTransparencyDropdown(false);
    setShowBenefitsDropdown(false);
    setShowWorkLocationDropdown(false);
    setShowRemoteWorkDropdown(false);
  };

  const handleQuestionTypeClick = () => {
    const isCurrentlyOpen = showQuestionTypeDropdown;
    closeAllDropdowns();
    setQuestionTypeSearchTerm(''); // Reset search to show all options
    setShowQuestionTypeDropdown(!isCurrentlyOpen);
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
    const isCurrentlyOpen = showEmploymentTypeDropdown;
    closeAllDropdowns();
    setEmploymentTypeSearchTerm(''); // Reset search to show all options
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
    setSalaryTypeSearchTerm(''); // Reset search to show all options
    setShowSalaryTypeDropdown(!isCurrentlyOpen);
  };

  // Salary Transparency options (EU directive 2026)
  const salaryTransparencyOptions = [
    { value: '0-5', label: '0 - 5 000 kr' },
    { value: '5-10', label: '5 000 - 10 000 kr' },
    { value: '10-15', label: '10 000 - 15 000 kr' },
    { value: '15-20', label: '15 000 - 20 000 kr' },
    { value: '20-25', label: '20 000 - 25 000 kr' },
    { value: '25-30', label: '25 000 - 30 000 kr' },
    { value: '30-40', label: '30 000 - 40 000 kr' },
    { value: '40-45', label: '40 000 - 45 000 kr' },
    { value: '45-50', label: '45 000 - 50 000 kr' },
    { value: '50-55', label: '50 000 - 55 000 kr' },
    { value: '55-60', label: '55 000 - 60 000 kr' },
    { value: '60-65', label: '60 000 - 65 000 kr' },
    { value: '65-70', label: '65 000 - 70 000 kr' },
    { value: '70-75', label: '70 000 - 75 000 kr' },
    { value: '75-80', label: '75 000 - 80 000 kr' },
    { value: '80-85', label: '80 000 - 85 000 kr' },
    { value: '85-90', label: '85 000 - 90 000 kr' },
    { value: '90-100', label: '90 000 - 100 000 kr' },
    { value: '100+', label: '100 000+ kr' },
  ];

  const filteredSalaryTransparencyOptions = salaryTransparencyOptions.filter(option =>
    option.label.toLowerCase().includes(salaryTransparencySearchTerm.toLowerCase())
  );

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
    setSalaryTransparencySearchTerm(''); // Reset search to show all options
    setShowSalaryTransparencyDropdown(!isCurrentlyOpen);
  };

  const handleWorkLocationSearch = (value: string) => {
    setWorkLocationSearchTerm(value);
    setShowWorkLocationDropdown(value.length >= 0);
  };

  const handleWorkLocationSelect = (type: { value: string, label: string }) => {
    handleInputChange('work_location_type', type.value);
    setWorkLocationSearchTerm(type.label);
    setShowWorkLocationDropdown(false);
    
    // Auto-set remote_work_possible based on work location type
    if (type.value === 'hemarbete' || type.value === 'hybridarbete' || type.value === 'utomlands') {
      handleInputChange('remote_work_possible', 'delvis');
      setRemoteWorkSearchTerm('Delvis');
    } else if (type.value === 'på-plats' || type.value === 'fältarbete') {
      handleInputChange('remote_work_possible', 'nej');
      setRemoteWorkSearchTerm('Nej');
    }
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

  const filteredQuestionTypes = questionTypeSearchTerm.length > 0
    ? questionTypes.filter(type => 
        type.label.toLowerCase().includes(questionTypeSearchTerm.toLowerCase())
      )
    : questionTypes;

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

  const handleWorkplacePostalCodeChange = useCallback((postalCode: string) => {
    handleInputChange('workplace_postal_code', postalCode);
  }, []);

  const handleWorkplaceLocationChange = useCallback((location: string, postalCode?: string, municipality?: string, county?: string) => {
    setFormData(prev => ({
      ...prev,
      workplace_city: location,
      location: location, // Auto-update main location field from postal code
      workplace_municipality: municipality || prev.workplace_municipality,
      workplace_county: county || prev.workplace_county
    }));
    
    // Cache postal code info if available
    if (postalCode && location && municipality && county) {
      setCachedPostalCodeInfo({
        postalCode,
        city: location,
        municipality,
        county
      });
    }
  }, []);

  const filteredCities = citySearchTerm.length > 0 ? filterCities(citySearchTerm) : [];
  const filteredOccupations = occupationSearchTerm.length > 0 ? searchOccupations(occupationSearchTerm) : [];

  const validateCurrentStep = () => {
    const currentStepFields = steps[currentStep].fields;
    
    // Required fields validation
    if (currentStep === 0) {
      return formData.title.trim() && 
             formData.occupation.trim() && 
             formData.description.trim() && 
             formData.employment_type &&
             formData.salary_type &&
             formData.salary_transparency &&
             parseInt(formData.positions_count) > 0 &&
             formData.work_start_time.trim() &&
             formData.work_end_time.trim();
    }
    
    if (currentStep === 1) {
      return formData.work_location_type && 
             formData.remote_work_possible && 
             formData.workplace_name.trim() && 
             formData.contact_email.trim() && 
             formData.workplace_postal_code.trim() && 
             formData.workplace_city.trim();
    }
    
    if (currentStep === 2) {
      return true; // Kontakt flyttat till steg 2, så inga krav här
    }
    
    if (currentStep === 3) {
      return true; // Förhandsvisning kräver ingen validering
    }
    
    return true;
  };

  const getMissingFieldsMessage = (): string[] => {
    const missing: string[] = [];
    
    if (currentStep === 0) {
      if (!formData.title.trim()) missing.push('Jobbtitel');
      if (!formData.occupation.trim()) missing.push('Yrkeskategori');
      if (!formData.description.trim()) missing.push('Beskrivning');
      if (!formData.employment_type) missing.push('Anställningsform');
      if (!formData.salary_type) missing.push('Lönetyp');
      if (!formData.salary_transparency) missing.push('Lönetransparens');
      if (!(parseInt(formData.positions_count) > 0)) missing.push('Antal personer att rekrytera');
      if (!formData.work_start_time.trim()) missing.push('Arbetstid (starttid)');
      if (!formData.work_end_time.trim()) missing.push('Arbetstid (sluttid)');
    }
    
    if (currentStep === 1) {
      if (!formData.work_location_type) missing.push('Var utförs arbetet');
      if (!formData.remote_work_possible) missing.push('Distansarbete');
      if (!formData.workplace_name.trim()) missing.push('Arbetsplatsens namn');
      if (!formData.contact_email.trim()) missing.push('Kontakt e-post');
      if (!formData.workplace_postal_code.trim()) missing.push('Postnummer');
      if (!formData.workplace_city.trim()) missing.push('Ort');
    }
    
    return missing;
  };

  const nextStep = () => {
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      // Scroll to top immediately when changing steps
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: 0,
            behavior: 'instant'
          });
        }
      }, 0);
    } else if (!validateCurrentStep()) {
      const missingFields = getMissingFieldsMessage();
      if (missingFields.length > 0) {
        toast({
          title: "Fyll i obligatoriska fält",
          description: `Saknas: ${missingFields.join(', ')}`,
          variant: "destructive",
        });
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      // Scroll to top immediately when changing steps
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: 0,
            behavior: 'instant'
          });
        }
      }, 0);
    }
  };

  // Scroll to top när steget ändras
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [currentStep]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setPendingClose(true);
      setShowUnsavedDialog(true);
    } else {
      // Reset everything completely - set isInitializing FIRST to prevent button flash
      setIsInitializing(true);
      setCurrentStep(0);
      setFormData({
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
        benefits: [],
        positions_count: '1',
        work_start_time: '',
        work_end_time: '',
        work_location_type: 'på-plats',
        remote_work_possible: 'nej',
        workplace_name: '',
        workplace_address: '',
        workplace_postal_code: '',
        workplace_city: '',
        workplace_county: '',
        workplace_municipality: '',
        work_schedule: '',
        contact_email: '',
        application_instructions: '',
        pitch: '',
        job_image_url: '',
        job_image_desktop_url: ''
      });
      setCustomQuestions([]);
      setJobImageDisplayUrl(null);
      setOriginalImageUrl(null);
      setOriginalStoragePath(null);
      setImageIsEdited(false);
      setCachedPostalCodeInfo(null);
      setInitialFormData(null);
      setHasUnsavedChanges(false);
      // Reset dropdown search terms
      setEmploymentTypeSearchTerm('');
      setSalaryTypeSearchTerm('');
      setSalaryTransparencySearchTerm('');
      
      // Clear sessionStorage when closing without changes
      sessionStorage.removeItem(JOB_WIZARD_SESSION_KEY);
      
      // Om onBack finns, använd den för att gå tillbaka till mallvalet
      // Annars stäng helt (default beteende)
      if (onBack) {
        onBack();
      } else {
        onOpenChange(false);
      }
    }
  };

  const handleConfirmClose = () => {
    // Reset everything completely and close - set isInitializing FIRST to prevent button flash
    setIsInitializing(true);
    setCurrentStep(0);
    setFormData({
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
      benefits: [],
      positions_count: '1',
      work_start_time: '',
      work_end_time: '',
      work_location_type: 'på-plats',
      remote_work_possible: 'nej',
      workplace_name: '',
      workplace_address: '',
      workplace_postal_code: '',
      workplace_city: '',
      workplace_county: '',
      workplace_municipality: '',
      work_schedule: '',
      contact_email: '',
      application_instructions: '',
      pitch: '',
      job_image_url: '',
      job_image_desktop_url: ''
    });
    setCustomQuestions([]);
    setJobImageDisplayUrl(null);
    setOriginalImageUrl(null);
    setOriginalStoragePath(null);
    setImageIsEdited(false);
    setCachedPostalCodeInfo(null);
    setInitialFormData(null);
    setHasUnsavedChanges(false);
    setShowUnsavedDialog(false);
    setPendingClose(false);
    // Reset dropdown search terms
    setEmploymentTypeSearchTerm('');
    setSalaryTypeSearchTerm('');
    setSalaryTransparencySearchTerm('');
    
    // Clear sessionStorage when user confirms close
    sessionStorage.removeItem(JOB_WIZARD_SESSION_KEY);
    
    if (onBack) {
      onBack();
    } else {
      onOpenChange(false);
    }
  };

  const handleCancelClose = () => {
    setShowUnsavedDialog(false);
    setPendingClose(false);
  };

  // Save as draft (is_active: false) and close
  const handleSaveAndLeave = async () => {
    if (!user) return;
    await performSaveAsDraft();
  };
  
  const performSaveAsDraft = async () => {
    if (!user) return;
    
    setIsSavingDraft(true);
    
    try {
      const category = categorizeJob(formData.title, formData.description, formData.occupation);
      
      // For drafts, skip the postal code lookup to speed up saving
      // County/municipality will be fetched when the job is published
      const jobData = {
        employer_id: user.id,
        title: formData.title || 'Utkast',
        description: formData.description || null,
        requirements: formData.requirements || null,
        location: formData.workplace_city || formData.location || null,
        occupation: formData.occupation || null,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        employment_type: formData.employment_type || null,
        salary_type: formData.salary_type || null,
        salary_transparency: formData.salary_transparency || null,
        benefits: formData.benefits.length > 0 ? formData.benefits : null,
        positions_count: formData.positions_count ? parseInt(formData.positions_count) : 1,
        work_location_type: formData.work_location_type || null,
        remote_work_possible: formData.remote_work_possible || null,
        workplace_name: formData.workplace_name || null,
        workplace_address: formData.workplace_address || null,
        workplace_postal_code: formData.workplace_postal_code || null,
        workplace_city: formData.workplace_city || null,
        workplace_county: formData.workplace_county || null,
        workplace_municipality: formData.workplace_municipality || null,
        work_schedule: formData.work_schedule || null,
        work_start_time: formData.work_start_time || null,
        work_end_time: formData.work_end_time || null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        pitch: formData.pitch || null,
        job_image_url: formData.job_image_url || null,
        job_image_desktop_url: formData.job_image_desktop_url || null,
        category: category || null,
        is_active: false // Save as draft - not published
      };

      let jobPost;
      let error;

      // If editing an existing job, update it instead of creating new
      if (existingJob?.id) {
        const { data, error: updateError } = await supabase
          .from('job_postings')
          .update(jobData)
          .eq('id', existingJob.id)
          .select()
          .single();
        jobPost = data;
        error = updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('job_postings')
          .insert([jobData])
          .select()
          .single();
        jobPost = data;
        error = insertError;
      }

      if (error) {
        toast({
          title: "Fel vid sparande",
          description: error.message,
          variant: "destructive"
        });
        setIsSavingDraft(false);
        return;
      }

      // Save questions - run delete and insert in parallel when possible
      if (jobPost && customQuestions.length > 0) {
        // If editing existing job, delete old questions first
        if (existingJob?.id) {
          await supabase
            .from('job_questions')
            .delete()
            .eq('job_id', existingJob.id);
        }

        const questionData = customQuestions.map(q => ({
          job_id: jobPost.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || null,
          is_required: q.is_required,
          order_index: q.order_index,
          placeholder_text: q.placeholder_text || null,
          min_value: q.min_value || null,
          max_value: q.max_value || null
        }));

        await supabase
          .from('job_questions')
          .insert(questionData);
      } else if (jobPost && existingJob?.id) {
        // Only delete if no new questions to add
        await supabase
          .from('job_questions')
          .delete()
          .eq('job_id', existingJob.id);
      }

      toast({
        title: existingJob?.id ? "Utkast uppdaterat" : "Utkast sparat",
        description: existingJob?.id 
          ? "Dina ändringar har sparats." 
          : "Annonsen har sparats som utkast. Du hittar den i 'Mina annonser'."
      });

      // Clear sessionStorage after successful save
      sessionStorage.removeItem(JOB_WIZARD_SESSION_KEY);

      // Reset and close
      setIsSavingDraft(false);
      setShowUnsavedDialog(false);
      setPendingClose(false);
      setHasUnsavedChanges(false);
      
      if (onBack) {
        onBack();
      } else {
        onOpenChange(false);
      }
      
      onJobCreated(jobPost);
      
      // Navigate to my-jobs instead of dashboard
      navigate('/my-jobs');
    } catch (error) {
      console.error('Save draft error:', error);
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte spara utkastet.",
        variant: "destructive"
      });
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !validateCurrentStep() || loading) return;
    await performPublish();
  };
  
  const performPublish = async () => {
    if (!user) return;
    
    setLoading(true);

    try {
      // Include all job posting fields
      const jobData = {
        employer_id: user.id,
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || null,
        location: formData.workplace_city || formData.location || null,
        occupation: formData.occupation || null,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        employment_type: formData.employment_type || null,
        salary_type: formData.salary_type || null,
        salary_transparency: formData.salary_transparency || null,
        benefits: formData.benefits.length > 0 ? formData.benefits : null,
        positions_count: formData.positions_count ? parseInt(formData.positions_count) : 1,
        work_location_type: formData.work_location_type || null,
        remote_work_possible: formData.remote_work_possible || null,
        workplace_name: formData.workplace_name || null,
        workplace_address: formData.workplace_address || null,
        workplace_postal_code: formData.workplace_postal_code || null,
        workplace_city: formData.workplace_city || null,
        workplace_county: formData.workplace_county || null,
        workplace_municipality: formData.workplace_municipality || null,
        work_schedule: formData.work_schedule || null,
        work_start_time: formData.work_start_time || null,
        work_end_time: formData.work_end_time || null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        pitch: formData.pitch || null,
        job_image_url: formData.job_image_url || null,
        job_image_desktop_url: formData.job_image_desktop_url || null,
        is_active: true
      };

      let jobPost;
      let error;

      // If editing an existing draft, update it instead of creating new
      if (existingJob?.id) {
        const { data, error: updateError } = await supabase
          .from('job_postings')
          .update(jobData)
          .eq('id', existingJob.id)
          .select()
          .single();
        jobPost = data;
        error = updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('job_postings')
          .insert([jobData])
          .select()
          .single();
        jobPost = data;
        error = insertError;
      }

      if (error) {
        toast({
          title: "Fel vid skapande av annons",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      // Save questions to job_questions table if there are any
      if (jobPost) {
        // If editing existing job, delete old questions first
        if (existingJob?.id) {
          await supabase
            .from('job_questions')
            .delete()
            .eq('job_id', existingJob.id);
        }

        // Then insert new questions if any
        if (customQuestions.length > 0) {
          const questionData = customQuestions.map(q => ({
            job_id: jobPost.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options || null,
            is_required: q.is_required,
            order_index: q.order_index,
            placeholder_text: q.placeholder_text || null,
            min_value: q.min_value || null,
            max_value: q.max_value || null
          }));

          const { error: questionsError } = await supabase
            .from('job_questions')
            .insert(questionData);

          if (questionsError) {
            console.error('Error saving questions:', questionsError);
          }
        }
      }

      // Note: Template questions are now managed separately via job_question_templates table
      // No need to store questions directly on job_templates

      toast({
        title: "Jobbannons skapad!",
        description: "Din annons är nu publicerad och synlig för jobbsökare."
      });

      // Clear sessionStorage and reset unsaved state BEFORE calling handleClose
      // This prevents the unsaved changes dialog from appearing
      sessionStorage.removeItem(JOB_WIZARD_SESSION_KEY);
      setHasUnsavedChanges(false);
      setInitialFormData(null);
      setInitialCustomQuestions([]);

      onJobCreated(jobPost);
      onOpenChange(false); // Close dialog directly instead of handleClose to avoid race condition

    } catch (error) {
      console.error('Submit error:', error);
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skapa jobbannonsen.",
        variant: "destructive"
      });
    } finally {
      // Ensure loading is reset even if error occurs
      setTimeout(() => setLoading(false), 100);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = !isInitializing && currentStep === steps.length - 1;

  // Don't render Dialog until initialization is complete to prevent button flash
  if (open && isInitializing) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setCurrentStep(0);
        setIsInitializing(true);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent 
        className="parium-panel max-w-none w-[min(92vw,400px)] h-auto max-h-[75vh] sm:max-h-[80vh] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AnimatedBackground showBubbles={false} />
        <div className="flex flex-col h-full max-h-[75vh] sm:max-h-[80vh] relative z-10">
          {/* Header */}
          <div className="relative flex items-center justify-center p-4 border-b border-white/20 flex-shrink-0 bg-background/10">
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
                className="absolute right-4 top-4 h-8 w-8 text-white/70 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
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
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {/* Step 1: Grundinfo */}
            {currentStep === 0 && (
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
                    
                    {/* Occupation Dropdown */}
                    {showOccupationDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                        {/* Show filtered occupations */}
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
                        
                        {/* Custom value option if no matches and search term exists */}
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
                        
                        {/* Show message if search is too short */}
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
                        {[
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
                        ].map((benefit) => (
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
                                <Heart className="w-3 h-3 text-primary" />
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
                    
                    {/* Employment Type Dropdown */}
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
                    
                    {/* Salary Type Dropdown */}
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
                    
                    {/* Salary Transparency Dropdown */}
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
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.positions_count || '1'}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        if (value === '') {
                          handleInputChange('positions_count', '1');
                        } else {
                          const numValue = parseInt(value) || 1;
                          handleInputChange('positions_count', Math.max(1, numValue).toString());
                        }
                      }}
                      onBlur={(e) => {
                        const numValue = parseInt(e.target.value) || 1;
                        handleInputChange('positions_count', Math.max(1, numValue).toString());
                      }}
                      className="bg-white/10 border-white/20 text-white h-9 text-sm focus:border-white/40 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleInputChange('positions_count', Math.max(1, (parseInt(formData.positions_count) || 1) - 1).toString())}
                      className="h-9 w-9 flex items-center justify-center bg-white/10 border border-white/20 rounded-md text-white hover:bg-white/20 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange('positions_count', ((parseInt(formData.positions_count) || 1) + 1).toString())}
                      className="h-9 w-9 flex items-center justify-center bg-white/10 border border-white/20 rounded-md text-white hover:bg-white/20 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Arbetstider (starttid – sluttid) *</Label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formData.work_start_time}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                          const formatted = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
                          handleInputChange('work_start_time', formatted);
                          // Auto-focus end time when start time is complete
                          if (formatted.length === 5) {
                            workEndTimeRef.current?.focus();
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value && !value.includes(':')) {
                            const padded = value.padStart(2, '0') + ':00';
                            handleInputChange('work_start_time', padded);
                          } else if (value && value.includes(':') && value.split(':')[1].length < 2) {
                            const [hours, mins] = value.split(':');
                            handleInputChange('work_start_time', `${hours}:${mins.padEnd(2, '0')}`);
                          }
                        }}
                        placeholder="08:00"
                        maxLength={5}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                      />
                    </div>
                    <span className="text-white/60 text-sm">–</span>
                    <div className="flex-1">
                      <Input
                        ref={workEndTimeRef}
                        type="text"
                        inputMode="numeric"
                        value={formData.work_end_time}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                          const formatted = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
                          handleInputChange('work_end_time', formatted);
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value && !value.includes(':')) {
                            const padded = value.padStart(2, '0') + ':00';
                            handleInputChange('work_end_time', padded);
                          } else if (value && value.includes(':') && value.split(':')[1].length < 2) {
                            const [hours, mins] = value.split(':');
                            handleInputChange('work_end_time', `${hours}:${mins.padEnd(2, '0')}`);
                          }
                        }}
                        placeholder="17:00"
                        maxLength={5}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Step 2: Var finns jobbet? */}
            {currentStep === 1 && (
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
                    
                    {/* Work Location Dropdown */}
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
                    
                    {/* Remote Work Dropdown */}
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
                    placeholder="T.ex. Modulvägen 1"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
                  />
                </div>

                <WorkplacePostalCodeSelector
                  postalCodeValue={formData.workplace_postal_code}
                  cityValue={formData.workplace_city}
                  onPostalCodeChange={handleWorkplacePostalCodeChange}
                  onLocationChange={handleWorkplaceLocationChange}
                  cachedInfo={cachedPostalCodeInfo}
                />
              </div>
            )}

            {/* Step 3: Ansökningsfrågor */}
            {currentStep === 2 && (
              <div className="space-y-3 max-w-2xl mx-auto w-full">
                {!showQuestionForm && !showQuestionTemplates ? (
                  <>
                    {/* Rubrik för automatiska frågor */}
                    <h3 className="text-white text-sm font-medium text-center">
                      Dessa frågor fylls automatiskt från jobbsökarens profil
                    </h3>

                    {/* Automatiska frågor info */}
                    <div className="bg-white/5 rounded-lg p-3 border border-white/20">
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
                ) : showQuestionTemplates ? (
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
                                      className="w-full bg-white/5 backdrop-blur-sm rounded-lg p-2.5 border border-white/10 hover:border-white/20 hover:bg-white/8 flex items-center justify-between gap-2 transition-all duration-200 group"
                                    >
                                      <button
                                        onClick={() => useQuestionTemplate(template)}
                                        className="flex-1 text-left hover:opacity-80 transition-opacity min-w-0"
                                      >
                                        <div className="text-white font-medium text-sm leading-tight truncate">
                                          {template.question_text}
                                        </div>
                                      </button>
                                      <div className="flex items-center gap-0.5 transition-opacity">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingQuestion({
                                              ...template,
                                              template_id: template.id
                                            });
                                            setShowQuestionTemplates(false);
                                            setShowQuestionForm(true);
                                          }}
                                          className="p-1.5 text-white hover:text-white/70 hover:bg-white/10 rounded-full transition-all duration-300 flex-shrink-0"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
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
                                          className="p-1.5 text-white hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-300 flex-shrink-0"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
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
                ) : (
                  /* Question Form */
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
                        className="text-white/70 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {/* Question Type */}
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Frågetyp *</Label>
                        <div className="relative question-type-dropdown">
                          <Input
                            value={questionTypeSearchTerm || (editingQuestion?.question_type ? questionTypes.find(t => t.value === editingQuestion.question_type)?.label || '' : '')}
                            onChange={(e) => handleQuestionTypeSearch(e.target.value)}
                            onClick={handleQuestionTypeClick}
                            placeholder="Välj frågetyp"
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 cursor-pointer focus:border-white/40 focus:ring-0 focus:ring-offset-0"
                            readOnly
                          />
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                          
                          {/* Question Type Dropdown */}
                          {showQuestionTypeDropdown && (
                            <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-48 overflow-y-auto">
                              {filteredQuestionTypes.map((type) => (
                                <button
                                  key={type.value}
                                  type="button"
                                  onClick={() => handleQuestionTypeSelect(type)}
                                  className="w-full px-3 py-2 text-left hover:bg-white/15 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors"
                                >
                                  <span className="font-medium">{type.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rubrik - show for text, yes_no, and number types */}
                      {editingQuestion?.question_type === 'text' && (
                        <div className="space-y-2">
                          <Label className="text-white font-medium">Rubrik *</Label>
                          <Input
                            value={editingQuestion?.question_text || ''}
                            onChange={(e) => updateQuestionField('question_text', e.target.value)}
                            placeholder="T.ex. Beskriv dina erfarenheter inom..."
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm"
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
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm"
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
                              placeholder="T.ex. Antal års erfarenhet inom..."
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm"
                            />
                          </div>
                          
                          {/* Min/Max värden för slider */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-white font-medium">Min värde</Label>
                              <Input
                                type="number"
                                value={editingQuestion?.min_value ?? ''}
                                onChange={(e) => updateQuestionField('min_value', e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="0"
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white font-medium">Max värde</Label>
                              <Input
                                type="number"
                                value={editingQuestion?.max_value ?? ''}
                                onChange={(e) => updateQuestionField('max_value', e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="100"
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Rubrik for multiple choice */}
                      {editingQuestion?.question_type === 'multiple_choice' && (
                        <div className="space-y-2">
                          <Label className="text-white font-medium">Rubrik *</Label>
                          <Input
                            value={editingQuestion?.question_text || ''}
                            onChange={(e) => updateQuestionField('question_text', e.target.value)}
                            placeholder="T.ex. Vilka behörigheter har du?"
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm"
                          />
                        </div>
                      )}

                      {editingQuestion?.question_type === 'multiple_choice' && (
                        <div className="space-y-2">
                          <Label className="text-white font-medium text-sm">Svarsalternativ</Label>
                          <div className="space-y-1.5">
                            {(editingQuestion.options || []).map((option, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(index, e.target.value)}
                                  placeholder={`Alternativ ${index + 1}`}
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-8 text-sm flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(index)}
                                  className="p-1.5 text-white hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-300 flex-shrink-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              onClick={addOption}
                              size="sm"
                              className="bg-white/10 border border-white/30 text-white hover:bg-white/20 md:hover:bg-white/20 px-4 py-1.5 transition-all duration-300 mt-2"
                            >
                              Lägg till alternativ
                              <Plus className="h-3.5 w-3.5 ml-1.5" />
                            </Button>
                          </div>
                        </div>
                      )}



                      {/* Required Toggle */}
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={editingQuestion?.is_required || false}
                          onCheckedChange={(checked) => updateQuestionField('is_required', checked)}
                        />
                        <Label className="text-white font-medium">Obligatorisk fråga</Label>
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end pt-4">
                        <Button
                          onClick={saveCustomQuestion}
                          disabled={!editingQuestion?.question_text?.trim()}
                          className="bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 touch-border-white transition-all duration-300 focus:outline-none"
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
              <div className="space-y-6 max-w-4xl mx-auto w-full">
                {/* Preview Mode Toggle - iOS Style like ProfilePreview */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative inline-flex bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20">
                    {/* Sliding background */}
                    <motion.div
                      className="absolute top-1 bottom-1 bg-white/20 rounded-md"
                      initial={false}
                      animate={{
                        left: previewMode === 'mobile' ? '4px' : '50%',
                        width: previewMode === 'mobile' ? 'calc(50% - 4px)' : 'calc(50% - 4px)',
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                    
                    {/* Buttons */}
                    <button
                      type="button"
                      onClick={() => setPreviewMode('mobile')}
                      className="relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-md transition-colors text-sm text-white hover:text-white/70"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Mobilvy
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('desktop')}
                      className="relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-md transition-colors text-sm text-white hover:text-white/70"
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      Datorvy
                    </button>
                  </div>
                  
                  <h3 
                    className="text-white font-medium text-center text-sm cursor-pointer hover:text-white/80 transition-colors underline underline-offset-2"
                    onClick={() => previewMode === 'mobile' ? setShowApplicationForm(true) : setShowDesktopApplicationForm(true)}
                  >
                    {previewMode === 'mobile' 
                      ? 'Testa att trycka här eller på mobilens skärm'
                      : 'Testa att trycka här eller på datorns skärm'
                    }
                  </h3>
                </div>

                {/* Mobile Preview */}
                {previewMode === 'mobile' && (
                <div className="flex flex-col items-center space-y-4">
                   {/* Phone mockup med ansökningsformulär + tooltip */}
                  <div className="relative flex items-center justify-center gap-4 scale-90 sm:scale-100">
                    
                    <section aria-label="Mobilansökningsformulär förhandsvisning" className="relative w-[160px] h-[320px]">
                    {/* Tooltip framför mobilen som pekar på företagsnamnet + X-knapp */}
                    {showCompanyTooltip && showApplicationForm && isScrolledTop && (
                      <>
                        {/* Left tooltip (company name) */}
                        <div className="pointer-events-none absolute z-[999] top-14 -left-[115px] flex items-center gap-1">
                          <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                            Obs, tryck här!
                          </div>
                          <svg width="20" height="16" viewBox="0 0 40 24" className="text-white" style={{ overflow: 'visible' }}>
                            <defs>
                              <marker id="arrowheadRight_wiz" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
                                <polygon points="0 0, 12 6, 0 12" fill="currentColor" />
                              </marker>
                            </defs>
                            <path d="M2 12 L 38 12" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrowheadRight_wiz)" />
                          </svg>
                        </div>
                        {/* Right tooltip (X button) - outside the phone */}
                        <div className="pointer-events-none absolute z-[999] top-4 -right-[115px] flex items-center gap-1">
                          <svg width="20" height="16" viewBox="0 0 40 24" className="text-white" style={{ overflow: 'visible' }}>
                            <defs>
                              <marker id="arrowheadLeft_ext_2" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
                                <polygon points="0 0, 12 6, 0 12" fill="currentColor" />
                              </marker>
                            </defs>
                            <path d="M38 12 L 2 12" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrowheadLeft_ext_2)" />
                          </svg>
                          <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                            Obs, tryck här!
                          </div>
                        </div>
                      </>
                    )}
                    {/* iPhone-stil telefonram */}
                    <div className="relative w-full h-full rounded-[2rem] bg-black p-1 shadow-xl">
                      {/* Skärm */}
                      <div className="relative w-full h-full rounded-[1.6rem] overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}>
                        {/* iPhone notch */}
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 h-1 w-8 rounded-full bg-black border border-gray-800"></div>

                        {/* Mobilansökningsformulär med korrekt Parium bakgrund */}
                        <div className="absolute inset-0 rounded-[1.6rem] overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}>
                          
                           {/* Form container (toggle) */}
                           <div className={showApplicationForm ? 'flex flex-col h-full' : 'hidden'}>
                             <div className="flex items-center justify-between px-2 py-1.5 pt-2 bg-black/20 border-b border-white/20 relative z-10 flex-shrink-0 rounded-t-[1.6rem]">
                               <div className="text-xs font-bold text-white">Ansökningsformulär</div>
                               <div className="relative">
                                 {showCompanyTooltip && isScrolledTop && (
                                   <div className="pointer-events-none absolute z-[999] top-0 -right-28 flex items-center gap-1">
                                     <svg width="20" height="12" viewBox="0 0 48 28" className="text-white">
                                       <path d="M46 14 Q 24 0, 2 14" stroke="currentColor" strokeWidth="2" fill="none" markerEnd="url(#arrowheadLeft2)" />
                                       <defs>
                                         <marker id="arrowheadLeft2" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                                           <polygon points="6 0, 0 3, 6 6" fill="currentColor" />
                                         </marker>
                                       </defs>
                                     </svg>
                                     <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                                       Obs, tryck här!
                                     </div>
                                   </div>
                                 )}
                                 <button onClick={() => setShowApplicationForm(false)} className="text-xs text-white hover:text-white" aria-label="Stäng ansökningsformulär">✕</button>
                               </div>
                             </div>

                             {/* Scrollable content */}
                             <div 
                               className="px-2 py-2 overflow-y-auto relative z-10 custom-scrollbar flex-1 overscroll-contain"
                               style={{ background: 'transparent' }}
                               onClick={(e) => {
                                 // Close all dropdowns when clicking anywhere in the scroll area
                                 const dropdowns = e.currentTarget.querySelectorAll('.backdrop-blur-xl.border.border-white\\/20');
                                 dropdowns.forEach(dropdown => {
                                   if (!dropdown.classList.contains('hidden')) {
                                     dropdown.classList.add('hidden');
                                   }
                                 });
                               }}
                               onScroll={(e) => {
                                 const target = e.currentTarget;
                                 setIsScrolledTop(target.scrollTop === 0);
                               }}
                             >
                              <div className="space-y-1.5 pb-2">{/* Minimal botten-padding */}
                               
                                  {/* Företagsinformation */}
                                  <div className="bg-white/10 rounded-lg p-1.5 border border-white/20 relative">
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
                                       onClick={() => {
                                         setShowCompanyProfile(true);
                                       }}
                                       className="text-xs font-bold text-white hover:text-white/70 transition-colors cursor-pointer whitespace-normal break-words leading-tight"
                                     >
                                       {profile?.company_name || 'Företagsnamn'}
                                     </button>
                                   </div>
                                  </div>

                                 {/* Yrke */}
                                 {formData.occupation && (
                                    <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                     <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
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

                                 {/* Jobbeskrivning */}
                                 {formData.description && (
                                   <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                     <h5 className="text-xs font-medium text-white mb-0.5">Jobbeskrivning</h5>
                                     <div className="text-xs text-white leading-relaxed whitespace-pre-wrap break-words [&>*]:mb-0.5 [&>*:last-child]:mb-0">
                                      {formData.description.split('\n').map((line, index) => {
                                        const trimmedLine = line.trim();
                                        // Detect bullet points (•, -, *, numbers with dots/parentheses)
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

                               {/* Lön */}
                               {(formData.salary_min || formData.salary_max || formData.salary_type) && (
                                  <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                    <h5 className="text-xs font-medium text_white mb-0.5 flex items-center">
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

                               {/* Lönetransparens (EU 2026) */}
                               {formData.salary_transparency && formatSalaryTransparency() && (
                                  <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                    <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                       <Banknote className="h-2 w-2 mr-1 text-white" />
                                       Lönetransparens
                                     </h5>
                                     <div className="text-xs text-white leading-relaxed break-words">
                                       <div className="font-medium">{formatSalaryTransparency()}</div>
                                     </div>
                                 </div>
                               )}


                                 {/* Arbetsplats */}
                                 <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                   <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
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
                                           <div>
                                             {formData.workplace_postal_code} {formData.workplace_city}{formData.workplace_county ? `, ${formData.workplace_county}` : ''}
                                           </div>
                                         ) : formData.workplace_city ? (
                                           <div>
                                             {formData.workplace_city}{formData.workplace_county ? `, ${formData.workplace_county}` : ''}
                                           </div>
                                         ) : (
                                           <div>{formData.workplace_postal_code}</div>
                                         )}
                                         <div>{getWorkLocationDisplayText()}</div>
                                       </div>
                                     )}
                                   </div>
                                  </div>

                                   {/* Antal rekryteringar */}
                                   {formData.positions_count && parseInt(formData.positions_count) > 0 && (
                                     <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                       <h5 className="text-xs font-medium text-white mb-0.5 flex items-center whitespace-nowrap">
                                         <Users className="h-2 w-2 mr-1 text-white" />
                                         Antal rekryteringar
                                       </h5>
                                        <div className="text-xs text-white leading-relaxed break-words">
                                          <div className="font-medium">{formatPositionsCount()}</div>
                                        </div>
                                     </div>
                                   )}

                                   {/* Arbetstider */}
                                   {(formData.work_start_time || formData.work_end_time) && (
                                     <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                       <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                         <Clock className="h-2 w-2 mr-1 text-white" />
                                         Arbetstider
                                       </h5>
                                       <div className="text-xs text-white leading-relaxed break-words">
                                         <div className="font-medium">
                                           {formData.work_start_time && formData.work_end_time 
                                             ? `${formData.work_start_time} – ${formData.work_end_time}`
                                             : formData.work_start_time || formData.work_end_time}
                                         </div>
                                       </div>
                                     </div>
                                   )}

                                   {/* Förmåner */}
                                   {formData.benefits && formData.benefits.length > 0 && (
                                     <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                       <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                         <Heart className="h-2 w-2 mr-1 text-white" />
                                         Förmåner
                                       </h5>
                                       <div className="text-xs text-white leading-relaxed break-words space-y-0.5">
                                         {formData.benefits.map((benefit, idx) => (
                                           <div key={idx} className="flex items-start">
                                             <span className="flex-shrink-0 mr-1">•</span>
                                             <span>{benefit}</span>
                                           </div>
                                         ))}
                                       </div>
                                     </div>
                                   )}

                                 {/* Kontakt */}
                                <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                   <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
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

                              {/* Krav och kvalifikationer */}
                              {formData.requirements && (
                                 <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                   <h4 className="text-xs font-semibold text-white mb-0.5">Kvalifikationer</h4>
                                   <p className="text-xs text-white leading-relaxed">
                                    {formData.requirements.length > 100 
                                      ? formData.requirements.substring(0, 100) + '...' 
                                      : formData.requirements
                                    }
                                  </p>
                                </div>
                              )}

                               {/* Följande information samlas automatiskt in från alla kandidater */}
                                <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                  <p className="text-xs text-white mb-2 leading-relaxed">
                                    Följande information samlas automatiskt in från alla kandidater som har sökt:
                                  </p>
                                  
                                  <div className="space-y-1">
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
                                       <div key={question.id || index} className="bg-white/10 rounded-lg p-2 border border-white/20">
                                         {/* Frågetext */}
                                         <div className="mb-1.5">
                                           <label className="text-xs font-medium text-white block leading-tight">
                                             {question.question_text}
                                           </label>
                                         </div>
                                        
                                         {/* Input förhandsvisning baserat på frågetyp */}
                                          {question.question_type === 'text' && (
                                           <textarea
                                             className="w-full border border-white/20 bg-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/60 resize-none focus:outline-none focus:border-white/40"
                                             placeholder={question.placeholder_text || 'Skriv ditt svar...'}
                                             rows={2}
                                             value={previewAnswers[question.id || `q_${index}`] || ''}
                                             onChange={(e) => setPreviewAnswers((prev) => ({ ...prev, [question.id || `q_${index}`]: e.target.value }))}
                                           />
                                         )}
                                        
                                        {question.question_type === 'yes_no' && (
                                          <div className="flex gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPreviewAnswers((prev) => {
                                                  const key = question.id || `q_${index}`;
                                                  const current = prev[key];
                                                  return {
                                                    ...prev,
                                                    [key]: current === 'yes' ? '' : 'yes',
                                                  };
                                                })
                                              }
                                              className={
                                              (previewAnswers[question.id || `q_${index}`] === 'yes'
                                                   ? 'bg-secondary/40 border-secondary text-white '
                                                   : 'bg-white/10 border-white/20 text-white ') +
                                                 'border rounded-md px-1.5 py-0.5 text-xs transition-colors font-medium flex-1'
                                              }
                                            >
                                              Ja
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPreviewAnswers((prev) => {
                                                  const key = question.id || `q_${index}`;
                                                  const current = prev[key];
                                                  return {
                                                    ...prev,
                                                    [key]: current === 'no' ? '' : 'no',
                                                  };
                                                })
                                              }
                                              className={
                                              (previewAnswers[question.id || `q_${index}`] === 'no'
                                                   ? 'bg-secondary/40 border-secondary text-white '
                                                   : 'bg-white/10 border-white/20 text-white ') +
                                                 'border rounded-md px-1.5 py-0.5 text-xs transition-colors font-medium flex-1'
                                              }
                                            >
                                              Nej
                                            </button>
                                          </div>
                                        )}
                                        
                                        {question.question_type === 'multiple_choice' && (
                                          <div className="space-y-1.5">
                                            {question.options?.filter(opt => opt.trim() !== '').map((option, optIndex) => {
                                              const selectedAnswers = previewAnswers[question.id || `q_${index}`];
                                              const answersArray = typeof selectedAnswers === 'string' 
                                                ? selectedAnswers.split('|||') 
                                                : [];
                                              const selected = answersArray.includes(option);
                                              
                                              return (
                                                <button
                                                  key={optIndex}
                                                  type="button"
                                                  onClick={() => {
                                                    setPreviewAnswers((prev) => {
                                                      const currentAnswers = prev[question.id || `q_${index}`];
                                                      const answersArray = typeof currentAnswers === 'string'
                                                        ? currentAnswers.split('|||').filter(a => a)
                                                        : [];
                                                      
                                                      const newAnswers = answersArray.includes(option)
                                                        ? answersArray.filter(a => a !== option)
                                                        : [...answersArray, option];
                                                      
                                                      return {
                                                        ...prev,
                                                        [question.id || `q_${index}`]: newAnswers.join('|||'),
                                                      };
                                                    });
                                                  }}
                                                  className={`w-full flex items-center gap-2 p-1.5 rounded-lg border transition-all ${
                                                    selected
                                                      ? 'bg-secondary/40 border-secondary'
                                                      : 'bg-white/10 border-white/20 hover:bg-white/15'
                                                  }`}
                                                >
                                                  <div className={`w-1.5 h-1.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                                    selected ? 'border-secondary bg-secondary' : 'border-white/40'
                                                  }`} />
                                                  <span className="text-xs text-white text-left flex-1">{option}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                        
                                        {question.question_type === 'number' && (
                                          <div className="space-y-1.5">
                                            <div className="text-center text-sm font-semibold text-white">
                                              {previewAnswers[question.id || `q_${index}`] || question.min_value || 0}
                                            </div>
                                            <input
                                              type="range"
                                              min={question.min_value ?? 0}
                                              max={question.max_value ?? 100}
                                              value={previewAnswers[question.id || `q_${index}`] || question.min_value || 0}
                                              className="w-full h-1 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                                              style={{
                                                background: `linear-gradient(to right, white ${((Number(previewAnswers[question.id || `q_${index}`] || question.min_value || 0) - (question.min_value ?? 0)) / ((question.max_value ?? 100) - (question.min_value ?? 0))) * 100}%, rgba(255,255,255,0.3) ${((Number(previewAnswers[question.id || `q_${index}`] || question.min_value || 0) - (question.min_value ?? 0)) / ((question.max_value ?? 100) - (question.min_value ?? 0))) * 100}%)`
                                              }}
                                              onChange={(e) => setPreviewAnswers((prev) => ({ ...prev, [question.id || `q_${index}`]: e.target.value }))}
                                            />
                                          </div>
                                        )}
                                        
                                        {question.question_type === 'date' && (
                                          <input
                                            type="date"
                                            className="w-full border border-white/20 bg-white/10 rounded p-2 text-sm text-white placeholder:text-white/60 h-9 focus:outline-none focus:border-white/40"
                                            value={previewAnswers[question.id || `q_${index}`] || ''}
                                            onChange={(e) => setPreviewAnswers((prev) => ({ ...prev, [question.id || `q_${index}`]: e.target.value }))}
                                          />
                                        )}
                                        
                                        {(question.question_type === 'file' || question.question_type === 'video') && (
                                          <div className="border-2 border-dashed border-white/30 rounded p-2 text-center bg-white/5">
                                            {question.question_type === 'file' ? (
                                              <FileText className="h-3 w-3 mx-auto mb-0.5 text-white/60" />
                                            ) : (
                                              <Video className="h-3 w-3 mx-auto mb-0.5 text-white/60" />
                                            )}
                                            <p className="text-sm text-white/60">
                                              {question.question_type === 'file' ? 'Välj fil' : 'Spela in video'}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Extra space borttaget för tätare layout */}
                            </div>
                          </div>
                        </div>
                        </div>

                        {/* Ad view when form is closed */}
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
                              className="absolute inset-0 flex flex-col items-center pt-10 p-3 text-white text-center cursor-pointer overflow-y-auto overscroll-contain"
                              onClick={() => setShowApplicationForm(true)}
                            >
              {(() => {
                const textSizes = getSmartTextSizes();
                return (
                  <>
                    <button 
                      onClick={() => setShowCompanyProfile(true)}
                      className={`${textSizes.company} text-white font-medium mb-1 hover:text-white/70 transition-colors cursor-pointer text-left line-clamp-1`}
                    >
                      {profile?.company_name || 'Företag'}
                    </button>
                    <TruncatedText 
                      text={getDisplayTitle()} 
                      className={`${textSizes.title} text-white font-bold leading-tight mb-1 line-clamp-5 w-full max-w-full cursor-pointer`}
                      alwaysShowTooltip="desktop-only"
                    />
                    <div className={`${textSizes.meta} text-white`}>
                      {getMetaLine(formData.employment_type, formData.workplace_city || formData.location, formData.workplace_county)}
                    </div>
                  </>
                );
              })()}
                            </div>
                            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 pointer-events-none">
                              <button onClick={() => setShowApplicationForm(true)} aria-label="Nej tack" className="w-6 h-6 rounded-full bg-red-500 shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors pointer-events-auto">
                                <X className="h-3 w-3 text-white" />
                              </button>
                              <button onClick={() => setShowApplicationForm(true)} aria-label="Spara" className="w-6 h-6 rounded-full bg-blue-500 shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors pointer-events-auto">
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
                )}

                {/* Desktop Preview - Monitor mockup EXACTLY like ProfilePreview */}
                {previewMode === 'desktop' && (
                  <div className="flex flex-col items-center space-y-4">
                    {/* Desktop monitor frame - professional mockup */}
                    <div className="relative">
                      {/* Monitor screen */}
                      <div className="relative w-[520px] rounded-t-lg bg-black p-2.5 shadow-2xl">
                        {/* Screen bezel - 16:10 realistisk modern monitorratio */}
                        <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-black border-2 border-gray-800">
                          {/* Innehåll med Parium bakgrund */}
                          <div 
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}
                          >
                            {/* Application Form View (when clicked) - IDENTICAL to mobile */}
                            {showDesktopApplicationForm && (
                              <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between px-4 py-2 bg-black/20 border-b border-white/20 flex-shrink-0">
                                  <div className="text-sm font-bold text-white">Ansökningsformulär</div>
                                  <div className="flex items-center gap-2">
                                    {/* Tooltip pointing at X button */}
                                    {showCompanyTooltip && (
                                      <div className="pointer-events-none flex items-center gap-1">
                                        <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                                          Obs, tryck här!
                                        </div>
                                        <svg width="16" height="12" viewBox="0 0 40 24" className="text-white" style={{ overflow: 'visible' }}>
                                          <defs>
                                            <marker id="arrowheadRight_desktop_x" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
                                              <polygon points="0 0, 12 6, 0 12" fill="currentColor" />
                                            </marker>
                                          </defs>
                                          <path d="M2 12 L 38 12" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrowheadRight_desktop_x)" />
                                        </svg>
                                      </div>
                                    )}
                                    <button 
                                      onClick={() => setShowDesktopApplicationForm(false)} 
                                      className="text-sm text-white hover:text-white"
                                      aria-label="Stäng ansökningsformulär"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                <div className="px-4 py-3 overflow-y-auto flex-1 custom-scrollbar overscroll-contain">
                                  <div className="space-y-2">
                                    {/* Företagsinformation */}
                                    <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                          {profile?.company_logo_url ? (
                                            <div className="w-5 h-5 rounded-full mr-2 overflow-hidden bg-white/10 flex items-center justify-center">
                                              <img 
                                                src={profile.company_logo_url} 
                                                alt="Företagslogotyp" 
                                                className="w-full h-full object-contain"
                                              />
                                            </div>
                                          ) : (
                                            <div className="w-5 h-5 bg-primary/20 rounded-full mr-2 flex items-center justify-center">
                                              <Building2 className="h-3 w-3 text-primary-foreground" />
                                            </div>
                                          )}
                                          <button 
                                            onClick={() => setShowCompanyProfile(true)}
                                            className="text-sm font-bold text-white hover:text-white/70 transition-colors cursor-pointer"
                                          >
                                            {profile?.company_name || 'Företagsnamn'}
                                          </button>
                                        </div>
                                        {/* Tooltip pointing left at company name */}
                                        {showCompanyTooltip && (
                                          <div className="pointer-events-none flex items-center gap-1">
                                            <svg width="16" height="12" viewBox="0 0 40 24" className="text-white" style={{ overflow: 'visible' }}>
                                              <defs>
                                                <marker id="arrowheadLeft_desktop_company" markerWidth="12" markerHeight="12" refX="3" refY="6" orient="auto-start-reverse">
                                                  <polygon points="0 0, 12 6, 0 12" fill="currentColor" />
                                                </marker>
                                              </defs>
                                              <path d="M38 12 L 2 12" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrowheadLeft_desktop_company)" />
                                            </svg>
                                            <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                                              Obs, tryck här!
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Yrke */}
                                    {formData.occupation && (
                                      <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                        <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                          <Briefcase className="h-3 w-3 mr-1 text-white" />
                                          Yrke
                                        </h5>
                                        <p className="text-xs text-white">{formData.occupation}</p>
                                      </div>
                                    )}

                                    {/* Jobbeskrivning - visa hela som på mobil */}
                                    {formData.description && (
                                      <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                        <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                          <FileText className="h-3 w-3 mr-1 text-white" />
                                          Jobbeskrivning
                                        </h5>
                                        <div className="text-xs text-white leading-relaxed break-words">
                                          {formData.description.split('\n').map((line, index) => {
                                            const trimmedLine = line.trim();
                                            const bulletMatch = trimmedLine.match(/^([•\-\*])\s*(.*)$/);
                                            
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

                                    {/* Lön - samma som mobil */}
                                    {(formData.salary_min || formData.salary_max || formData.salary_type) && (
                                      <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                        <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                          <Banknote className="h-3 w-3 mr-1 text-white" />
                                          Lön
                                        </h5>
                                        <div className="text-xs text-white space-y-0.5">
                                          {formatSalaryInfo().map((info, index) => (
                                            <div key={index} className="font-medium">{info}</div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Lönetransparens (EU 2026) - samma som mobil */}
                                    {formData.salary_transparency && formatSalaryTransparency() && (
                                      <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                        <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                          <Banknote className="h-3 w-3 mr-1 text-white" />
                                          Lönetransparens
                                        </h5>
                                        <div className="text-xs text-white">
                                          <div className="font-medium">{formatSalaryTransparency()}</div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Arbetsplats - samma som mobil */}
                                    <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                      <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                        <MapPin className="h-3 w-3 mr-1 text-white" />
                                        Arbetsplats
                                      </h5>
                                      <div className="text-xs text-white space-y-0.5">
                                        {formData.workplace_name && (
                                          <div className="font-medium">{formData.workplace_name}</div>
                                        )}
                                        {formData.workplace_address && (
                                          <div>{formData.workplace_address}</div>
                                        )}
                                        {(formData.workplace_postal_code || formData.workplace_city) && (
                                          <div>
                                            {formData.workplace_postal_code && formData.workplace_city ? (
                                              <div>
                                                {formData.workplace_postal_code} {formData.workplace_city}{formData.workplace_county ? `, ${formData.workplace_county}` : ''}
                                              </div>
                                            ) : formData.workplace_city ? (
                                              <div>
                                                {formData.workplace_city}{formData.workplace_county ? `, ${formData.workplace_county}` : ''}
                                              </div>
                                            ) : (
                                              <div>{formData.workplace_postal_code}</div>
                                            )}
                                            <div>{getWorkLocationDisplayText()}</div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Antal rekryteringar */}
                                    {formData.positions_count && parseInt(formData.positions_count) > 0 && (
                                      <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                        <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                          <Users className="h-3 w-3 mr-1 text-white" />
                                          Antal rekryteringar
                                        </h5>
                                        <div className="text-xs text-white">
                                          <div className="font-medium">{formatPositionsCount()}</div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Arbetstider */}
                                    {(formData.work_start_time || formData.work_end_time) && (
                                      <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                        <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                          <Clock className="h-3 w-3 mr-1 text-white" />
                                          Arbetstider
                                        </h5>
                                        <div className="text-xs text-white">
                                          <div className="font-medium">
                                            {formData.work_start_time && formData.work_end_time 
                                              ? `${formData.work_start_time} – ${formData.work_end_time}`
                                              : formData.work_start_time || formData.work_end_time}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Förmåner */}
                                    {formData.benefits && formData.benefits.length > 0 && (
                                      <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                        <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                          <Heart className="h-3 w-3 mr-1 text-white" />
                                          Förmåner
                                        </h5>
                                        <div className="text-xs text-white space-y-0.5">
                                          {formData.benefits.map((benefit, idx) => (
                                            <div key={idx} className="flex items-start">
                                              <span className="flex-shrink-0 mr-1">•</span>
                                              <span>{benefit}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Kontakt */}
                                    <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                      <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                        <Mail className="h-3 w-3 mr-1 text-white" />
                                        Kontakt
                                      </h5>
                                      <div className="text-xs text-white">
                                        {formData.contact_email && (
                                          <a 
                                            href={`mailto:${formData.contact_email}`}
                                            className="text-blue-300 font-medium break-all hover:text-blue-200 underline cursor-pointer"
                                          >
                                            {formData.contact_email}
                                          </a>
                                        )}
                                      </div>
                                    </div>

                                    {/* Krav - visa hela som på mobil */}
                                    {formData.requirements && (
                                      <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                        <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                          <CheckSquare className="h-3 w-3 mr-1 text-white" />
                                          Kvalifikationer
                                        </h5>
                                        <p className="text-xs text-white whitespace-pre-wrap leading-relaxed">
                                          {formData.requirements}
                                        </p>
                                      </div>
                                    )}

                                    {/* Följande information samlas automatiskt in */}
                                    <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                      <p className="text-xs text-white mb-1.5 leading-relaxed">
                                        Följande information samlas automatiskt in från alla kandidater som har sökt:
                                      </p>
                                      <div className="space-y-0.5">
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
                                            <span className="flex-1 text-white leading-tight">{label}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Anpassade frågor - visa alla individuellt som på mobil */}
                                    {customQuestions.length > 0 && (
                                      <div className="space-y-1.5">
                                        {customQuestions.map((question, index) => {
                                          const typeLabels: Record<string, string> = {
                                            number: 'Siffra',
                                            text: 'Text',
                                            multiple_choice: 'Flerval',
                                            yes_no: 'Ja/Nej',
                                            date: 'Datum',
                                            file: 'Fil',
                                            video: 'Video',
                                          };

                                          return (
                                            <div key={question.id || index} className="bg-white/10 rounded-lg p-2 border border-white/20">
                                              {/* Frågetext */}
                                              <div className="mb-1.5">
                                                <label className="text-xs font-medium text-white block leading-tight">
                                                  {question.question_text}
                                                </label>
                                              </div>
                                             
                                              {/* Input förhandsvisning baserat på frågetyp */}
                                              {question.question_type === 'text' && (
                                                <textarea
                                                  className="w-full border border-white/20 bg-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/60 resize-none focus:outline-none focus:border-white/40"
                                                  placeholder={question.placeholder_text || 'Skriv ditt svar...'}
                                                  rows={2}
                                                  value={desktopPreviewAnswers[question.id || `q_${index}`] || ''}
                                                  onChange={(e) => setDesktopPreviewAnswers((prev) => ({ ...prev, [question.id || `q_${index}`]: e.target.value }))}
                                                />
                                              )}
                                             
                                              {question.question_type === 'yes_no' && (
                                                <div className="flex gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setDesktopPreviewAnswers((prev) => {
                                                        const key = question.id || `q_${index}`;
                                                        const current = prev[key];
                                                        return {
                                                          ...prev,
                                                          [key]: current === 'yes' ? '' : 'yes',
                                                        };
                                                      })
                                                    }
                                                    className={
                                                    (desktopPreviewAnswers[question.id || `q_${index}`] === 'yes'
                                                         ? 'bg-secondary/40 border-secondary text-white '
                                                         : 'bg-white/10 border-white/20 text-white ') +
                                                       'border rounded-md px-1.5 py-0.5 text-xs transition-colors font-medium flex-1'
                                                    }
                                                  >
                                                    Ja
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setDesktopPreviewAnswers((prev) => {
                                                        const key = question.id || `q_${index}`;
                                                        const current = prev[key];
                                                        return {
                                                          ...prev,
                                                          [key]: current === 'no' ? '' : 'no',
                                                        };
                                                      })
                                                    }
                                                    className={
                                                    (desktopPreviewAnswers[question.id || `q_${index}`] === 'no'
                                                         ? 'bg-secondary/40 border-secondary text-white '
                                                         : 'bg-white/10 border-white/20 text-white ') +
                                                       'border rounded-md px-1.5 py-0.5 text-xs transition-colors font-medium flex-1'
                                                    }
                                                  >
                                                    Nej
                                                  </button>
                                                </div>
                                              )}
                                             
                                              {question.question_type === 'multiple_choice' && (
                                                <div className="space-y-1">
                                                  <p className="text-[10px] text-white/60 mb-1">Alternativ:</p>
                                                  <div className="space-y-1 options-scroll">
                                                    {question.options?.filter(opt => opt.trim() !== '').map((option, optIndex) => {
                                                      const selectedAnswers = desktopPreviewAnswers[question.id || `q_${index}`];
                                                      const answersArray = typeof selectedAnswers === 'string' 
                                                        ? selectedAnswers.split('|||') 
                                                        : [];
                                                      const selected = answersArray.includes(option);
                                                      
                                                      return (
                                                        <button
                                                          key={optIndex}
                                                          type="button"
                                                          onClick={() => {
                                                            setDesktopPreviewAnswers((prev) => {
                                                              const currentAnswers = prev[question.id || `q_${index}`];
                                                              const answersArray = typeof currentAnswers === 'string'
                                                                ? currentAnswers.split('|||').filter(a => a)
                                                                : [];
                                                              
                                                              if (answersArray.includes(option)) {
                                                                const newAnswers = answersArray.filter(a => a !== option);
                                                                return {
                                                                  ...prev,
                                                                  [question.id || `q_${index}`]: newAnswers.join('|||'),
                                                                };
                                                              } else {
                                                                return {
                                                                  ...prev,
                                                                  [question.id || `q_${index}`]: [...answersArray, option].join('|||'),
                                                                };
                                                              }
                                                            });
                                                          }}
                                                          className={
                                                            (selected
                                                              ? 'bg-secondary/40 border-secondary '
                                                              : 'bg-white/10 border-white/20 ') +
                                                            'text-white w-full flex items-center gap-2 rounded px-2 py-1 border transition-colors hover:bg-white/15'
                                                          }
                                                        >
                                                          <div className={
                                                            selected
                                                              ? 'w-1.5 h-1.5 rounded-full border border-secondary bg-secondary flex-shrink-0'
                                                              : 'w-1.5 h-1.5 rounded-full border border-white/40 flex-shrink-0'
                                                          } />
                                                          <span className="text-xs text-white">{option}</span>
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                             
                                              {question.question_type === 'number' && (
                                                <div className="space-y-1.5">
                                                  <div className="text-center text-sm font-semibold text-white">
                                                    {desktopPreviewAnswers[question.id || `q_${index}`] || question.min_value || 0}
                                                  </div>
                                                  <input
                                                    type="range"
                                                    min={question.min_value ?? 0}
                                                    max={question.max_value ?? 100}
                                                    value={desktopPreviewAnswers[question.id || `q_${index}`] || question.min_value || 0}
                                                    className="w-full h-1 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                                                    style={{
                                                      background: `linear-gradient(to right, white ${((Number(desktopPreviewAnswers[question.id || `q_${index}`] || question.min_value || 0) - (question.min_value ?? 0)) / ((question.max_value ?? 100) - (question.min_value ?? 0))) * 100}%, rgba(255,255,255,0.3) ${((Number(desktopPreviewAnswers[question.id || `q_${index}`] || question.min_value || 0) - (question.min_value ?? 0)) / ((question.max_value ?? 100) - (question.min_value ?? 0))) * 100}%)`
                                                    }}
                                                    onChange={(e) => setDesktopPreviewAnswers((prev) => ({ ...prev, [question.id || `q_${index}`]: e.target.value }))}
                                                  />
                                                </div>
                                              )}
                                             
                                              {question.question_type === 'date' && (
                                                <input
                                                  type="date"
                                                  className="w-full border border-white/20 bg-white/10 rounded p-2 text-sm text-white placeholder:text-white/60 h-9 focus:outline-none focus:border-white/40"
                                                  value={desktopPreviewAnswers[question.id || `q_${index}`] || ''}
                                                  onChange={(e) => setDesktopPreviewAnswers((prev) => ({ ...prev, [question.id || `q_${index}`]: e.target.value }))}
                                                />
                                              )}
                                             
                                              {(question.question_type === 'file' || question.question_type === 'video') && (
                                                <div className="border-2 border-dashed border-white/30 rounded p-2 text-center bg-white/5">
                                                  {question.question_type === 'file' ? (
                                                    <FileText className="h-3 w-3 mx-auto mb-0.5 text-white/60" />
                                                  ) : (
                                                    <Video className="h-3 w-3 mx-auto mb-0.5 text-white/60" />
                                                  )}
                                                  <p className="text-sm text-white/60">
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
                            )}

                            {/* Tinder-style Card View (initial) - IDENTICAL to mobile */}
                            {!showDesktopApplicationForm && (
                              <div className="absolute inset-0 z-10">
                                {/* Job Image - ONLY use desktop image, no fallback */}
                                {jobImageDesktopDisplayUrl ? (
                                  <img
                                    src={jobImageDesktopDisplayUrl}
                                    alt={`Jobbbild för ${formData.title}`}
                                    className="absolute inset-0 w-full h-full object-cover select-none"
                                    loading="eager"
                                    decoding="async"
                                  />
                                ) : null}
                                
                                {/* Gradient overlay */}
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                
                                {/* Content - clickable to show form */}
                                <div 
                                  className="absolute inset-0 flex flex-col items-center justify-center p-4 pb-16 text-white text-center cursor-pointer"
                                  onClick={() => setShowDesktopApplicationForm(true)}
                                >
                                  {/* Company name at top */}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setShowCompanyProfile(true); }}
                                    className="text-sm text-white font-medium mb-1 hover:text-white/70 transition-colors cursor-pointer line-clamp-1"
                                  >
                                    {profile?.company_name || 'Företag'}
                                  </button>
                                  
                                  {/* Job title */}
                                  <TruncatedText 
                                    text={formData.title || 'Jobbtitel'} 
                                    className="text-xl font-bold text-white leading-tight mb-1 line-clamp-3 w-full max-w-full cursor-pointer"
                                    alwaysShowTooltip="desktop-only"
                                  />
                                  
                                  {/* Meta line: employment type • location, county */}
                                  <div className="text-sm text-white">
                                    {getMetaLine(formData.employment_type, formData.workplace_city || formData.location, formData.workplace_county)}
                                  </div>
                                </div>
                                
                                {/* Action buttons at bottom - smaller for realism */}
                                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 pointer-events-none">
                                  <button 
                                    onClick={() => setShowDesktopApplicationForm(true)}
                                    aria-label="Nej tack" 
                                    className="w-7 h-7 rounded-full bg-red-500 shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors pointer-events-auto"
                                  >
                                    <X className="h-3.5 w-3.5 text-white" />
                                  </button>
                                  <button 
                                    onClick={() => setShowDesktopApplicationForm(true)}
                                    aria-label="Spara" 
                                    className="w-7 h-7 rounded-full bg-blue-500 shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors pointer-events-auto"
                                  >
                                    <Bookmark className="h-3.5 w-3.5 text-white" />
                                  </button>
                                  <button 
                                    onClick={() => setShowDesktopApplicationForm(true)} 
                                    aria-label="Ansök" 
                                    className="w-7 h-7 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors pointer-events-auto"
                                  >
                                    <Heart className="h-3.5 w-3.5 text-white fill-white" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Monitor stand */}
                      <div className="flex flex-col items-center">
                        {/* Stand neck */}
                        <div className="w-12 h-6 bg-gradient-to-b from-gray-700 to-gray-800 rounded-b-sm"></div>
                        {/* Stand base */}
                        <div className="w-32 h-2.5 bg-gradient-to-b from-gray-800 to-gray-900 rounded-full shadow-lg"></div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Image upload section - separate for mobile and desktop */}
                <div className="space-y-4">
                  {/* Mobile image section */}
                  <div className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="h-4 w-4 text-white" />
                      <span className="text-white font-medium text-sm sm:text-base">Mobilbild (valfritt)</span>
                    </div>
                    <p className="text-white text-xs sm:text-sm mb-3">
                      Bild som visas i mobilförhandsvisningen
                    </p>
                    
                    {!jobImageDisplayUrl && (
                      <FileUpload
                        mediaType="job-image"
                        uploadType="image"
                        onFileUploaded={async (storagePath, fileName) => {
                          handleInputChange('job_image_url', storagePath);
                          setOriginalStoragePath(storagePath);
                          setImageIsEdited(false);
                          const { getMediaUrl } = await import('@/lib/mediaManager');
                          const signedUrl = await getMediaUrl(storagePath, 'job-image', 86400);
                          setOriginalImageUrl(signedUrl || storagePath);
                        }}
                        acceptedFileTypes={['image/*']}
                        maxFileSize={5 * 1024 * 1024}
                      />
                    )}
                    
                    {jobImageDisplayUrl && (
                      <>
                        <div className="mt-3 flex justify-center">
                          <img 
                            src={jobImageDisplayUrl} 
                            alt="Mobilbild förhandsvisning" 
                            className="w-full max-w-md h-48 object-contain rounded-lg"
                          />
                        </div>
                        
                        <div className="mt-4 space-y-3">
                          <div className="flex justify-center items-center gap-3">
                            <div className="w-[30px]" aria-hidden="true"></div>
                            <button
                              type="button"
                              onClick={openImageEditor}
                              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                              Justera bild
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleInputChange('job_image_url', '');
                                setOriginalImageUrl(null);
                                setOriginalStoragePath(null);
                                setImageIsEdited(false);
                                setManualFocus(null);
                              }}
                              className="p-1.5 rounded-lg text-white transition-all duration-200 hover:bg-red-500/20 hover:text-red-400"
                              aria-label="Ta bort mobilbild"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Desktop image section */}
                  <div className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="h-4 w-4 text-white" />
                      <span className="text-white font-medium text-sm sm:text-base">Datorbild (valfritt)</span>
                    </div>
                    <p className="text-white text-xs sm:text-sm mb-3">
                      Separat bild för dator/tablet. Om ingen laddas upp används mobilbilden.
                    </p>
                    
                    {!jobImageDesktopDisplayUrl && (
                      <FileUpload
                        mediaType="job-image"
                        uploadType="image"
                        onFileUploaded={async (storagePath, fileName) => {
                          handleInputChange('job_image_desktop_url', storagePath);
                          setOriginalDesktopStoragePath(storagePath);
                          setDesktopImageIsEdited(false);
                          const { getMediaUrl } = await import('@/lib/mediaManager');
                          const signedUrl = await getMediaUrl(storagePath, 'job-image', 86400);
                          setOriginalDesktopImageUrl(signedUrl || storagePath);
                        }}
                        acceptedFileTypes={['image/*']}
                        maxFileSize={5 * 1024 * 1024}
                      />
                    )}
                    
                    {jobImageDesktopDisplayUrl && (
                      <>
                        <div className="mt-3 flex justify-center">
                          <img 
                            src={jobImageDesktopDisplayUrl} 
                            alt="Datorbild förhandsvisning" 
                            className="w-full max-w-md h-48 object-contain rounded-lg"
                          />
                        </div>
                        
                        <div className="mt-4 space-y-3">
                          <div className="flex justify-center items-center gap-3">
                            <div className="w-[30px]" aria-hidden="true"></div>
                            <button
                              type="button"
                              onClick={openDesktopImageEditor}
                              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                              Justera bild
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleInputChange('job_image_desktop_url', '');
                                setOriginalDesktopImageUrl(null);
                                setOriginalDesktopStoragePath(null);
                                setDesktopImageIsEdited(false);
                              }}
                              className="p-1.5 rounded-lg text-white transition-all duration-200 hover:bg-red-500/20 hover:text-red-400"
                              aria-label="Ta bort datorbild"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Navigation - Hide during initialization to prevent button flash */}
          {!showQuestionTemplates && !showQuestionForm && !isInitializing && (
            <div className="flex items-center justify-between p-4 border-t border-white/20 flex-shrink-0">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 transition-all duration-300 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>

              {isLastStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !validateCurrentStep()}
                  className="bg-green-600/80 hover:bg-green-600 md:hover:bg-green-600 text-white px-8 py-2 transition-all duration-300"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Skapar...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Publicera
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

        {/* Image Editor Dialog */}
        {editingImageUrl && (
          <ImageEditor
            isOpen={showImageEditor}
            onClose={() => {
              setShowImageEditor(false);
              setEditingImageUrl(null);
            }}
            imageSrc={editingImageUrl}
            onSave={handleImageEdit}
            onRestoreOriginal={handleRestoreOriginal}
            isCircular={false}
            aspectRatio={16/9}
          />
        )}

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onOpenChange={setShowUnsavedDialog}
          onConfirm={handleConfirmClose}
          onCancel={handleCancelClose}
          onSaveAndLeave={handleSaveAndLeave}
          isSaving={isSavingDraft}
        />


        {/* Company Profile Dialog */}
        {user?.id && (
          <CompanyProfileDialog
            open={showCompanyProfile}
            onOpenChange={setShowCompanyProfile}
            companyId={user.id}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MobileJobWizard;
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYMENT_TYPES, normalizeEmploymentType, getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { ArrowLeft, ArrowRight, Loader2, X, ChevronDown, Plus, Minus, Trash2, Pencil, Briefcase, MapPin, Mail, Banknote, Users, FileText, Video, Bookmark, Heart, Building2, Smartphone, Monitor, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
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
import { getCachedPostalCodeInfo, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Import shared wizard components and types
import { SortableQuestionItem } from '@/components/wizard/SortableQuestionItem';
import { JobQuestion } from '@/types/jobWizard';

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
  salary_transparency?: string;
  benefits?: string[];
  work_start_time?: string;
  work_end_time?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  workplace_name?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_city?: string;
  workplace_county?: string;
  workplace_municipality?: string;
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
  salary_transparency: string;
  benefits: string[];
  positions_count: string;
  work_start_time: string;
  work_end_time: string;
  work_location_type: string;
  remote_work_possible: string;
  workplace_name: string;
  workplace_address: string;
  workplace_postal_code: string;
  workplace_city: string;
  workplace_county: string;
  workplace_municipality: string;
  work_schedule: string;
  contact_email: string;
  application_instructions: string;
  pitch: string;
  job_image_url: string;
  job_image_desktop_url: string;
}

interface EditJobDialogProps {
  job: JobPosting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobUpdated: () => void;
}

const EditJobDialog = ({ job, open, onOpenChange, onJobUpdated }: EditJobDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
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
  const [jobImageDesktopDisplayUrl, setJobImageDesktopDisplayUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [originalDesktopImageUrl, setOriginalDesktopImageUrl] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [editingImageType, setEditingImageType] = useState<'mobile' | 'desktop'>('mobile');
  const [manualFocus, setManualFocus] = useState<number | null>(null);
  const [cachedPostalCodeInfo, setCachedPostalCodeInfo] = useState<{postalCode: string, city: string, municipality: string, county: string} | null>(null);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [showDesktopApplicationForm, setShowDesktopApplicationForm] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  
  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [initialFormData, setInitialFormData] = useState<JobFormData | null>(null);
  const [initialCustomQuestions, setInitialCustomQuestions] = useState<JobQuestion[]>([]);
  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);
  
  const [occupationSearchTerm, setOccupationSearchTerm] = useState('');
  const [showOccupationDropdown, setShowOccupationDropdown] = useState(false);
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
  const [questionTypeSearchTerm, setQuestionTypeSearchTerm] = useState('');
  const [showQuestionTypeDropdown, setShowQuestionTypeDropdown] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const occupationRef = useRef<HTMLDivElement>(null);
  const workEndTimeRef = useRef<HTMLInputElement>(null);

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
    work_location_type: '',
    remote_work_possible: '',
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
    { value: '100000+', label: '100 000+ kr' },
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

  const formatSalaryTransparency = () => {
    if (!formData.salary_transparency) return '';
    // If it's in the format "X-Y", return as range
    if (formData.salary_transparency.includes('-')) {
      return `${formData.salary_transparency.replace('-', ' – ')} kr/mån`;
    }
    // If it's "100+" or similar
    if (formData.salary_transparency.includes('+')) {
      return `${formData.salary_transparency} kr/mån`;
    }
    return `${formData.salary_transparency} kr/mån`;
  };

  const getEmailTextSize = (email: string) => {
    if (!email) return 'text-sm';
    
    const length = email.length;
    if (length <= 15) return 'text-sm';
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

  // Build meta line: "Deltid • Saltsjö-Boo, Stockholms län"
  const getMetaLine = (employment?: string, city?: string, county?: string) => {
    const emp = getEmploymentTypeLabel(employment);
    // Include county if available
    let locationPart = formatCityWithMainCity(city || '');
    if (county && county.trim()) {
      locationPart = locationPart ? `${locationPart}, ${county}` : county;
    }
    return [emp, locationPart].filter(Boolean).join(' • ');
  };

  const getSmartTextSizes = () => {
    const companyName = profile?.company_name || 'Företag';
    const jobTitle = getDisplayTitle();
    const metaLine = getMetaLine(formData.employment_type, formData.workplace_city || formData.location, formData.workplace_county);

    const companyLength = companyName.length;
    const titleLength = jobTitle.length;
    const metaLength = metaLine.length;

    let companySizeClass = 'text-sm';
    let titleSizeClass = 'text-lg';
    let metaSizeClass = 'text-sm';

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

    if (companyLength > 15) {
      companySizeClass = 'text-sm';
    } else if (companyLength < 8) {
      companySizeClass = 'text-sm';
    }

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

  const openImageEditor = async () => {
    try {
      const source = originalImageUrl || formData.job_image_url || jobImageDisplayUrl;
      if (!source) return;

      let urlToEdit = source;
      if (!source.startsWith('http')) {
        // Use public URL from job-images bucket (no expiration)
        const { data: { publicUrl } } = supabase.storage
          .from('job-images')
          .getPublicUrl(source);
        if (publicUrl) urlToEdit = publicUrl;
      }
      setEditingImageUrl(urlToEdit);
      setEditingImageType('mobile');
      setShowImageEditor(true);
    } catch (e) {
      console.error('Failed to open editor', e);
    }
  };

  const openDesktopImageEditor = async () => {
    try {
      // ALLTID prioritera originalDesktopImageUrl för att redigera från originalet - precis som mobile
      const source = originalDesktopImageUrl;
      if (!source) {
        console.log('No original desktop image URL available');
        return;
      }

      let urlToEdit = source;
      if (!source.startsWith('http')) {
        // Use public URL from job-images bucket (no expiration)
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

  // Always start from step 0 when opening
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setIsInitializing(false);
    } else {
      setIsInitializing(true);
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
      const questions = data.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type as any,
        options: q.options as string[] || [],
        is_required: q.is_required,
        order_index: q.order_index,
        min_value: q.min_value || undefined,
        max_value: q.max_value || undefined,
        placeholder_text: q.placeholder_text || undefined
      }));
      setCustomQuestions(questions);
      setInitialCustomQuestions(questions);
    }
  };

  // Load job image if exists - use public URL from job-images bucket (mobile)
  useEffect(() => {
    const loadJobImage = async () => {
      if (job?.job_image_url && open) {
        const url = job.job_image_url;
        
        // If it's a storage path (not a full URL), get public URL
        if (!url.startsWith('http')) {
          const { data: { publicUrl } } = supabase.storage
            .from('job-images')
            .getPublicUrl(url);
          if (publicUrl) {
            setJobImageDisplayUrl(publicUrl);
            setOriginalImageUrl(url); // Keep storage path as original
            return;
          }
        }
        
        // Otherwise use URL as-is
        setJobImageDisplayUrl(url);
        setOriginalImageUrl(url);
      }
    };
    
    loadJobImage();
  }, [job?.job_image_url, open]);

  // Load desktop job image if exists
  useEffect(() => {
    const loadDesktopJobImage = async () => {
      const desktopUrl = (job as any)?.job_image_desktop_url;
      if (desktopUrl && open) {
        // If it's a storage path (not a full URL), get public URL
        if (!desktopUrl.startsWith('http')) {
          const { data: { publicUrl } } = supabase.storage
            .from('job-images')
            .getPublicUrl(desktopUrl);
          if (publicUrl) {
            setJobImageDesktopDisplayUrl(publicUrl);
            setOriginalDesktopImageUrl(desktopUrl);
            return;
          }
        }
        
        // Otherwise use URL as-is
        setJobImageDesktopDisplayUrl(desktopUrl);
        setOriginalDesktopImageUrl(desktopUrl);
      }
    };
    
    loadDesktopJobImage();
  }, [(job as any)?.job_image_desktop_url, open]);

  // Preload image when user reaches step 2 (jobbild section) to make preview faster
  useEffect(() => {
    if (jobImageDisplayUrl && currentStep >= 2 && open) {
      const img = new Image();
      img.src = jobImageDisplayUrl;
      // Force browser to cache the image before preview
      img.onload = () => {
        console.log('Job image preloaded successfully');
      };
      img.onerror = (e) => {
        console.error('Failed to preload job image:', e);
      };
    }
  }, [jobImageDisplayUrl, currentStep, open]);

  // Show company tooltip when reaching preview step (step 3)
  useEffect(() => {
    if (currentStep === 3 && open) {
      // Small delay to let the preview render first
      const timer = setTimeout(() => {
        setShowCompanyTooltip(true);
        setShowApplicationForm(false);
        setIsScrolledTop(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowCompanyTooltip(false);
    }
  }, [currentStep, open]);

  // Preload postal code information early to make location fields faster
  useEffect(() => {
    const preloadPostalCodeInfo = async () => {
      if (job?.workplace_postal_code && open && !cachedPostalCodeInfo) {
        try {
          const info = await getCachedPostalCodeInfo(job.workplace_postal_code);
          if (info) {
            setCachedPostalCodeInfo({
              postalCode: job.workplace_postal_code,
              city: info.city,
              municipality: info.municipality,
              county: info.county
            });
            console.log('Postal code info preloaded successfully');
          }
        } catch (error) {
          console.error('Failed to preload postal code info:', error);
        }
      }
    };
    
    preloadPostalCodeInfo();
  }, [job?.workplace_postal_code, open, cachedPostalCodeInfo]);

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
        salary_transparency: job.salary_transparency || '',
        benefits: job.benefits || [],
        positions_count: (job.positions_count ?? 1).toString(),
        work_start_time: job.work_start_time || '',
        work_end_time: job.work_end_time || '',
        work_location_type: job.work_location_type || '',
        remote_work_possible: job.remote_work_possible || '',
        workplace_name: job.workplace_name || '',
        workplace_address: job.workplace_address || '',
        workplace_postal_code: job.workplace_postal_code || '',
        workplace_city: job.workplace_city || '',
        workplace_county: job.workplace_county || '',
        workplace_municipality: job.workplace_municipality || '',
        work_schedule: job.work_schedule || '',
        contact_email: job.contact_email || '',
        application_instructions: job.application_instructions || '',
        pitch: job.pitch || '',
        job_image_url: job.job_image_url || '',
        job_image_desktop_url: (job as any).job_image_desktop_url || ''
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
    
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    const questionsChanged = JSON.stringify(customQuestions) !== JSON.stringify(initialCustomQuestions);
    
    setHasUnsavedChanges(formChanged || questionsChanged);
  }, [formData, initialFormData, customQuestions, initialCustomQuestions, open]);

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

  const handleSaveAndLeave = async () => {
    if (!user || !job) return;
    
    setIsSavingAndLeaving(true);
    try {
      await handleSubmit();
      setShowUnsavedDialog(false);
      setPendingClose(false);
      setHasUnsavedChanges(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSavingAndLeaving(false);
    }
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
  const filteredSalaryTransparencyOptions = salaryTransparencyOptions.filter(t =>
    t.label.toLowerCase().includes(salaryTransparencySearchTerm.toLowerCase())
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
    setShowSalaryTransparencyDropdown(!showSalaryTransparencyDropdown);
    setSalaryTransparencySearchTerm('');
  };

  const handleWorkLocationSearch = (value: string) => {
    setWorkLocationSearchTerm(value);
    setShowWorkLocationDropdown(value.length >= 0);
  };

  const handleWorkLocationSelect = (type: { value: string, label: string }) => {
    handleInputChange('work_location_type', type.value);
    setWorkLocationSearchTerm(type.label);
    setShowWorkLocationDropdown(false);
    
    // Auto-set remote_work_possible to 'delvis' when selecting hemarbete or distans
    if (type.value === 'hemarbete' || type.value === 'distans') {
      handleInputChange('remote_work_possible', 'delvis');
      setRemoteWorkSearchTerm('Delvis');
    }
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

  const handleWorkplaceLocationChange = (value: string, postalCode?: string, municipality?: string, county?: string) => {
    setFormData(prev => ({
      ...prev,
      workplace_city: value,
      location: value, // Auto-update main location field from postal code
      workplace_municipality: municipality || prev.workplace_municipality,
      workplace_county: county || prev.workplace_county
    }));
    
    // Cache postal code info if available
    if (postalCode && value && municipality && county) {
      setCachedPostalCodeInfo({
        postalCode,
        city: value,
        municipality,
        county
      });
    }
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
      if (showSalaryTransparencyDropdown && !(event.target as Element).closest('.salary-transparency-dropdown')) {
        setShowSalaryTransparencyDropdown(false);
      }
      if (showBenefitsDropdown && !(event.target as Element).closest('.benefits-dropdown')) {
        setShowBenefitsDropdown(false);
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
  }, [showOccupationDropdown, showEmploymentTypeDropdown, showSalaryTypeDropdown, showSalaryTransparencyDropdown, showBenefitsDropdown, showWorkLocationDropdown, showRemoteWorkDropdown, showQuestionTypeDropdown]);

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
        salary_transparency: formData.salary_transparency || null,
        positions_count: formData.positions_count ? parseInt(formData.positions_count) : 1,
        work_location_type: formData.work_location_type || null,
        remote_work_possible: formData.remote_work_possible || null,
        workplace_name: formData.workplace_name || null,
        workplace_address: formData.workplace_address || null,
        workplace_postal_code: formData.workplace_postal_code || null,
        workplace_city: formData.workplace_city || null,
        workplace_county: workplaceCounty,
        workplace_municipality: workplaceMunicipality,
        work_schedule: formData.work_schedule || null,
        work_start_time: formData.work_start_time || null,
        work_end_time: formData.work_end_time || null,
        benefits: formData.benefits && formData.benefits.length > 0 ? formData.benefits : null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        pitch: formData.pitch || null,
        job_image_url: formData.job_image_url || null,
        job_image_desktop_url: formData.job_image_desktop_url || null
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
  // Guard against flash: during initialization, never show as last step
  const isLastStep = !isInitializing && currentStep === steps.length - 1;
  
  // Don't render Dialog content until initialization is complete
  if (open && isInitializing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="parium-panel max-w-md h-auto max-h-[90vh] md:max-h-[800px] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden">
          <AnimatedBackground showBubbles={false} variant="card" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="parium-panel max-w-md h-auto max-h-[90vh] md:max-h-[800px] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <AnimatedBackground showBubbles={false} variant="card" />
          <div className="flex flex-col max-h-[90vh] relative z-10 overflow-hidden">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="absolute right-4 top-4 h-8 w-8 text-white/70 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="px-4 py-2 flex-shrink-0">
              <Progress 
                value={progress} 
                className="h-1 bg-white/20 [&>div]:bg-white"
              />
            </div>

            {/* Scrollable Content */}
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1.5">
              {!job ? (
                <div className="py-10 text-center text-white">
                  <p>Laddar annons...</p>
                </div>
              ) : (
                <>
                  {/* Step 1: Grundinfo */}
                  {currentStep === 0 && (
                    <div className="space-y-1.5 max-w-2xl mx-auto w-full">
                      <div className="space-y-2">
                        <Label className="text-white font-medium text-sm">Jobbtitel *</Label>
                        <Input
                          value={formData.title}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          placeholder="t.ex. Lagerarbetare"
                          className="bg-white/10 border-white/20 hover:border-white/50 text-white placeholder:text-white/60 h-9 text-sm focus:border-white/40"
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
                            className="bg-white/10 border-white/20 hover:border-white/50 text-white placeholder:text-white/60 h-9 text-sm pr-10 focus:border-white/40"
                          />
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                          
                          {showOccupationDropdown && (
                            <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md mt-1 max-h-60 overflow-y-auto">
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
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60 p-2 text-sm resize-none leading-tight focus:border-white/40"
                        />
                      </div>

{/* Förmåner / Benefits - FIRST after description to match MobileJobWizard */}
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
                                      <Heart className="w-3 h-3 text-primary" />
                                    )}
                                  </div>
                                  <span>{benefit.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
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

                        {/* Custom benefit input - matching MobileJobWizard */}
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
                          <h3 className="text-white text-sm font-medium text-center">
                            Dessa frågor fylls automatiskt från jobbsökarens profil
                          </h3>

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
                              className="bg-primary hover:bg-primary/90 text-white touch-border-white"
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
                                                    ...(template as JobQuestion),
                                                    template_id: (template as any).id
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
                            <div className="space-y-2">
                              <Label className="text-white font-medium">Frågetyp *</Label>
                              <div className="relative question-type-dropdown">
                                <Input
                                  value={questionTypeSearchTerm || (editingQuestion?.question_type ? questionTypes.find(t => t.value === editingQuestion.question_type)?.label || '' : '')}
                                  onChange={(e) => handleQuestionTypeSearch(e.target.value)}
                                  onClick={handleQuestionTypeClick}
                                  placeholder="Välj frågetyp"
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                                  readOnly
                                />
                                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                                
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
                        <div className="relative flex items-center justify-center gap-4 scale-90 sm:scale-100">
                          <section aria-label="Mobilansökningsformulär förhandsvisning" className="relative w-[160px] h-[320px]">
                            {showCompanyTooltip && showApplicationForm && isScrolledTop && (
                              <>
                                {/* Left tooltip (company name) */}
                                <div className="pointer-events-none absolute z-[999] top-14 -left-[115px] flex items-center gap-1">
                                  <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                                    Obs, tryck här!
                                  </div>
                                  <svg width="20" height="16" viewBox="0 0 40 24" className="text-white" style={{ overflow: 'visible' }}>
                                    <defs>
                                      <marker id="arrowheadRight" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
                                        <polygon points="0 0, 12 6, 0 12" fill="currentColor" />
                                      </marker>
                                    </defs>
                                    <path d="M2 12 L 38 12" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrowheadRight)" />
                                  </svg>
                                </div>
                                {/* Right tooltip (X button) - outside the phone */}
                                <div className="pointer-events-none absolute z-[999] top-4 -right-[115px] flex items-center gap-1">
                                  <svg width="20" height="16" viewBox="0 0 40 24" className="text-white" style={{ overflow: 'visible' }}>
                                    <defs>
                                      <marker id="arrowheadLeft_ext" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
                                        <polygon points="0 0, 12 6, 0 12" fill="currentColor" />
                                      </marker>
                                    </defs>
                                    <path d="M38 12 L 2 12" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrowheadLeft_ext)" />
                                  </svg>
                                  <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                                    Obs, tryck här!
                                  </div>
                                </div>
                              </>
                            )}
                            
                            <div className="relative w-full h-full rounded-[2rem] bg-black p-1 shadow-xl">
                              <div className="relative w-full h-full rounded-[1.6rem] overflow-hidden bg-black">
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 h-1 w-8 rounded-full bg-black border border-gray-800"></div>

                                <div className="absolute inset-0 rounded-[1.6rem] overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}>
                                  
                                  <div className={showApplicationForm ? 'flex flex-col h-full' : 'hidden'}>
                                    <div className="flex items-center justify-between px-2 py-1.5 pt-2 bg-black/20 border-b border-white/20 relative z-10 flex-shrink-0 rounded-t-[1.6rem]">
                                      <div className="text-xs font-bold text-white">Ansökningsformulär</div>
                                      <div className="relative">
                                        {showCompanyTooltip && isScrolledTop && (
                                          <div className="pointer-events-none absolute z-[999] top-0 -right-28 flex items-center gap-1">
                                            <svg width="20" height="12" viewBox="0 0 48 28" className="text-white">
                                              <path d="M46 14 Q 24 0, 2 14" stroke="currentColor" strokeWidth="2" fill="none" markerEnd="url(#arrowheadLeft)" />
                                              <defs>
                                                <marker id="arrowheadLeft" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                                                  <polygon points="6 0, 0 3, 6 6" fill="currentColor" />
                                                </marker>
                                              </defs>
                                            </svg>
                                            <div className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md font-medium border border-primary/30 whitespace-nowrap">
                                              Obs, tryck här!
                                            </div>
                                          </div>
                                        )}
                                        <button onClick={() => setShowApplicationForm(false)} className="text-xs text-white transition-colors md:hover:text-white" aria-label="Stäng ansökningsformulär">✕</button>
                                      </div>
                                    </div>

                                     <div 
                                       className="px-2 py-2 overflow-y-auto relative z-10 custom-scrollbar flex-1"
                                       onScroll={(e) => {
                                         const target = e.currentTarget;
                                         setIsScrolledTop(target.scrollTop === 0);
                                       }}
                                     >
                                       <div className="space-y-1.5 pb-2">
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
                                               onClick={() => setShowCompanyProfile(true)}
                                               className="text-xs font-bold text-white hover:text-primary transition-colors cursor-pointer whitespace-normal break-words leading-tight"
                                             >
                                               {profile?.company_name || 'Företagsnamn'}
                                             </button>
                                          </div>
                                        </div>

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

                                         {formData.description && (
                                           <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                             <h5 className="text-xs font-medium text-white mb-0.5">Jobbeskrivning</h5>
                                             <div className="text-xs text-white leading-relaxed whitespace-pre-wrap break-words [&>*]:mb-0.5 [&>*:last-child]:mb-0">
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
                                           <div className="bg-white/10 rounded-lg p-1.5 border border-white/20">
                                             <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
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
                                                    {formData.workplace_postal_code} {formData.workplace_city}{(formData.workplace_county || cachedPostalCodeInfo?.county) ? `, ${formData.workplace_county || cachedPostalCodeInfo?.county}` : ''}
                                                  </div>
                                                ) : formData.workplace_city ? (
                                                  <div>
                                                    {formData.workplace_city}{(formData.workplace_county || cachedPostalCodeInfo?.county) ? `, ${formData.workplace_county || cachedPostalCodeInfo?.county}` : ''}
                                                  </div>
                                                ) : (
                                                  <div>{formData.workplace_postal_code}</div>
                                                )}
                                                <div>{getWorkLocationDisplayText()}</div>
                                              </div>
                                            )}
                                          </div>
                                        </div>

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
                                                       className="w-full border border-white/20 bg-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/60 resize-none"
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
                                                          if (!parent) return;
                                                          const yesBtn = parent.querySelector('button:nth-child(1)') as HTMLButtonElement | null;
                                                          const noBtn = parent.querySelector('button:nth-child(2)') as HTMLButtonElement | null;

                                                          const isSelected = e.currentTarget.classList.contains('bg-secondary/40');

                                                          // Rensa båda först
                                                          [yesBtn, noBtn].forEach(btn => {
                                                            btn?.classList.remove('bg-secondary/40', 'border-secondary', 'text-white');
                                                            btn?.classList.add('bg-white/10', 'border-white/20');
                                                          });

                                                          // Om klickad knapp inte redan var vald -> välj den, annars lämna avmarkerad
                                                          if (!isSelected) {
                                                            e.currentTarget.classList.remove('bg-white/10', 'border-white/20');
                                                            e.currentTarget.classList.add('bg-secondary/40', 'border-secondary', 'text-white');
                                                          }
                                                        }}
                                                        className="flex-1 bg-white/10 border border-white/20 rounded-md px-1.5 py-0.5 text-xs text-white transition-colors font-medium"
                                                      >
                                                        Ja
                                                      </button>
                                                      <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          const parent = e.currentTarget.parentElement;
                                                          if (!parent) return;
                                                          const yesBtn = parent.querySelector('button:nth-child(1)') as HTMLButtonElement | null;
                                                          const noBtn = parent.querySelector('button:nth-child(2)') as HTMLButtonElement | null;

                                                          const isSelected = e.currentTarget.classList.contains('bg-secondary/40');

                                                          // Rensa båda först
                                                          [yesBtn, noBtn].forEach(btn => {
                                                            btn?.classList.remove('bg-secondary/40', 'border-secondary', 'text-white');
                                                            btn?.classList.add('bg-white/10', 'border-white/20');
                                                          });

                                                          // Om klickad knapp inte redan var vald -> välj den, annars lämna avmarkerad
                                                          if (!isSelected) {
                                                            e.currentTarget.classList.remove('bg-white/10', 'border-white/20');
                                                            e.currentTarget.classList.add('bg-secondary/40', 'border-secondary', 'text-white');
                                                          }
                                                        }}
                                                        className="flex-1 bg-white/10 border border-white/20 rounded-md px-1.5 py-0.5 text-xs text-white transition-colors font-medium"
                                                      >
                                                        Nej
                                                      </button>
                                                    </div>
                                                  )}
                                                  
                                                  {question.question_type === 'multiple_choice' && (
                                                    <div className="space-y-1.5">
                                                      {(question.options || []).map((option: string, optionIndex: number) => {
                                                        const questionKey = question.id || `q_${optionIndex}`;
                                                        const selectedAnswers = previewAnswers[questionKey];
                                                        const answersArray = typeof selectedAnswers === 'string' 
                                                          ? selectedAnswers.split('|||') 
                                                          : [];
                                                        const selected = answersArray.includes(option);
                                                        
                                                        return (
                                                          <button
                                                            key={optionIndex}
                                                            type="button"
                                                            onClick={(e) => {
                                                              e.preventDefault();
                                                              setPreviewAnswers((prev) => {
                                                                const currentAnswers = prev[questionKey];
                                                                const answersArray = typeof currentAnswers === 'string'
                                                                  ? currentAnswers.split('|||').filter(a => a)
                                                                  : [];
                                                                
                                                                const newAnswers = answersArray.includes(option)
                                                                  ? answersArray.filter(a => a !== option)
                                                                  : [...answersArray, option];
                                                                
                                                                return {
                                                                  ...prev,
                                                                  [questionKey]: newAnswers.join('|||'),
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
                                                       <div className="text-center text-xs font-semibold text-white">
                                                        {question.min_value ?? 0}
                                                      </div>
                                                      <input
                                                        type="range"
                                                        min={question.min_value ?? 0}
                                                        max={question.max_value ?? 100}
                                                        defaultValue={question.min_value ?? 0}
                                                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:bg-white/20 [&::-webkit-slider-runnable-track]:rounded-lg [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-track]:bg-white/20 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-progress]:bg-white"
                                                      />
                                                    </div>
                                                  )}
                                                  
                                                  {question.question_type === 'date' && (
                                                    <input
                                                      type="date"
                                                      className="w-full border border-white/20 bg-white/10 rounded p-2 text-sm text-white placeholder:text-white/60 h-9"
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
                                      className="absolute inset-0 flex flex-col items-center pt-10 p-3 text-white text-center cursor-pointer overflow-y-auto overscroll-contain"
                                      onClick={() => setShowApplicationForm(true)}
                                    >
                                      {(() => {
                                        const textSizes = getSmartTextSizes();
                                        return (
                                          <>
                                            <button 
                                              onClick={() => setShowCompanyProfile(true)}
                                              className={`${textSizes.company} text-white font-medium mb-1 hover:text-primary transition-colors cursor-pointer text-left line-clamp-1`}
                                            >
                                              {profile?.company_name || 'Företag'}
                                            </button>
                                            <TruncatedTitle 
                                              fullText={getDisplayTitle()} 
                                              className={`${textSizes.title} text-white font-bold leading-tight mb-1 line-clamp-5 cursor-default`}
                                            >
                                              {getDisplayTitle()}
                                            </TruncatedTitle>
                                            <div className={`${textSizes.meta} text-white`}>
                                              {getMetaLine(formData.employment_type, formData.workplace_city || formData.location, formData.workplace_county)}
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
                      )}

                      {/* Desktop Preview - Monitor mockup like MobileJobWizard */}
                      {previewMode === 'desktop' && (
                        <div className="flex flex-col items-center space-y-4">
                          {/* Desktop monitor frame */}
                          <div className="relative">
                            {/* Monitor screen */}
                            <div className="relative w-[520px] rounded-t-lg bg-black p-2.5 shadow-2xl">
                              {/* Screen bezel */}
                              <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-black border-2 border-gray-800">
                                {/* Content with Parium background */}
                                <div 
                                  className="absolute inset-0"
                                  style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}
                                >
                                  {/* Application Form View (when clicked) */}
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
                                                  <marker id="arrowheadRight_desktop_x_edit" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
                                                    <polygon points="0 0, 12 6, 0 12" fill="currentColor" />
                                                  </marker>
                                                </defs>
                                                <path d="M2 12 L 38 12" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrowheadRight_desktop_x_edit)" />
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
                                          {/* Company info */}
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
                                                  className="text-sm font-bold text-white hover:text-primary transition-colors cursor-pointer"
                                                >
                                                  {profile?.company_name || 'Företagsnamn'}
                                                </button>
                                              </div>
                                              {/* Tooltip pointing at company name */}
                                              {showCompanyTooltip && (
                                                <div className="pointer-events-none flex items-center gap-1">
                                                  <svg width="16" height="12" viewBox="0 0 40 24" className="text-white" style={{ overflow: 'visible' }}>
                                                    <defs>
                                                      <marker id="arrowheadLeft_desktop_edit" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
                                                        <polygon points="0 0, 12 6, 0 12" fill="currentColor" />
                                                      </marker>
                                                    </defs>
                                                    <path d="M38 12 L 2 12" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrowheadLeft_desktop_edit)" />
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

                                          {/* Jobbeskrivning */}
                                          {formData.description && (
                                            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                              <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                                <FileText className="h-3 w-3 mr-1 text-white" />
                                                Jobbeskrivning
                                              </h5>
                                              <div className="text-xs text-white leading-relaxed whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                                                {formData.description.length > 200 
                                                  ? formData.description.substring(0, 200) + '...' 
                                                  : formData.description
                                                }
                                              </div>
                                            </div>
                                          )}

                                          {/* Anställningsform */}
                                          {formData.employment_type && (
                                            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                              <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                                <Briefcase className="h-3 w-3 mr-1 text-white" />
                                                Anställningsform
                                              </h5>
                                              <div className="text-xs text-white font-medium">
                                                {getEmploymentTypeLabel(formData.employment_type)}
                                              </div>
                                            </div>
                                          )}

                                          {/* Lön */}
                                          {(formData.salary_min || formData.salary_max || formData.salary_type) && (
                                            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                              <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                                <Banknote className="h-3 w-3 mr-1 text-white" />
                                                Lön
                                              </h5>
                                              <div className="text-xs text-white leading-relaxed space-y-0.5">
                                                {formatSalaryInfo().map((info, index) => (
                                                  <div key={index} className="font-medium">{info}</div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Lönetransparens */}
                                          {formData.salary_transparency && formatSalaryTransparency() && (
                                            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                              <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                                <Banknote className="h-3 w-3 mr-1 text-white" />
                                                Lönetransparens
                                              </h5>
                                              <div className="text-xs text-white font-medium">{formatSalaryTransparency()}</div>
                                            </div>
                                          )}

                                          {/* Arbetsplats */}
                                          <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                            <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                              <MapPin className="h-3 w-3 mr-1 text-white" />
                                              Arbetsplats
                                            </h5>
                                            <div className="text-xs text-white leading-relaxed space-y-0.5">
                                              {formData.workplace_name && <div className="font-medium">{formData.workplace_name}</div>}
                                              {formData.workplace_address && <div>{formData.workplace_address}</div>}
                                              {(formData.workplace_postal_code || formData.workplace_city) && (
                                                <div>
                                                  {formData.workplace_postal_code && formData.workplace_city ? (
                                                    <div>
                                                      {formData.workplace_postal_code} {formData.workplace_city}{(formData.workplace_county || cachedPostalCodeInfo?.county) ? `, ${formData.workplace_county || cachedPostalCodeInfo?.county}` : ''}
                                                    </div>
                                                  ) : formData.workplace_city ? (
                                                    <div>
                                                      {formData.workplace_city}{(formData.workplace_county || cachedPostalCodeInfo?.county) ? `, ${formData.workplace_county || cachedPostalCodeInfo?.county}` : ''}
                                                    </div>
                                                  ) : (
                                                    <div>{formData.workplace_postal_code}</div>
                                                  )}
                                                </div>
                                              )}
                                              <div>{getWorkLocationDisplayText()}</div>
                                            </div>
                                          </div>

                                          {/* Antal rekryteringar */}
                                          {formData.positions_count && parseInt(formData.positions_count) > 0 && (
                                            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                              <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                                <Users className="h-3 w-3 mr-1 text-white" />
                                                Antal rekryteringar
                                              </h5>
                                              <div className="text-xs text-white font-medium">{formatPositionsCount()}</div>
                                            </div>
                                          )}

                                          {/* Arbetstider */}
                                          {(formData.work_start_time || formData.work_end_time) && (
                                            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                              <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                                <Clock className="h-3 w-3 mr-1 text-white" />
                                                Arbetstider
                                              </h5>
                                              <div className="text-xs text-white font-medium">
                                                {formData.work_start_time && formData.work_end_time 
                                                  ? `${formData.work_start_time} – ${formData.work_end_time}`
                                                  : formData.work_start_time || formData.work_end_time}
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
                                          {formData.contact_email && (
                                            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                              <h5 className="text-xs font-medium text-white mb-0.5 flex items-center">
                                                <Mail className="h-3 w-3 mr-1 text-white" />
                                                Kontakt
                                              </h5>
                                              <div className="text-xs text-white">
                                                <a 
                                                  href={`mailto:${formData.contact_email}`}
                                                  className="text-blue-300 font-medium break-all hover:text-blue-200 underline cursor-pointer"
                                                >
                                                  {formData.contact_email}
                                                </a>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Job card view (when form is closed) */}
                                  {!showDesktopApplicationForm && (
                                    <div className="absolute inset-0 z-10">
                                      {/* ONLY use desktop image, no fallback */}
                                      {jobImageDesktopDisplayUrl ? (
                                        <img
                                          src={jobImageDesktopDisplayUrl}
                                          alt={`Jobbbild för ${formData.title}`}
                                          className="absolute inset-0 w-full h-full object-cover select-none"
                                          loading="eager"
                                          decoding="async"
                                        />
                                      ) : null}
                                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                      <div 
                                        className="absolute inset-0 flex flex-col items-center justify-center p-6 pb-16 text-white text-center cursor-pointer"
                                        onClick={() => setShowDesktopApplicationForm(true)}
                                      >
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setShowCompanyProfile(true); }}
                                          className="text-sm text-white font-medium mb-2 hover:text-white/70 transition-colors cursor-pointer line-clamp-1"
                                        >
                                          {profile?.company_name || 'Företag'}
                                        </button>
                                        <TruncatedTitle 
                                          fullText={formData.title || 'Jobbtitel'} 
                                          className="text-xl text-white font-bold leading-tight mb-2 line-clamp-3 cursor-default"
                                        >
                                          {formData.title || 'Jobbtitel'}
                                        </TruncatedTitle>
                                        <div className="text-sm text-white">
                                          {getMetaLine(formData.employment_type, formData.workplace_city || formData.location, formData.workplace_county)}
                                        </div>
                                      </div>
                                      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 pointer-events-none">
                                        <button aria-label="Nej tack" className="w-8 h-8 rounded-full bg-red-500 shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors pointer-events-auto">
                                          <X className="h-4 w-4 text-white" />
                                        </button>
                                        <button aria-label="Spara" className="w-8 h-8 rounded-full bg-blue-500 shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors pointer-events-auto">
                                          <Bookmark className="h-4 w-4 text-white" />
                                        </button>
                                        <button onClick={() => setShowDesktopApplicationForm(true)} aria-label="Ansök" className="w-8 h-8 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors pointer-events-auto">
                                          <Heart className="h-4 w-4 text-white fill-white" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Monitor stand */}
                            <div className="w-20 h-8 bg-gradient-to-b from-gray-700 to-gray-800 mx-auto rounded-b-lg" />
                            <div className="w-32 h-2 bg-gradient-to-b from-gray-600 to-gray-700 mx-auto rounded-b-lg" />
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
                                setOriginalImageUrl(storagePath);
                                
                                const { data: { publicUrl } } = supabase.storage
                                  .from('job-images')
                                  .getPublicUrl(storagePath);
                                  
                                if (publicUrl) {
                                  setJobImageDisplayUrl(publicUrl);
                                  const { preloadSingleFile } = await import('@/lib/serviceWorkerManager');
                                  await preloadSingleFile(publicUrl);
                                }
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
                                      setJobImageDisplayUrl(null);
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
                                setOriginalDesktopImageUrl(storagePath);
                                
                                const { data: { publicUrl } } = supabase.storage
                                  .from('job-images')
                                  .getPublicUrl(storagePath);
                                  
                                if (publicUrl) {
                                  setJobImageDesktopDisplayUrl(publicUrl);
                                  const { preloadSingleFile } = await import('@/lib/serviceWorkerManager');
                                  await preloadSingleFile(publicUrl);
                                }
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
                                      setJobImageDesktopDisplayUrl(null);
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
                </>
              )}
            </div>

            {/* Footer Navigation - Hide when in question form or template selection */}
            {!showQuestionTemplates && !showQuestionForm && (
            <div className="p-4 border-t border-white/20 flex-shrink-0 flex justify-between gap-3">
              <Button
                onClick={handleBack}
                disabled={currentStep === 0}
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 transition-all duration-300 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>

              {/* Both buttons are always rendered but only one is visible - eliminates render delay */}
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className={`bg-green-600 hover:bg-green-700 md:hover:bg-green-700 text-white px-8 py-2 transition-all duration-300 ${isLastStep ? '' : 'hidden'}`}
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
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 touch-border-white transition-all duration-300 focus:outline-none ${isLastStep ? 'hidden' : ''}`}
              >
                Nästa
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        onSaveAndLeave={handleSaveAndLeave}
        isSaving={isSavingAndLeaving}
      />

      {showCompanyProfile && profile && (
        <CompanyProfileDialog 
          open={showCompanyProfile}
          onOpenChange={setShowCompanyProfile}
          companyId={profile?.user_id || ''}
        />
      )}

      {/* Image Editor for job images */}
      {editingImageUrl && (
        <ImageEditor
          isOpen={showImageEditor}
          onClose={() => {
            setShowImageEditor(false);
            setEditingImageUrl(null);
          }}
          imageSrc={editingImageUrl}
          onSave={async (blob) => {
            try {
              if (!user) return;
              const file = new File([blob], `job-image-${Date.now()}.webp`, { type: 'image/webp' });
              const filePath = `${user.id}/job-${editingImageType}-${Date.now()}.webp`;
              
              const { error: uploadError } = await supabase.storage
                .from('job-images')
                .upload(filePath, file);
              
              if (uploadError) throw uploadError;
              
              const { data: { publicUrl } } = supabase.storage
                .from('job-images')
                .getPublicUrl(filePath);
              
              // Update the correct image based on which one is being edited
              if (editingImageType === 'desktop') {
                handleInputChange('job_image_desktop_url', filePath);
                setJobImageDesktopDisplayUrl(publicUrl);
                // Keep original URL for restore functionality
              } else {
                handleInputChange('job_image_url', filePath);
                setJobImageDisplayUrl(publicUrl);
                // Keep original URL for restore functionality
              }
              
              setShowImageEditor(false);
              setEditingImageUrl(null);
              
              toast({
                title: "Bild justerad",
                description: editingImageType === 'desktop' ? "Datorbilden har sparats" : "Mobilbilden har sparats",
              });
            } catch (error) {
              console.error('Error saving edited image:', error);
              toast({
                title: "Kunde inte spara bild",
                description: "Försök igen",
                variant: "destructive",
              });
            }
          }}
          onRestoreOriginal={() => {
            if (editingImageType === 'desktop' && originalDesktopImageUrl) {
              // For desktop, get public URL if it's a storage path
              if (!originalDesktopImageUrl.startsWith('http')) {
                const { data: { publicUrl } } = supabase.storage
                  .from('job-images')
                  .getPublicUrl(originalDesktopImageUrl);
                if (publicUrl) setJobImageDesktopDisplayUrl(publicUrl);
              } else {
                setJobImageDesktopDisplayUrl(originalDesktopImageUrl);
              }
            } else if (originalImageUrl) {
              if (!originalImageUrl.startsWith('http')) {
                const { data: { publicUrl } } = supabase.storage
                  .from('job-images')
                  .getPublicUrl(originalImageUrl);
                if (publicUrl) setJobImageDisplayUrl(publicUrl);
              } else {
                setJobImageDisplayUrl(originalImageUrl);
              }
            }
          }}
          isCircular={false}
          aspectRatio={16 / 9}
        />
      )}
    </>
  );
};

export default EditJobDialog;
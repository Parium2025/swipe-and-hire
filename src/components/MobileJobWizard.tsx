import { useState, useEffect, useRef, useCallback } from 'react';
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
        import FileUpload from '@/components/FileUpload';
import JobPreview from '@/components/JobPreview';
import { useToast } from '@/hooks/use-toast';
import { categorizeJob } from '@/lib/jobCategorization';
import { EMPLOYMENT_TYPES, getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { filterCities, swedishCities } from '@/lib/swedishCities';
import { searchOccupations } from '@/lib/occupations';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, X, ChevronDown, MapPin, Building, Building2, Briefcase, Heart, Bookmark, Plus, Minus, Trash2, Clock, Banknote, FileText, CheckSquare, List, Video, Mail, Users, GripVertical, ArrowDown, Pencil } from 'lucide-react';
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
}

interface JobTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  occupation?: string;
  employment_type?: string;
  work_schedule?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  workplace_name?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_city?: string;
  positions_count?: string;
  pitch?: string;
  contact_email?: string;
  application_instructions?: string;
  category?: string;
  is_default: boolean;
  questions?: JobQuestion[];
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

interface MobileJobWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  selectedTemplate: JobTemplate | null;
  onJobCreated: (job: any) => void;
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
          <Button
            onClick={() => onEdit(question)}
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-6 w-6 p-0"
          >
            <Pencil className="h-3 w-3 text-[hsl(var(--pure-white))]" />
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

const MobileJobWizard = ({
  open, 
  onOpenChange, 
  jobTitle, 
  selectedTemplate, 
  onJobCreated,
  onBack
}: MobileJobWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  
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
  useEffect(() => {
    console.log('MobileJobWizard: open changed', open);
  }, [open]);
  
  // Always start from step 0 when opening
  useEffect(() => {
    if (open) {
      setCurrentStep(0); // Always start from beginning
    }
  }, [open]);
  
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
  const [initialCustomQuestions, setInitialCustomQuestions] = useState<JobQuestion[]>([]);
  
  // Company profile dialog
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);
  const [showCompanyTooltip, setShowCompanyTooltip] = useState(false);
  const [isScrolledTop, setIsScrolledTop] = useState(true);

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

  // Build meta line: "Deltid • Tyresö"
  const getMetaLine = (employment?: string, city?: string) => {
    const emp = getEmploymentTypeLabel(employment);
    const c = formatCityWithMainCity(city || '');
    return [emp, c].filter(Boolean).join(' • ');
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
    const metaLine = getMetaLine(formData.employment_type, formData.workplace_city || formData.location);

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
  const [workLocationSearchTerm, setWorkLocationSearchTerm] = useState('');
  const [showWorkLocationDropdown, setShowWorkLocationDropdown] = useState(false);
  const [remoteWorkSearchTerm, setRemoteWorkSearchTerm] = useState('');
  const [showRemoteWorkDropdown, setShowRemoteWorkDropdown] = useState(false);
  const [showHingePreview, setShowHingePreview] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [hingeMode, setHingeMode] = useState<'ad' | 'apply'>('ad');
  const screenRef = useRef<HTMLDivElement>(null);
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
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [bgPosition, setBgPosition] = useState<string>('center 50%');
  const [manualFocus, setManualFocus] = useState<number | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [cachedPostalCodeInfo, setCachedPostalCodeInfo] = useState<{postalCode: string, city: string, municipality: string, county: string} | null>(null);
  const [formData, setFormData] = useState<JobFormData>({
    title: jobTitle,
    description: selectedTemplate?.description || '',
    requirements: selectedTemplate?.requirements || '',
    location: selectedTemplate?.location || '',
    occupation: '',
    salary_min: selectedTemplate?.salary_min?.toString() || '',
    salary_max: selectedTemplate?.salary_max?.toString() || '',
    employment_type: selectedTemplate?.employment_type || '',
    salary_type: '',
  
    positions_count: '1',
    work_location_type: 'på-plats',
    remote_work_possible: 'nej',
    workplace_name: '',
    workplace_address: '',
    workplace_postal_code: '',
    workplace_city: '',
    work_schedule: selectedTemplate?.work_schedule || '',
    contact_email: selectedTemplate?.contact_email || '',
    application_instructions: selectedTemplate?.application_instructions || '',
    pitch: '',
    job_image_url: ''
  });

  // Smart text fit for occupation - uses break-words but reduces font-size if it would wrap
  const occupationRef = useSmartTextFit<HTMLDivElement>(formData.occupation || '', { minFontPx: 10 });

  // Visningsnamn: visa alltid användarens titel (inte AI-förslag)
  const getDisplayTitle = () => {
    return formData.title || 'Jobbtitel';
  };

  const { user } = useAuth();
  const { toast } = useToast();

  // Load user profile for company info
  useEffect(() => {
    if (user && open) {
      fetchProfile();
      fetchQuestionTemplates();
      // Load questions from template - works for all templates, not just default
      if (selectedTemplate?.questions && Array.isArray(selectedTemplate.questions)) {
        try {
          const templateQuestions = selectedTemplate.questions as any[];
          setCustomQuestions(templateQuestions.map((q: any, index: number) => ({
            ...q,
            id: `temp_${Date.now()}_${index}`,
            order_index: index
          })));
        } catch (error) {
          console.error('Error loading template questions:', error);
        }
      }
    }
  }, [user, open, selectedTemplate]);
  
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
  
  // Update form data when jobTitle or selectedTemplate changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      title: jobTitle,
      description: selectedTemplate?.description || prev.description,
      requirements: selectedTemplate?.requirements || prev.requirements,
      // Never auto-fill location from template - user must always set it manually
      occupation: selectedTemplate?.occupation || prev.occupation,
      salary_min: selectedTemplate?.salary_min?.toString() || prev.salary_min,
      salary_max: selectedTemplate?.salary_max?.toString() || prev.salary_max,
      salary_type: selectedTemplate?.salary_type || prev.salary_type,
      employment_type: selectedTemplate?.employment_type || prev.employment_type,
      work_location_type: selectedTemplate?.work_location_type || prev.work_location_type,
      remote_work_possible: selectedTemplate?.remote_work_possible || prev.remote_work_possible,
      workplace_name: selectedTemplate?.workplace_name || prev.workplace_name,
      workplace_address: selectedTemplate?.workplace_address || prev.workplace_address,
      positions_count: selectedTemplate?.positions_count || prev.positions_count,
      work_schedule: selectedTemplate?.work_schedule || prev.work_schedule,
      contact_email: selectedTemplate?.contact_email || prev.contact_email,
      application_instructions: selectedTemplate?.application_instructions || prev.application_instructions,
      pitch: selectedTemplate?.pitch || prev.pitch,
    }));
  }, [jobTitle, selectedTemplate]);
  
  // Set initial form data for unsaved changes tracking
  useEffect(() => {
    if (open && !initialFormData) {
      // Om vi öppnar med en template, sätt ett tomt initialFormData
      // så att template-data räknas som en ändring
      if (selectedTemplate) {
        setInitialFormData({
          title: '',
          description: '',
          requirements: '',
          location: '',
          occupation: '',
          salary_min: '',
          salary_max: '',
          employment_type: '',
          salary_type: '',
          positions_count: '',
          work_schedule: '',
          work_location_type: '',
          remote_work_possible: '',
          workplace_name: '',
          workplace_address: '',
          workplace_postal_code: '',
          workplace_city: '',
          contact_email: '',
          application_instructions: '',
          pitch: '',
          job_image_url: ''
        });
        setInitialCustomQuestions([]);
        setHasUnsavedChanges(true); // Markera som ändrad från start
      } else {
        // Ingen template vald, använd aktuell formData som start
        setInitialFormData({ ...formData });
        setInitialCustomQuestions([]);
        setHasUnsavedChanges(false);
      }
    }
  }, [open, selectedTemplate, formData, initialFormData]);
  
  // Track form changes
  useEffect(() => {
    if (!initialFormData || !open) return;
    
    const formChanged = Object.keys(formData).some(key => {
      return formData[key as keyof JobFormData] !== initialFormData[key as keyof JobFormData];
    });
    const questionsChanged = JSON.stringify(customQuestions) !== JSON.stringify(initialCustomQuestions);
    
    setHasUnsavedChanges(formChanged || questionsChanged);
  }, [formData, customQuestions, initialFormData, initialCustomQuestions, open]);

  // Show company tooltip only on step 4 (visible and persistent while on this step)
  useEffect(() => {
    setShowCompanyTooltip(currentStep === 3 && open);
  }, [currentStep, open]);

  // Resolve signed URL for uploaded job image preview
  useEffect(() => {
    const url = formData.job_image_url;
    let cancelled = false;
    (async () => {
      if (!url) { setJobImageDisplayUrl(null); return; }
      if (url.startsWith('http')) { setJobImageDisplayUrl(url); return; }
      const signed = await createSignedUrl('job-applications', url, 86400);
      if (!cancelled) setJobImageDisplayUrl(signed);
    })();
    return () => { cancelled = true; };
  }, [formData.job_image_url]);

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

  const handleImageEdit = async (editedImageBlob: Blob) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('Du måste vara inloggad för att ladda upp filer');
      }

      // Skapa ett unikt filnamn för den redigerade bilden
      const fileExt = 'png'; // ImageEditor sparar alltid som PNG
      const fileName = `${user.data.user.id}/${Date.now()}-edited-job-image.${fileExt}`;

      // Ladda upp den redigerade bilden till Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, editedImageBlob);

      if (uploadError) throw uploadError;

      // Skapa signed URL och uppdatera formuläret
      const signedUrl = await createSignedUrl('job-applications', fileName, 86400);
      if (!signedUrl) {
        throw new Error('Could not create secure access URL');
      }

      // Uppdatera med storage path (fileName) istället för blob URL
      handleInputChange('job_image_url', fileName);
      setJobImageDisplayUrl(signedUrl);
      // Behåll originalImageUrl oförändrad så vi alltid kan fortsätta redigera från originalet
      setManualFocus(null);
      
      setShowImageEditor(false);
      setEditingImageUrl(null);
      
      toast({
        title: "Bild justerad",
        description: "Din bild har justerats och sparats framgångsrikt",
      });
    } catch (error) {
      console.error('Error saving edited image:', error);
      toast({
        title: "Fel",
        description: error instanceof Error ? error.message : "Kunde inte spara den redigerade bilden",
        variant: "destructive",
      });
    }
  };

  // Öppna editor med originalbildens signerade URL
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

  // Update form data when props change - preserve existing values
  useEffect(() => {
    // Initiera titel från jobTitle ENDAST om fältet är tomt (skriven text ska inte överskrivas)
    if (jobTitle && !formData.title) {
      setFormData(prev => ({ ...prev, title: jobTitle }));
    }
    
    // Only reset form if it's completely empty or when a template is selected
    const isFormEmpty = !formData.title && !formData.occupation;
    const shouldUpdateFromTemplate = selectedTemplate && 
      (formData.title !== selectedTemplate.title || formData.description !== selectedTemplate.description);
    
    if (isFormEmpty || shouldUpdateFromTemplate) {
      setFormData(prev => ({
        title: (!prev.title || prev.title === selectedTemplate?.title ? (jobTitle || selectedTemplate?.title || prev.title) : prev.title),
        description: selectedTemplate?.description || prev.description,
        requirements: selectedTemplate?.requirements || prev.requirements,
        location: prev.location, // Never override location from template
        occupation: selectedTemplate?.occupation || prev.occupation,
        salary_min: selectedTemplate?.salary_min?.toString() || prev.salary_min,
        salary_max: selectedTemplate?.salary_max?.toString() || prev.salary_max,
        employment_type: selectedTemplate?.employment_type || prev.employment_type,
        salary_type: selectedTemplate?.salary_type || prev.salary_type,
        positions_count: selectedTemplate?.positions_count || prev.positions_count || '1',
        work_location_type: selectedTemplate?.work_location_type || prev.work_location_type || 'på-plats',
        remote_work_possible: selectedTemplate?.remote_work_possible || prev.remote_work_possible || 'nej',
        workplace_name: selectedTemplate?.workplace_name || prev.workplace_name || profile?.company_name || '',
        workplace_address: selectedTemplate?.workplace_address || prev.workplace_address || '',
        workplace_postal_code: prev.workplace_postal_code || '', // Never from template
        workplace_city: prev.workplace_city || '', // Never from template
        work_schedule: selectedTemplate?.work_schedule || prev.work_schedule,
        contact_email: prev.contact_email || selectedTemplate?.contact_email || user?.email || '',
        application_instructions: selectedTemplate?.application_instructions || prev.application_instructions,
        pitch: selectedTemplate?.pitch || prev.pitch || '',
        job_image_url: prev.job_image_url || ''
      }));
      
      // Never auto-fill city from template - user must set location manually each time
    }
    
    // Update workplace name and contact email if they're empty but we have new data
    if (!formData.workplace_name && profile?.company_name) {
      setFormData(prev => ({ ...prev, workplace_name: profile.company_name }));
    }
    if (!formData.contact_email && user?.email) {
      setFormData(prev => ({ ...prev, contact_email: user.email }));
    }
  }, [jobTitle, selectedTemplate, profile?.company_name, user?.email]);

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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuestionTypeDropdown, showOccupationDropdown, showEmploymentTypeDropdown, showSalaryTypeDropdown, showWorkLocationDropdown, showRemoteWorkDropdown]);
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

  // Format salary information for display
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

  const handleQuestionTypeClick = () => {
    setQuestionTypeSearchTerm(''); // Reset search to show all options
    setShowQuestionTypeDropdown(!showQuestionTypeDropdown);
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
    setEmploymentTypeSearchTerm(''); // Reset search to show all options
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
    setSalaryTypeSearchTerm(''); // Reset search to show all options
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
      location: location // Auto-update main location field from postal code
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
    
    if (currentStep === 2) {
      return true; // Kontakt flyttat till steg 2, så inga krav här
    }
    
    if (currentStep === 3) {
      return true; // Förhandsvisning kräver ingen validering
    }
    
    return true;
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
      // Reset everything completely
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
        pitch: '',
        job_image_url: ''
      });
      setCustomQuestions([]);
      setJobImageDisplayUrl(null);
      setOriginalImageUrl(null);
      setCachedPostalCodeInfo(null);
      setInitialFormData(null);
      setHasUnsavedChanges(false);
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
    // Reset everything completely and close
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
      pitch: '',
      job_image_url: ''
    });
    setCustomQuestions([]);
    setJobImageDisplayUrl(null);
    setOriginalImageUrl(null);
    setCachedPostalCodeInfo(null);
    setInitialFormData(null);
    setHasUnsavedChanges(false);
    setShowUnsavedDialog(false);
    setPendingClose(false);
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

  const handleSubmit = async () => {
    if (!user || !validateCurrentStep() || loading) return;

    setLoading(true);

    try {
      const category = categorizeJob(formData.title, formData.description, formData.occupation);
      
      const jobData = {
        employer_id: user.id,
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
        job_image_url: formData.job_image_url || null,
        category,
        is_active: true
      };

      const { data: jobPost, error } = await supabase
        .from('job_postings')
        .insert([jobData])
        .select()
        .single();

      if (error) {
        toast({
          title: "Fel vid skapande av annons",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      // Save questions to job_questions table if there are any
      if (customQuestions.length > 0 && jobPost) {
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

      // If using default template, update it with the questions for future use
      if (selectedTemplate?.is_default && customQuestions.length > 0) {
        const { error: templateError } = await supabase
          .from('job_templates')
          .update({ 
            questions: customQuestions.map(q => ({
              question_text: q.question_text,
              question_type: q.question_type,
              options: q.options || [],
              is_required: q.is_required,
              order_index: q.order_index,
              placeholder_text: q.placeholder_text || null,
              min_value: q.min_value || null,
              max_value: q.max_value || null
            }))
          })
          .eq('id', selectedTemplate.id);

        if (templateError) {
          console.error('Error updating template questions:', templateError);
        }
      }

      toast({
        title: "Jobbannons skapad!",
        description: "Din annons är nu publicerad och synlig för jobbsökare."
      });

      handleClose();
      onJobCreated(jobPost);

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
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="parium-panel max-w-none w-[min(92vw,400px)] h-auto max-h-[75vh] sm:max-h-[80vh] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <AnimatedBackground showBubbles={false} />
        <div className="flex flex-col h-full max-h-[75vh] sm:max-h-[80vh] relative z-10">
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
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {/* Show filtered occupations */}
                        {filteredOccupations.map((occupation, index) => (
                          <button
                            key={`${occupation}-${index}`}
                            type="button"
                            onClick={() => handleOccupationSelect(occupation)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 text-white text-sm border-b border-gray-700 last:border-b-0"
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
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 text-white text-sm border-t border-gray-700/30"
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



                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Anställningsform *</Label>
                  <div className="relative employment-type-dropdown">
                    <Input
                      value={employmentTypeSearchTerm || (formData.employment_type ? EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label || '' : '')}
                      onChange={(e) => handleEmploymentTypeSearch(e.target.value)}
                      onClick={handleEmploymentTypeClick}
                      placeholder="Välj anställningsform"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {/* Employment Type Dropdown */}
                    {showEmploymentTypeDropdown && (
                       <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 shadow-lg">
                        {filteredEmploymentTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleEmploymentTypeSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 text-white text-sm border-b border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Lönetyp</Label>
                  <div className="relative salary-type-dropdown">
                    <Input
                      value={salaryTypeSearchTerm || (formData.salary_type ? salaryTypes.find(t => t.value === formData.salary_type)?.label || '' : '')}
                      onChange={(e) => handleSalaryTypeSearch(e.target.value)}
                      onClick={handleSalaryTypeClick}
                      placeholder="Välj lönetyp"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 cursor-pointer focus:border-white/40"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {/* Salary Type Dropdown */}
                    {showSalaryTypeDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredSalaryTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleSalaryTypeSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 text-white text-sm border-b border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium text-sm">Antal personer att rekrytera</Label>
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
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredWorkLocationTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleWorkLocationSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 text-white text-sm border-b border-gray-700 last:border-b-0"
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
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {filteredRemoteWorkOptions.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleRemoteWorkSelect(type)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 text-white text-sm border-b border-gray-700 last:border-b-0"
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
                                        <div className="text-white font-medium text-sm leading-tight truncate">
                                          {template.question_text}
                                        </div>
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          onClick={() => {
                                            // Edit template - open it in edit mode
                                            setEditingQuestion({
                                              ...template,
                                              template_id: template.id
                                            });
                                            setShowQuestionTemplates(false);
                                            setShowQuestionForm(true);
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="text-primary hover:text-primary hover:bg-primary/15 h-6 w-6 p-0 flex-shrink-0"
                                        >
                                          <Pencil className="h-3 w-3 text-[hsl(var(--pure-white))]" />
                                        </Button>
                                        <Button
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
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 h-6 w-6 p-0 flex-shrink-0"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
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
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pr-10 cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                            readOnly
                          />
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                          
                          {/* Question Type Dropdown */}
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
                              placeholder="T.ex. Ålder, Antal års erfarenhet, Antal anställda..."
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

                      {/* Multiple Choice Options */}
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
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm"
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
                              Lägg till alternativ
                              <Plus className="h-4 w-4 ml-1 text-[hsl(var(--pure-white))]" />
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
                          className="bg-primary hover:bg-primary/90 text-white touch-border-white-thick"
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
                {/* Mobile Mockup Preview - Mobilansökningsformulär */}
                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-white font-medium">Så kommer ansökningsformuläret att se ut på mobil. (Testa att trycka på mobilens skärm)</h3>
                  
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
                      <div className="relative w-full h-full rounded-[1.6rem] overflow-hidden bg-black">
                        {/* iPhone notch */}
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 h-1 w-8 rounded-full bg-black border border-gray-800"></div>

                        {/* Mobilansökningsformulär med korrekt Parium bakgrund */}
                        <div className="absolute inset-0 rounded-[1.6rem] overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}>
                          {/* Status bar */}
                          <div className="h-1 bg-black relative z-10"></div>
                          
                           {/* Form container (toggle) */}
                           <div className={showApplicationForm ? 'flex flex-col h-full' : 'hidden'}>
                             <div className="flex items-center justify-between px-2 py-1.5 bg-black/20 border-b border-white/20 relative z-10 flex-shrink-0 rounded-t-[1.6rem]">
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
                               className="px-2 py-2 overflow-y-auto relative z-10 custom-scrollbar flex-1"
                               onClick={(e) => {
                                 // Close all dropdowns when clicking anywhere in the scroll area
                                 const dropdowns = e.currentTarget.querySelectorAll('.bg-gray-800.border.border-gray-600');
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
                                       className="text-xs font-bold text-white hover:text-primary transition-colors cursor-pointer whitespace-normal break-words leading-tight"
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
                                             className="w-full border border-white/20 bg-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/60 resize-none"
                                             placeholder={question.placeholder_text || 'Skriv ditt svar...'}
                                             rows={2}
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
                                          <div className="space-y-1">
                                            <p className="text-[10px] text-white/60 mb-1">Alternativ:</p>
                                            <div className="space-y-1">
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
                                                     className={
                                                       (selected
                                                         ? 'bg-secondary/40 border border-secondary text-white '
                                                         : 'bg-white/5 border border-white/10 text-white ') +
                                                        'w-full flex items-center gap-2 rounded px-2 py-1 transition-colors cursor-pointer'
                                                      }
                                                  >
                                                     <div className={
                                                       selected
                                                         ? 'w-2 h-2 rounded-sm bg-white flex-shrink-0 flex items-center justify-center'
                                                         : 'w-2 h-2 rounded-sm border border-white/40 flex-shrink-0'
                                                     }>
                                                       {selected && (
                                                         <svg className="w-1.5 h-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                         </svg>
                                                       )}
                                                    </div>
                                                     <span className="text-xs text-white/90">{option}</span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {question.question_type === 'number' && (
                                          <div className="space-y-1.5">
                                            <div className="text-center text-sm font-semibold text-white" id={`number-value-${index}`}>
                                              {question.min_value ?? 0}
                                            </div>
                                            <input
                                              type="range"
                                              min={question.min_value ?? 0}
                                              max={question.max_value ?? 100}
                                              defaultValue={question.min_value ?? 0}
                                              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-secondary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                              onChange={(e) => {
                                                const valueDisplay = document.getElementById(`number-value-${index}`);
                                                if (valueDisplay) valueDisplay.textContent = e.target.value;
                                              }}
                                            />
                                          </div>
                                        )}
                                        
                                        {question.question_type === 'date' && (
                                          <input
                                            type="date"
                                            className="w-full border border-white/20 bg-white/10 rounded p-2 text-sm text-white placeholder:text-white/60 h-9"
                                            placeholder={question.placeholder_text}
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

                {/* Image upload section */}
                <div className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/20">
                  <div className="text-white font-medium text-sm sm:text-base mb-2">Jobbild (valfritt)</div>
                  <p className="text-white text-xs sm:text-sm mb-3">
                    Ladda upp en bild som representerar jobbet eller arbetsplatsen
                  </p>
                  
                  {!jobImageDisplayUrl && (
                    <FileUpload
                      onFileUploaded={(url, fileName) => {
                        handleInputChange('job_image_url', url);
                        setOriginalImageUrl(url); // Spara originalbilden
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
                              setManualFocus(null);
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 transition-colors md:hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                      </div>
                      
                      {/* Bildkontroller */}
                      <div className="mt-4 space-y-3">
                        <div className="flex justify-center">
                          <button
                            onClick={openImageEditor}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            Justera bild
                          </button>
                        </div>
                        <p className="text-sm text-white text-center">
                          Klicka för att zooma, panorera och justera bilden
                        </p>
                      </div>
                    </>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Navigation */}
          {!showQuestionTemplates && !showQuestionForm && (
            <div className="flex items-center justify-between p-4 border-t border-white/20 flex-shrink-0">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="bg-white/5 backdrop-blur-sm border-white/20 text-white px-6 transition-all duration-300 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>

              {isLastStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !validateCurrentStep()}
                  className="bg-green-600/80 hover:bg-green-600 md:hover:bg-green-600 text-white px-6 transition-all duration-300"
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
                  className="bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-6 touch-border-white focus:ring-2 focus:ring-white/40 transition-all duration-300"
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
            isCircular={false}
            aspectRatio={1/2} // Telefonens skärmyta (w/h) för perfekt matchning
          />
        )}

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onOpenChange={setShowUnsavedDialog}
          onConfirm={handleConfirmClose}
          onCancel={handleCancelClose}
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
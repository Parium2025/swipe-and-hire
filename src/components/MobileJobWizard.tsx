import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
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
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, X, ChevronDown, MapPin, Building, Building2, Briefcase, Heart, Bookmark, Plus, Trash2, Clock, Banknote, FileText, CheckSquare, List, Video, Mail, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getCachedPostalCodeInfo, formatPostalCodeInput, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import ImageEditor from '@/components/ImageEditor';
import { createSignedUrl } from '@/utils/storageUtils';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import useSmartTextFit from '@/hooks/useSmartTextFit';

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

interface JobTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  employment_type?: string;
  work_schedule?: string;
  salary_min?: number;
  salary_max?: number;
  contact_email?: string;
  application_instructions?: string;
  category?: string;
  is_default: boolean;
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
  onJobCreated: () => void;
}

const MobileJobWizard = ({ 
  open, 
  onOpenChange, 
  jobTitle, 
  selectedTemplate, 
  onJobCreated 
}: MobileJobWizardProps) => {
  const deviceInfo = useDeviceDetection();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [customQuestions, setCustomQuestions] = useState<JobQuestion[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<JobQuestion | null>(null);
  
  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [initialFormData, setInitialFormData] = useState<JobFormData | null>(null);

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
      return { fontSize: 'text-xs', lineHeight: 'leading-tight' };
    } else {
      return { fontSize: 'text-xs', lineHeight: 'leading-none' };
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
    let companySizeClass = 'text-xs'; // Start smaller for company
    let titleSizeClass = 'text-lg';   // Make title more prominent 
    let metaSizeClass = 'text-sm';    // Readable meta info

    // Adjust title size based on length - this is the hero element
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

    // Adjust company name - keep it subtle but readable
    if (companyLength > 15) {
      companySizeClass = 'text-xs';
    } else if (companyLength < 8) {
      companySizeClass = 'text-sm';
    }

    // Ensure meta info is always readable
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
    }
  }, [user, open]);
  
  // Set initial form data for unsaved changes tracking
  useEffect(() => {
    if (open && !initialFormData) {
      setInitialFormData({ ...formData });
      setHasUnsavedChanges(false);
    }
  }, [open, formData, initialFormData]);
  
  // Track form changes
  useEffect(() => {
    if (!initialFormData || !open) return;
    
    const hasChanges = Object.keys(formData).some(key => {
      return formData[key as keyof JobFormData] !== initialFormData[key as keyof JobFormData];
    }) || customQuestions.length > 0;
    
    setHasUnsavedChanges(hasChanges);
  }, [formData, customQuestions, initialFormData, open]);

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
    const newQuestion: JobQuestion = {
      question_text: '',
      question_type: 'text', // Default to text but we'll make user choose
      is_required: true,
      order_index: customQuestions.length,
      options: []
    };
    setEditingQuestion(newQuestion);
    setShowQuestionForm(true);
  };

  const saveCustomQuestion = () => {
    if (!editingQuestion?.question_text.trim()) return;
    
    if (editingQuestion.id) {
      // Update existing question
      setCustomQuestions(prev => 
        prev.map(q => q.id === editingQuestion.id ? editingQuestion : q)
      );
    } else {
      // Add new question
      const newQuestion = {
        ...editingQuestion,
        id: `temp_${Date.now()}`,
        order_index: customQuestions.length
      };
      setCustomQuestions(prev => [...prev, newQuestion]);
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
    const isFormEmpty = !formData.title && !formData.location && !formData.occupation;
    const shouldUpdateFromTemplate = selectedTemplate && 
      (formData.title !== selectedTemplate.title || formData.description !== selectedTemplate.description);
    
    if (isFormEmpty || shouldUpdateFromTemplate) {
      const newLocation = selectedTemplate?.location || '';
      setFormData(prev => ({
        title: (!prev.title || prev.title === selectedTemplate?.title ? (jobTitle || selectedTemplate?.title || prev.title) : prev.title),
        description: selectedTemplate?.description || prev.description,
        requirements: selectedTemplate?.requirements || prev.requirements,
        location: newLocation || prev.location,
        occupation: prev.occupation,
        salary_min: selectedTemplate?.salary_min?.toString() || prev.salary_min,
        salary_max: selectedTemplate?.salary_max?.toString() || prev.salary_max,
        employment_type: selectedTemplate?.employment_type || prev.employment_type,
        salary_type: prev.salary_type || '',
        positions_count: prev.positions_count || '1',
        work_location_type: prev.work_location_type || 'på-plats',
        remote_work_possible: prev.remote_work_possible || 'nej',
        workplace_name: prev.workplace_name || profile?.company_name || '',
        workplace_address: prev.workplace_address || '',
        workplace_postal_code: prev.workplace_postal_code || '',
        workplace_city: prev.workplace_city || '',
        work_schedule: selectedTemplate?.work_schedule || prev.work_schedule,
        contact_email: prev.contact_email || selectedTemplate?.contact_email || user?.email || '',
        application_instructions: selectedTemplate?.application_instructions || prev.application_instructions,
        pitch: prev.pitch || '',
        job_image_url: prev.job_image_url || ''
      }));
      
      // Update city search term when template location changes
      if (selectedTemplate?.location) {
        setCitySearchTerm(selectedTemplate.location);
      }
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
      title: "Förhandsvisning",
      fields: []
    },
    {
      title: "Kontakt",
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
    { value: 'number', label: 'Siffra' },
    { value: 'date', label: 'Datum' },
    { value: 'range', label: 'Intervall' }
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
    if (!email) return 'text-xs';
    
    const length = email.length;
    if (length <= 15) return 'text-xs'; // Short emails get normal size
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

  const handleWorkplacePostalCodeChange = (postalCode: string) => {
    handleInputChange('workplace_postal_code', postalCode);
  };

  const handleWorkplaceLocationChange = (location: string) => {
    setFormData(prev => ({
      ...prev,
      workplace_city: location,
      location: location // Auto-update main location field from postal code
    }));
  };

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
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
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
      // Reset form state
      setCurrentStep(0);
      setFormData({
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
      setCustomQuestions([]);
      setJobImageDisplayUrl(null);
      setOriginalImageUrl(null);
      setInitialFormData(null);
      setHasUnsavedChanges(false);
      onOpenChange(false);
    }
  };

  const handleConfirmClose = () => {
    // Reset everything and close
    setCurrentStep(0);
    setFormData({
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
    setCustomQuestions([]);
    setJobImageDisplayUrl(null);
    setOriginalImageUrl(null);
    setInitialFormData(null);
    setHasUnsavedChanges(false);
    setShowUnsavedDialog(false);
    setPendingClose(false);
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowUnsavedDialog(false);
    setPendingClose(false);
  };

  const handleSubmit = async () => {
    if (!user || !validateCurrentStep()) return;

    setLoading(true);

    try {
      const category = categorizeJob(formData.title, formData.description, formData.occupation);
      
      const jobData = {
        employer_id: user.id,
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || null,
        location: formData.location,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        employment_type: formData.employment_type || null,
        positions_count: formData.positions_count ? parseInt(formData.positions_count) : 1,
        work_schedule: formData.work_schedule || null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        workplace_name: formData.workplace_name || null,
        workplace_address: formData.workplace_address || null,
        workplace_postal_code: formData.workplace_postal_code || null,
        workplace_city: formData.workplace_city || null,
        category
      };

      const { error } = await supabase
        .from('job_postings')
        .insert([jobData]);

      if (error) {
        toast({
          title: "Fel vid skapande av annons",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Jobbannons skapad!",
        description: "Din annons är nu publicerad och synlig för jobbsökare."
      });

      handleClose();

    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skapa jobbannonsen.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-parium-gradient border-white/20 text-white [&>button]:hidden p-0 flex flex-col h-[90vh]" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex flex-col h-full justify-between">
          {/* Header with proper safe area */}
          <div className="flex items-center justify-between p-4 border-b border-white/20 flex-shrink-0" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
            <DialogHeader className="flex-1">
              <DialogTitle className="text-white text-lg">
                {steps[currentStep].title}
              </DialogTitle>
              <div className="text-sm text-white/70">
                Steg {currentStep + 1} av {steps.length}
              </div>
            </DialogHeader>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-10 w-10 text-white hover:text-white hover:bg-white/20 flex-shrink-0"
            >
              <X className="h-5 w-5" />
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
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-8 flex items-center justify-center">
            <div className="w-full max-w-sm mx-auto space-y-6">
            {/* Step 1: Grundinfo */}
            {currentStep === 0 && (
              <div className="space-y-6 text-center">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Skapa ditt jobb</h2>
                  <p className="text-white/70 text-sm">Namnge ett jobb eller välj en utav dina färdig mallar för att komma igång</p>
                </div>
                
                <div className="space-y-4 text-left">
                  <Label className="text-white font-medium text-left block">Jobbtitel *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="t.ex. Lagerarbetare"
                    maxLength={100}
                    className="lovable-input"
                  />
                </div>
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
                    
                    {/* Occupation Dropdown */}
                    {showOccupationDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {/* Show filtered occupations */}
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
                        
                        {/* Custom value option if no matches and search term exists */}
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
                        
                        {/* Show message if search is too short */}
                        {occupationSearchTerm.trim().length > 0 && occupationSearchTerm.trim().length < 2 && (
                          <div className="py-4 px-3 text-center text-gray-400 italic text-sm">
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
                    
                    {/* Employment Type Dropdown */}
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
                    
                    {/* Salary Type Dropdown */}
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

            {/* Step 2: Var finns jobbet? */}
            {currentStep === 1 && (
              <div className="space-y-6 text-center">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Var finns jobbet?</h2>
                  <p className="text-white/70 text-sm">Beskriv var arbetet utförs och hur man kan söka</p>
                </div>
                
                <div className="space-y-4 text-left">
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
                    
                    {/* Work Location Dropdown */}
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
                    
                    {/* Remote Work Dropdown */}
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
              <div className="space-y-6 text-center">
                {!showQuestionForm ? (
                  <>
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-white mb-2">Ansökningsfrågor</h2>
                      <p className="text-white/70 text-sm">Skapa frågor som jobbsökarna ska besvara i sin ansökan</p>
                    </div>

                    {/* Automatiska frågor info */}
                    <div className="bg-white/5 rounded-lg p-4 border border-white/20">
                      <p className="text-white/90 text-sm font-medium mb-3 text-center">
                        Dessa frågor fylls automatiskt från jobbsökarens profil
                      </p>
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
                        <div className="space-y-3">
                          {customQuestions.map((question, index) => (
                            <div key={question.id} className="bg-white/5 rounded-lg p-4 border border-white/20">
                              <div className="flex items-start justify-between">
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
                                <div className="flex items-center space-x-2 ml-4">
                                  <Button
                                    onClick={() => editCustomQuestion(question)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                                  >
                                    ✏️
                                  </Button>
                                  <Button
                                    onClick={() => deleteCustomQuestion(question.id!)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
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
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-white/70 hover:text-white hover:bg-white/10"
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
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
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

                      {/* Question Text - only show after question type is selected */}
                      {editingQuestion?.question_type && (
                        <div className="space-y-2">
                          <Label className="text-white font-medium">Frågetext *</Label>
                          <Textarea
                            value={editingQuestion?.question_text || ''}
                            onChange={(e) => updateQuestionField('question_text', e.target.value)}
                            placeholder="Skriv din fråga här..."
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 resize-none"
                            rows={2}
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
                              className="border-white/20 text-white hover:bg-white/10"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Lägg till alternativ
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Range/Number Options */}
                      {(['range', 'number'].includes(editingQuestion?.question_type || '')) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-white font-medium">Min värde</Label>
                            <Input
                              type="number"
                              value={editingQuestion?.min_value || ''}
                              onChange={(e) => updateQuestionField('min_value', e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="0"
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white font-medium">Max värde</Label>
                            <Input
                              type="number"
                              value={editingQuestion?.max_value || ''}
                              onChange={(e) => updateQuestionField('max_value', e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="100"
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                            />
                          </div>
                        </div>
                      )}

                      {/* Placeholder Text */}
                      {['text', 'number'].includes(editingQuestion?.question_type || '') && (
                        <div className="space-y-2">
                          <Label className="text-white font-medium">Platshållartext</Label>
                          <Input
                            value={editingQuestion?.placeholder_text || ''}
                            onChange={(e) => updateQuestionField('placeholder_text', e.target.value)}
                            placeholder="Exempeltext som visas i fältet..."
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                          />
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
                      <div className="flex justify-end space-x-2 pt-4">
                        <Button
                          onClick={() => {
                            setShowQuestionForm(false);
                            setEditingQuestion(null);
                          }}
                          variant="ghost"
                          className="text-white/70 hover:text-white hover:bg-white/10"
                        >
                          Avbryt
                        </Button>
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
              <div className="space-y-6 text-center">
                {/* Mobile Mockup Preview - Mobilansökningsformulär */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Förhandsvisning</h2>
                  <p className="text-white/70 text-sm">Se hur ditt jobb kommer att se ut för jobbsökarna</p>
                </div>
                
                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-white font-medium">Så kommer ansökningsformuläret att se ut på mobil:</h3>
                  
                  {/* Phone mockup med ansökningsformulär */}
                  <section aria-label="Mobilansökningsformulär förhandsvisning" className="relative w-[160px] h-[320px] mx-auto">
                    {/* iPhone-stil telefonram */}
                    <div className="relative w-full h-full rounded-[2rem] bg-black p-1 shadow-2xl">
                      {/* Skärm */}
                      <div className="relative w-full h-full rounded-[1.6rem] overflow-hidden bg-black">
                        {/* iPhone notch */}
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 h-1 w-8 rounded-full bg-black border border-gray-800"></div>

                        {/* Mobilansökningsformulär med korrekt Parium bakgrund */}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, hsl(215 100% 8%) 0%, hsl(215 90% 15%) 25%, hsl(200 70% 25%) 75%, hsl(200 100% 60%) 100%)' }}>
                          {/* Status bar */}
                          <div className="h-1 bg-black relative z-10"></div>
                          
                           {/* Form container (toggle) */}
                           <div className={showApplicationForm ? 'flex flex-col h-full' : 'hidden'}>
                             <div className="flex items-center justify-between px-2 py-1.5 bg-black/20 backdrop-blur-sm border-b border-white/20 relative z-10 flex-shrink-0">
                               <div className="text-xs font-bold text-white">Ansökningsformulär</div>
                               <button onClick={() => setShowApplicationForm(false)} className="text-xs text-white/80 hover:text-white" aria-label="Stäng ansökningsformulär">✕</button>
                             </div>

                             {/* Scrollable content */}
                           <div 
                             className="px-2 py-2 overflow-y-auto relative z-10 custom-scrollbar flex-1"
                           >
                             <div className="space-y-3 pb-16">{/* Extra padding för scrollning */}
                              
                               {/* Företagsinformation */}
                               <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
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
                                   <div className="text-xs font-bold text-white">{profile?.company_name || 'Företagsnamn'}</div>
                                 </div>
                                </div>

                                {/* Yrke */}
                                {formData.occupation && (
                                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 mb-2">
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

                                {/* Jobbeskrivning */}
                                {formData.description && (
                                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 mb-2">
                                    <h5 className="text-xs font-medium text-white mb-1">Jobbeskrivning</h5>
                                    <div className="text-xs text-white leading-relaxed whitespace-pre-wrap break-words [&>*]:mb-1 [&>*:last-child]:mb-0">
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
                                 <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 mb-2">
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


                                {/* Arbetsplats */}
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
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
                                     {formData.workplace_city && formData.workplace_postal_code && (
                                       <div>
                                         <div>{formData.workplace_postal_code} {formData.workplace_city}</div>
                                         <div>{getWorkLocationDisplayText()}</div>
                                       </div>
                                     )}
                                   </div>
                                 </div>

                                 {/* Antal rekryteringar */}
                                 {formData.positions_count && parseInt(formData.positions_count) > 0 && (
                                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 mb-2">
                                     <h5 className="text-xs font-medium text-white mb-1 flex items-center whitespace-nowrap">
                                       <Users className="h-2 w-2 mr-1 text-white" />
                                       Antal rekryteringar
                                     </h5>
                                      <div className="text-xs text-white leading-relaxed break-words">
                                        <div className="font-medium">{formatPositionsCount()}</div>
                                      </div>
                                   </div>
                                 )}

                                 {/* Kontakt */}
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
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

                              {/* Krav och kvalifikationer */}
                              {formData.requirements && (
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                                  <h4 className="text-xs font-semibold text-white mb-1">Kvalifikationer</h4>
                                  <p className="text-xs text-white leading-relaxed">
                                    {formData.requirements.length > 100 
                                      ? formData.requirements.substring(0, 100) + '...' 
                                      : formData.requirements
                                    }
                                  </p>
                                </div>
                              )}

                               {/* Följande information samlas automatiskt in från alla kandidater */}
                               <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
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

                              {/* Anpassade frågor med Parium styling */}
                              {customQuestions.length > 0 && (
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center">
                                    <CheckSquare className="h-3 w-3 mr-1 text-secondary" />
                                    Anpassade frågor ({customQuestions.length})
                                  </h4>
                                  
                                  <div className="space-y-2">
                                    {customQuestions.slice(0, 3).map((question, index) => (
                                      <div key={question.id || index} className="space-y-1">
                                        <label className="text-xs text-white flex items-start">
                                          <span className="mr-1 text-secondary font-medium">Q{index + 1}.</span>
                                          <span className="flex-1 leading-tight">
                                            {question.question_text.length > 40 ? 
                                              question.question_text.substring(0, 40) + '...' : 
                                              question.question_text
                                            }
                                            {question.is_required && <span className="text-red-400 ml-1">*</span>}
                                          </span>
                                        </label>
                                        
                                        {/* Input förhandsvisning baserat på frågetyp */}
                                        {question.question_type === 'text' && (
                                          <textarea
                                            className="w-full border border-white/20 bg-white/10 backdrop-blur-sm rounded p-1 text-xs text-white placeholder:text-white/60 resize-none"
                                            placeholder={question.placeholder_text || 'Skriv ditt svar...'}
                                            rows={2}
                                            disabled
                                          />
                                        )}
                                        
                                        {question.question_type === 'yes_no' && (
                                          <div className="flex space-x-2">
                                            <div className="flex items-center space-x-1">
                                              <input type="radio" className="w-2 h-2 accent-secondary" disabled />
                                              <label className="text-xs text-white">Ja</label>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                              <input type="radio" className="w-2 h-2 accent-secondary" disabled />
                                              <label className="text-xs text-white">Nej</label>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {question.question_type === 'multiple_choice' && (
                                          <div className="space-y-1">
                                            {question.options?.slice(0, 2).map((option, optIndex) => (
                                              <div key={optIndex} className="flex items-center space-x-1">
                                                <input type="radio" className="w-2 h-2 accent-secondary" disabled />
                                                <label className="text-xs text-white">
                                                  {option.length > 20 ? option.substring(0, 20) + '...' : option}
                                                </label>
                                              </div>
                                            ))}
                                            {question.options && question.options.length > 2 && (
                                              <div className="text-xs text-white/60">+ {question.options.length - 2} fler</div>
                                            )}
                                          </div>
                                        )}
                                        
                                        {(question.question_type === 'number' || question.question_type === 'date') && (
                                          <input
                                            type={question.question_type}
                                            className="w-full border border-white/20 bg-white/10 backdrop-blur-sm rounded p-1 text-xs text-white placeholder:text-white/60"
                                            placeholder={question.placeholder_text}
                                            disabled
                                          />
                                        )}
                                        
                                        {(question.question_type === 'file' || question.question_type === 'video') && (
                                          <div className="border-2 border-dashed border-white/30 rounded p-2 text-center bg-white/5">
                                            {question.question_type === 'file' ? (
                                              <FileText className="h-4 w-4 mx-auto mb-1 text-white/60" />
                                            ) : (
                                              <Video className="h-4 w-4 mx-auto mb-1 text-white/60" />
                                            )}
                                            <p className="text-xs text-white/60">
                                              {question.question_type === 'file' ? 'Välj fil' : 'Spela in video'}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    
                                    {customQuestions.length > 3 && (
                                      <div className="text-xs text-white/60 text-center py-1">
                                        + {customQuestions.length - 3} fler frågor...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Extra space for scrolling */}
                              <div className="h-4"></div>
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
                              className="absolute inset-0 flex flex-col justify-start items-center pt-10 p-3 text-white text-center cursor-pointer"
                              onClick={() => setShowApplicationForm(true)}
                            >
              {(() => {
                const textSizes = getSmartTextSizes();
                return (
                  <>
                    <div className={`${textSizes.company} text-white font-medium mb-1`}>{profile?.company_name || 'Företag'}</div>
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
                  
                  <p className="text-white text-sm text-center max-w-md">
                    Detta är hur ansökningsformuläret ser ut på mobilen. Jobbsökare har redan sina uppgifter ifyllda.
                  </p>
                </div>

                {/* Image upload section */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/20">
                  <div className="text-white font-medium mb-3">Jobbild (valfritt)</div>
                  <p className="text-white text-sm mb-4">
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
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
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
                        <p className="text-xs text-white text-center">
                          Klicka för att zooma, panorera och justera bilden
                        </p>
                      </div>
                    </>
                  )}
                </div>

              </div>
            )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-4 border-t border-white/20 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={loading || !validateCurrentStep()}
                className="bg-green-600/80 hover:bg-green-600 text-white px-6"
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
                className="bg-primary hover:bg-primary/90 text-white px-6"
              >
                Nästa
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
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
      </DialogContent>
    </Dialog>
  );
};

export default MobileJobWizard;
import { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { categorizeJob } from '@/lib/jobCategorization';
import { EMPLOYMENT_TYPES, getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { filterCities, swedishCities } from '@/lib/swedishCities';
import { searchOccupations } from '@/lib/occupations';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, X, ChevronDown, MapPin, Building, Briefcase, Heart, Bookmark, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getCachedPostalCodeInfo, formatPostalCodeInput, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import ImageEditor from '@/components/ImageEditor';
import { createSignedUrl } from '@/utils/storageUtils';

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
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [customQuestions, setCustomQuestions] = useState<JobQuestion[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<JobQuestion | null>(null);

  // Utility function to truncate text for better display
  const truncateText = (text: string, maxLength: number = 35) => {
    if (!text) return text;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  // AI-optimized title state
  const [optimizedTitle, setOptimizedTitle] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState(false);

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
    const c = formatCity(city || '');
    return [emp, c].filter(Boolean).join(' • ');
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
  const [showJobPreview, setShowJobPreview] = useState(false);
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

  // AI-powered title optimization
  const optimizeTitle = async (title: string) => {
    if (!title || title.length <= 30 || isOptimizing) return title;
    
    setIsOptimizing(true);
    try {
      const response = await fetch('/api/functions/v1/optimize-job-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: title,
          maxLength: 35 // Optimal length for mobile display
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.optimizedTitle && data.wasOptimized) {
          return data.optimizedTitle;
        }
      }
    } catch (error) {
      console.error('Title optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
    return title;
  };

  // Auto-optimize title when it changes
  useEffect(() => {
    const autoOptimize = async () => {
      if (formData.title && formData.title.length > 30) {
        const optimized = await optimizeTitle(formData.title);
        if (optimized !== formData.title) {
          setOptimizedTitle(optimized);
        } else {
          setOptimizedTitle('');
        }
      } else {
        setOptimizedTitle('');
      }
    };

    const timeoutId = setTimeout(autoOptimize, 1000); // Debounce
    return () => clearTimeout(timeoutId);
  }, [formData.title]);

  // Get display title (optimized or original)
  const getDisplayTitle = () => {
    return optimizedTitle || formData.title || 'Jobbtitel';
  };

  const { user } = useAuth();
  const { toast } = useToast();

  // Load user profile for company info
  useEffect(() => {
    if (user && open) {
      fetchProfile();
    }
  }, [user, open]);

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
    // Always use the latest jobTitle if provided
    if (jobTitle && jobTitle !== formData.title) {
      setFormData(prev => ({ ...prev, title: jobTitle }));
    }
    
    // Only reset form if it's completely empty or when a template is selected
    const isFormEmpty = !formData.title && !formData.location && !formData.occupation;
    const shouldUpdateFromTemplate = selectedTemplate && 
      (formData.title !== selectedTemplate.title || formData.description !== selectedTemplate.description);
    
    if (isFormEmpty || shouldUpdateFromTemplate) {
      const newLocation = selectedTemplate?.location || '';
      setFormData(prev => ({
        title: jobTitle || selectedTemplate?.title || prev.title,
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuestionTypeDropdown, showOccupationDropdown, showEmploymentTypeDropdown, showSalaryTypeDropdown]);
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
    { value: 'fast', label: 'Fast månads-, vecko- eller timlön' },
    { value: 'rorlig', label: 'Rörlig, ackord eller provisionslön' },
    { value: 'fast-rorlig', label: 'Fast och rörlig lön' }
  ];

  const handleQuestionTypeSearch = (value: string) => {
    setQuestionTypeSearchTerm(value);
    setShowQuestionTypeDropdown(value.length >= 0);
  };

  const handleQuestionTypeSelect = (type: { value: string, label: string }) => {
    updateQuestionField('question_type', type.value);
    setQuestionTypeSearchTerm(type.label);
    setShowQuestionTypeDropdown(false);
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

  const handleSalaryTypeSearch = (value: string) => {
    setSalaryTypeSearchTerm(value);
    setShowSalaryTypeDropdown(value.length >= 0);
  };

  const handleSalaryTypeSelect = (type: { value: string, label: string }) => {
    handleInputChange('salary_type', type.value);
    setSalaryTypeSearchTerm(type.label);
    setShowSalaryTypeDropdown(false);
  };

  const filteredQuestionTypes = questionTypes.filter(type => 
    type.label.toLowerCase().includes(questionTypeSearchTerm.toLowerCase())
  );

  const filteredEmploymentTypes = EMPLOYMENT_TYPES.filter(type => 
    type.label.toLowerCase().includes(employmentTypeSearchTerm.toLowerCase())
  );

  const filteredSalaryTypes = salaryTypes.filter(type => 
    type.label.toLowerCase().includes(salaryTypeSearchTerm.toLowerCase())
  );

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

  const handleClose = () => {
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
      workplace_name: profile?.company_name || '',
      workplace_address: '',
      workplace_postal_code: '',
      workplace_city: '',
      work_schedule: '',
      contact_email: user?.email || '',
      application_instructions: '',
      pitch: '',
      job_image_url: ''
    });
    setOriginalImageUrl(null);
    onOpenChange(false);
    onJobCreated();
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] bg-parium-gradient border-white/20 text-white [&>button]:hidden p-0 flex flex-col">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/20 flex-shrink-0">
            <DialogHeader className="flex-1">
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
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Step 1: Grundinfo */}
            {currentStep === 0 && (
              <div className="space-y-4">
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
                  <Label className="text-white font-medium">Yrke *</Label>
                  <div className="relative occupation-dropdown">
                    <Input
                      value={formData.occupation}
                      onChange={(e) => handleOccupationSearch(e.target.value)}
                      onFocus={() => setShowOccupationDropdown(occupationSearchTerm.length > 0)}
                      placeholder="t.ex. Mjukvaru- och systemutvecklare"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10"
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base resize-none leading-relaxed"
                  />
                </div>


                <div className="space-y-2">
                  <Label className="text-white font-medium">Anställningsform *</Label>
                  <div className="relative employment-type-dropdown">
                    <Input
                      value={employmentTypeSearchTerm || (formData.employment_type ? EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label || '' : '')}
                      onChange={(e) => handleEmploymentTypeSearch(e.target.value)}
                      onClick={() => setShowEmploymentTypeDropdown(!showEmploymentTypeDropdown)}
                      placeholder="Välj anställningsform"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer"
                      readOnly
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                    
                    {/* Employment Type Dropdown */}
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
                      onClick={() => setShowSalaryTypeDropdown(!showSalaryTypeDropdown)}
                      placeholder="Välj lönetyp"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer"
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Var finns jobbet? */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Var utförs arbetet? *</Label>
                  <Select value={formData.work_location_type} onValueChange={(value) => handleInputChange('work_location_type', value)}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-12 text-base">
                      <SelectValue placeholder="Välj arbetsplats" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="på-plats" className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10">
                        På plats
                      </SelectItem>
                      <SelectItem value="hemarbete" className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10">
                        Hemarbete
                      </SelectItem>
                      <SelectItem value="hybridarbete" className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10">
                        Hybridarbete
                      </SelectItem>
                      <SelectItem value="fältarbete" className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10">
                        Fältarbete/ute
                      </SelectItem>
                      <SelectItem value="utomlands" className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10">
                        Utomlands
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Är distansarbete möjligt? *</Label>
                  <Select value={formData.remote_work_possible} onValueChange={(value) => handleInputChange('remote_work_possible', value)}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-12 text-base">
                      <SelectValue placeholder="Välj alternativ" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="nej" className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10">
                        Nej
                      </SelectItem>
                      <SelectItem value="delvis" className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10">
                        Delvis
                      </SelectItem>
                      <SelectItem value="ja" className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10">
                        Ja, helt
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Arbetsplatsens namn *</Label>
                  <Input
                    value={formData.workplace_name}
                    onChange={(e) => handleInputChange('workplace_name', e.target.value)}
                    placeholder={profile?.company_name ? `t.ex. ${profile.company_name}` : "t.ex. IKEA Kungens Kurva"}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Kontakt e-mail *</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder={user?.email || "kontakt@företag.se"}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Gatuadress (frivilligt)</Label>
                  <Input
                    value={formData.workplace_address}
                    onChange={(e) => handleInputChange('workplace_address', e.target.value)}
                    placeholder="t.ex. Modulvägen 1"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
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
                {!showQuestionForm ? (
                  <>
                    <div className="text-center space-y-2">
                      <h3 className="text-white font-medium text-lg">Ansökningsfrågor</h3>
                      <p className="text-white text-sm">
                        Skapa frågor som jobbsökarna ska besvara i sin ansökan
                      </p>
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
                            onClick={() => setShowQuestionTypeDropdown(!showQuestionTypeDropdown)}
                            placeholder="Välj frågetyp"
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10 cursor-pointer"
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
              <div className="space-y-6">
                {/* Mobile Mockup Preview - JobAdCard Style */}
                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-white font-medium">Så kommer din annons att se ut:</h3>
                  
                  {/* Phone mockup with JobAdCard design */}
                  <section aria-label="Jobbannonskort förhandsvisning" className="relative w-[140px] h-[280px] mx-auto">
                    {/* Telefonram */}
                    <div className="relative w-full h-full rounded-[1.2rem] bg-slate-950 p-0.5 shadow-2xl ring-1 ring-black/30">
                      {/* Skärm */}
                      <div className="relative w-full h-full rounded-[0.9rem] overflow-hidden bg-black">
                        {/* Notch - helt svart utan vita kanter */}
                        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 z-20 h-0.5 w-6 rounded-full bg-black"></div>

                        {/* Bakgrundsbild - heltäckande */}
                        {jobImageDisplayUrl ? (
                          <div 
                            className="absolute inset-0 w-full h-full bg-center bg-cover bg-no-repeat"
                            style={{
                              backgroundImage: `url(${jobImageDisplayUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: bgPosition
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
                        )}

                        {/* Nedre gradient för läsbarhet */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

                        {/* Textinnehåll - närmare toppen */}
                        <div className="absolute inset-0 flex flex-col justify-start items-center pt-6 px-2 text-white text-center">
                          <h3 className={`font-extrabold drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)] ${getSmartTextStyle(getDisplayTitle()).fontSize} ${getSmartTextStyle(getDisplayTitle()).lineHeight} mb-2`}>
                            {getDisplayTitle()}
                          </h3>
                          
                          {/* Företagsnamn */}
                          <div className="text-white/95 text-sm font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] mb-1">
                            {profile?.company_name || 'Företagsnamn'}
                          </div>
                          
                          {/* Anställningstyp och plats */}
                          <div className="text-white/90 text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                            {getMetaLine(formData.employment_type, formData.workplace_city) || 'Anställning • Plats'}
                          </div>
                        </div>

                        {/* Handlingsknappar */}
                        <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-2">
                          <button
                            aria-label="Nej tack"
                            className="w-7 h-7 rounded-full bg-red-500 shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                          <button
                            aria-label="Spara jobb"
                            className="w-7 h-7 rounded-full bg-blue-500 shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                          >
                            <Bookmark className="h-3.5 w-3.5 text-white" />
                          </button>
                          <button
                            aria-label="Gilla jobbet"
                            className="w-7 h-7 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors"
                          >
                            <Heart className="h-3.5 w-3.5 text-white fill-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                  
                  <p className="text-white text-sm text-center max-w-sm">
                    Detta är hur din annons kommer att visas för jobbsökare. Klicka på knapparna för att testa interaktionen
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

        {/* Job Preview Dialog */}
        <Dialog open={showJobPreview} onOpenChange={setShowJobPreview}>
          <DialogContent className="max-w-md bg-white text-gray-900">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {truncateText(formData.title, 50) || 'Jobbtitel'}
              </DialogTitle>
              <p className="text-gray-600">{profile?.company_name || 'Företagsnamn'}</p>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Job image if available */}
              {jobImageDisplayUrl && (
                <div className="w-full h-48 rounded-lg overflow-hidden">
                  <img 
                    src={jobImageDisplayUrl} 
                    alt="Job image" 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              {/* Location and employment type */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center text-gray-600 text-sm">
                  <MapPin className="w-4 h-4 mr-1" />
                  {formData.workplace_city || formData.location || 'Plats'}
                </div>
                {formData.employment_type && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label}
                  </span>
                )}
              </div>

              {/* Occupation */}
              {formData.occupation && (
                <div className="flex items-center text-gray-600 text-sm">
                  <Briefcase className="w-4 h-4 mr-1" />
                  {formData.occupation}
                </div>
              )}

              {/* Salary */}
              {(formData.salary_min || formData.salary_max) && (
                <div className="flex items-center text-green-600 text-sm font-medium">
                  💰 {formData.salary_min && formData.salary_max 
                    ? `${parseInt(formData.salary_min).toLocaleString()} - ${parseInt(formData.salary_max).toLocaleString()} kr/mån`
                    : formData.salary_min 
                      ? `Från ${parseInt(formData.salary_min).toLocaleString()} kr/mån`
                      : `Upp till ${parseInt(formData.salary_max).toLocaleString()} kr/mån`
                  }
                </div>
              )}

              {/* Full description */}
              <div className="space-y-2">
                <h4 className="font-semibold">Beskrivning</h4>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {formData.description || 'Ingen beskrivning ännu...'}
                </p>
              </div>

              {/* Contact email if available */}
              {formData.contact_email && (
                <div className="pt-4 border-t">
                  <button 
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium py-3 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
                    onClick={() => {
                      window.open(`mailto:${formData.contact_email}?subject=Ansökan: ${formData.title}`, '_blank');
                    }}
                  >
                    Ansök nu
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

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
      </DialogContent>
    </Dialog>
  );
};

export default MobileJobWizard;
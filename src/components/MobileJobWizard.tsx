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
import { EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { filterCities, swedishCities } from '@/lib/swedishCities';
import { searchOccupations } from '@/lib/occupations';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, X, ChevronDown, MapPin, Building, Briefcase, Heart, Bookmark } from 'lucide-react';
import { getCachedPostalCodeInfo, formatPostalCodeInput, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';
import { Progress } from '@/components/ui/progress';
import { createSignedUrl } from '@/utils/storageUtils';

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
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [occupationSearchTerm, setOccupationSearchTerm] = useState('');
  const [showOccupationDropdown, setShowOccupationDropdown] = useState(false);
  const [showJobPreview, setShowJobPreview] = useState(false);
  const [jobImageDisplayUrl, setJobImageDisplayUrl] = useState<string | null>(null);
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
      return formData.title.trim() && formData.occupation.trim() && formData.description.trim() && formData.employment_type;
    }
    
    if (currentStep === 1) {
      return formData.work_location_type && 
             formData.remote_work_possible && 
             formData.workplace_name.trim() && 
             formData.workplace_postal_code.trim() && 
             formData.workplace_city.trim();
    }
    
    if (currentStep === 2) {
      return formData.contact_email.trim();
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
                  <div className="relative">
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
                  <div className="text-xs text-white/50">
                    Tips: Beskriv huvuduppgifter, vad ni söker och vad ni erbjuder
                  </div>
                </div>


                <div className="space-y-2">
                  <Label className="text-white font-medium">Anställningsform *</Label>
                  <Select value={formData.employment_type} onValueChange={(value) => handleInputChange('employment_type', value)}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-12 text-base">
                      <SelectValue placeholder="Välj anställningsform" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600" side="bottom" align="start">
                      {EMPLOYMENT_TYPES.map(type => (
                        <SelectItem 
                          key={type.value} 
                          value={type.value}
                          className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10"
                        >
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Lönetyp</Label>
                  <Select value={formData.salary_type} onValueChange={(value) => handleInputChange('salary_type', value)}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-12 text-base">
                      <SelectValue placeholder="Välj lönetyp" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600" side="bottom" align="start">
                      <SelectItem 
                        value="fast"
                        className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10"
                      >
                        Fast månads-, vecko- eller timlön
                      </SelectItem>
                      <SelectItem 
                        value="rorlig"
                        className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10"
                      >
                        Rörlig, ackord eller provisionslön
                      </SelectItem>
                      <SelectItem 
                        value="fast-rorlig"
                        className="text-white hover:bg-gray-700 focus:bg-gray-700 h-10"
                      >
                        Fast och rörlig lön
                      </SelectItem>
                    </SelectContent>
                  </Select>
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

            {/* Step 3: Förhandsvisning */}
            {currentStep === 2 && (
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
                        {/* Notch/status */}
                        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 z-20 h-0.5 w-6 rounded-full bg-black/60 border border-white/10"></div>

                        {/* Bakgrundsbild - heltäckande */}
                        {jobImageDisplayUrl ? (
                          <div 
                            className="absolute inset-0 w-full h-full bg-center bg-cover bg-no-repeat"
                            style={{
                              backgroundImage: `url(${jobImageDisplayUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center center'
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
                        )}

                        {/* Nedre gradient för läsbarhet */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

                        {/* Textinnehåll - centrerat */}
                        <div className="absolute inset-0 flex flex-col justify-center items-center p-2 text-white text-center">
                          <h3 className="text-base font-extrabold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                            {formData.title || 'Jobbtitel'}
                          </h3>
                          <div className="mt-1 text-white/95 text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                            {profile?.company_name || 'Företagsnamn'}
                          </div>
                          <div className="text-white/80 text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                            {formData.workplace_city || 'Plats'}
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
                  
                  <p className="text-white/70 text-sm text-center max-w-sm">
                    Detta är hur din annons kommer att visas för jobbsökare. Klicka på knapparna för att testa interaktionen.
                  </p>
                </div>

                {/* Image upload section */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/20">
                  <div className="text-white font-medium mb-3">Jobbild (valfritt)</div>
                  <p className="text-white/70 text-sm mb-4">
                    Ladda upp en bild som representerar jobbet eller arbetsplatsen
                  </p>
                  
                  <FileUpload
                    onFileUploaded={(url, fileName) => {
                      handleInputChange('job_image_url', url);
                    }}
                    acceptedFileTypes={['image/*']}
                    maxFileSize={5 * 1024 * 1024}
                  />
                  
                  {jobImageDisplayUrl && (
                    <div className="mt-3 relative">
                      <img 
                        src={jobImageDisplayUrl} 
                        alt="Job preview" 
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleInputChange('job_image_url', '')}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Step 4: Kontakt */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Kontakt-email *</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder="kontakt@företag.se"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Krav och kvalifikationer (valfritt)</Label>
                  <Textarea
                    value={formData.requirements}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                    placeholder="Beskriv vilka krav som ställs..."
                    rows={4}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Ansökningsinstruktioner (valfritt)</Label>
                  <Textarea
                    value={formData.application_instructions}
                    onChange={(e) => handleInputChange('application_instructions', e.target.value)}
                    placeholder="Hur ska kandidater ansöka? Via e-post, telefon eller webbsida?"
                    rows={4}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base resize-none"
                  />
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
                className="bg-white/20 hover:bg-white/30 text-white border border-white/20 px-6"
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
                {formData.title || 'Jobbtitel'}
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
                    className="w-full h-full object-cover"
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
      </DialogContent>
    </Dialog>
  );
};

export default MobileJobWizard;
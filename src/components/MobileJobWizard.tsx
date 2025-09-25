import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { categorizeJob } from '@/lib/jobCategorization';
import { EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { filterCities, swedishCities } from '@/lib/swedishCities';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, X, ChevronDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

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
  salary_min: string;
  salary_max: string;
  employment_type: string;
  work_schedule: string;
  contact_email: string;
  application_instructions: string;
  pitch: string;
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
  const [formData, setFormData] = useState<JobFormData>({
    title: jobTitle,
    description: selectedTemplate?.description || '',
    requirements: selectedTemplate?.requirements || '',
    location: selectedTemplate?.location || '',
    salary_min: selectedTemplate?.salary_min?.toString() || '',
    salary_max: selectedTemplate?.salary_max?.toString() || '',
    employment_type: selectedTemplate?.employment_type || '',
    work_schedule: selectedTemplate?.work_schedule || '',
    contact_email: selectedTemplate?.contact_email || '',
    application_instructions: selectedTemplate?.application_instructions || '',
    pitch: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Load user profile for company info
  useEffect(() => {
    if (user && open) {
      fetchProfile();
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
    
    // Auto-fill contact email if not already set and use user email as fallback
    if (!formData.contact_email && user.email) {
      setFormData(prev => ({
        ...prev,
        contact_email: user.email
      }));
    }
  };

  // Update form data when props change
  useEffect(() => {
    const newLocation = selectedTemplate?.location || '';
    setFormData({
      title: jobTitle,
      description: selectedTemplate?.description || '',
      requirements: selectedTemplate?.requirements || '',
      location: newLocation,
      salary_min: selectedTemplate?.salary_min?.toString() || '',
      salary_max: selectedTemplate?.salary_max?.toString() || '',
      employment_type: selectedTemplate?.employment_type || '',
      work_schedule: selectedTemplate?.work_schedule || '',
      contact_email: selectedTemplate?.contact_email || '',
      application_instructions: selectedTemplate?.application_instructions || '',
      pitch: ''
    });
    
    // Update city search term when template location changes
    setCitySearchTerm(newLocation);
  }, [jobTitle, selectedTemplate]);

  const steps = [
    {
      title: "Grundinfo",
      fields: ['title', 'location', 'employment_type']
    },
    {
      title: "Beskrivning", 
      fields: ['description', 'pitch']
    },
    {
      title: "Detaljer",
      fields: ['salary_min', 'salary_max', 'work_schedule']
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

  const filteredCities = citySearchTerm.length > 0 ? filterCities(citySearchTerm) : [];

  const validateCurrentStep = () => {
    const currentStepFields = steps[currentStep].fields;
    
    // Required fields validation
    if (currentStep === 0) {
      return formData.title.trim() && formData.location.trim() && formData.employment_type;
    }
    
    if (currentStep === 1) {
      return formData.description.trim();
    }
    
    if (currentStep === 3) {
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
      const category = categorizeJob(formData.title, formData.description);
      
      const jobData = {
        employer_id: user.id,
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || null,
        location: formData.location,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        employment_type: formData.employment_type || null,
        work_schedule: formData.work_schedule || null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
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
      salary_min: '',
      salary_max: '',
      employment_type: '',
      work_schedule: '',
      contact_email: '',
      application_instructions: '',
      pitch: ''
    });
    onOpenChange(false);
    onJobCreated();
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-parium-gradient border-white/20 text-white [&>button]:hidden p-0">
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/20">
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
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="px-4 py-2">
            <Progress 
              value={progress} 
              className="h-1 bg-white/20"
            />
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 min-h-[350px]">
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
                  <Label className="text-white font-medium">Plats *</Label>
                  <div className="relative">
                    <Input
                      value={formData.location}
                      onChange={(e) => handleCitySearch(e.target.value)}
                      onFocus={() => setShowCityDropdown(citySearchTerm.length > 0)}
                      placeholder="t.ex. Stockholm"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pr-10"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                    
                    {/* City Dropdown */}
                    {showCityDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                        {/* Show filtered cities */}
                        {filteredCities.map((city, index) => (
                          <button
                            key={`${city.name}-${index}`}
                            type="button"
                            onClick={() => handleCitySelect(city.name)}
                            className="w-full px-3 py-3 text-left hover:bg-gray-700 text-white text-base border-b border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium">{city.name}</div>
                            <div className="text-sm text-gray-400">
                              {city.postalCodes.slice(0, 3).join(', ')}
                              {city.postalCodes.length > 3 && ` +${city.postalCodes.length - 3} mer`}
                            </div>
                          </button>
                        ))}
                        
                        {/* Custom value option if no matches and search term exists */}
                        {citySearchTerm.trim().length >= 2 &&
                         filteredCities.length === 0 && (
                          <button
                            type="button"
                            onClick={() => handleCitySelect(citySearchTerm)}
                            className="w-full px-3 py-3 text-left hover:bg-gray-700 text-white text-base border-t border-gray-700/30"
                          >
                            <span className="font-medium">Använd "{citySearchTerm}"</span>
                            <div className="text-sm text-gray-400">Egen plats</div>
                          </button>
                        )}
                        
                        {/* Show message if search is too short */}
                        {citySearchTerm.trim().length > 0 && citySearchTerm.trim().length < 2 && (
                          <div className="py-4 px-3 text-center text-gray-400 italic text-sm">
                            Skriv minst 2 bokstäver för att söka
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Anställningsform *</Label>
                  <Select value={formData.employment_type} onValueChange={(value) => handleInputChange('employment_type', value)}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-12 text-base">
                      <SelectValue placeholder="Välj anställningsform" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
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
              </div>
            )}

            {/* Step 2: Beskrivning */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white font-medium">Jobbeskrivning *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..."
                    rows={6}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Kort pitch (valfritt)</Label>
                  <div className="text-sm text-white/60 mb-2">
                    En kort sammanfattning som lockar kandidater (max 200 tecken)
                  </div>
                  <Textarea
                    value={formData.pitch}
                    onChange={(e) => handleInputChange('pitch', e.target.value)}
                    placeholder="Vad gör detta jobb speciellt?"
                    maxLength={200}
                    rows={3}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base resize-none"
                  />
                  <div className="text-xs text-white/50 text-right">
                    {formData.pitch.length}/200
                  </div>
                </div>

                {/* Company Info Preview */}
                {profile && (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/20">
                    <div className="text-sm text-white/70 mb-2">Om oss (från din företagsprofil):</div>
                    <div className="text-sm text-white/90">
                      {profile.company_description || "Ingen företagsbeskrivning tillgänglig ännu."}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Detaljer */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-4">
                  <Label className="text-white font-medium">Lönespann (valfritt)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        type="number"
                        value={formData.salary_min}
                        onChange={(e) => handleInputChange('salary_min', e.target.value)}
                        placeholder="Från kr/mån"
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={formData.salary_max}
                        onChange={(e) => handleInputChange('salary_max', e.target.value)}
                        placeholder="Till kr/mån"
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Arbetstider (valfritt)</Label>
                  <Input
                    value={formData.work_schedule}
                    onChange={(e) => handleInputChange('work_schedule', e.target.value)}
                    placeholder="t.ex. 08:00-17:00, Skiftarbete"
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
                  <Label className="text-white font-medium">Ansökningsinstruktioner (valfritt)</Label>
                  <Textarea
                    value={formData.application_instructions}
                    onChange={(e) => handleInputChange('application_instructions', e.target.value)}
                    placeholder="Hur ska kandidater ansöka? Via e-post, telefon eller webbsida?"
                    rows={4}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-base resize-none"
                  />
                </div>

                {/* Summary Preview */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/20">
                  <div className="text-sm text-white/70 mb-3">Förhandsvisning:</div>
                  <div className="space-y-2">
                    <div className="font-medium text-white">{formData.title}</div>
                    <div className="text-sm text-white/80">{formData.location} • {EMPLOYMENT_TYPES.find(t => t.value === formData.employment_type)?.label}</div>
                    {(formData.salary_min || formData.salary_max) && (
                      <div className="text-sm text-white/80">
                        {formData.salary_min && formData.salary_max 
                          ? `${parseInt(formData.salary_min).toLocaleString()} - ${parseInt(formData.salary_max).toLocaleString()} kr/mån`
                          : formData.salary_min 
                            ? `Från ${parseInt(formData.salary_min).toLocaleString()} kr/mån`
                            : `Upp till ${parseInt(formData.salary_max).toLocaleString()} kr/mån`
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-4 border-t border-white/20">
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
      </DialogContent>
    </Dialog>
  );
};

export default MobileJobWizard;
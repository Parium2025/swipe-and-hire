import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { categorizeJob } from '@/lib/jobCategorization';
import { EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { searchOccupations } from '@/lib/occupations';
import { Loader2, X, ChevronDown } from 'lucide-react';
import JobQuestionsManager from '@/components/JobQuestionsManager';
import { AnimatedBackground } from '@/components/AnimatedBackground';

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
  positions_count?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  workplace_name?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_city?: string;
  contact_email?: string;
  application_instructions?: string;
  pitch?: string;
  category?: string;
  is_default: boolean;
  questions?: any[];
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
}

interface CreateJobDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  selectedTemplate: JobTemplate | null;
  onJobCreated: () => void;
}

const CreateJobDetailDialog = ({ 
  open, 
  onOpenChange, 
  jobTitle, 
  selectedTemplate, 
  onJobCreated 
}: CreateJobDetailDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [occupationSearchTerm, setOccupationSearchTerm] = useState('');
  const [showOccupationDropdown, setShowOccupationDropdown] = useState(false);
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
    work_location_type: '',
    remote_work_possible: '',
    workplace_name: '',
    workplace_address: '',
    workplace_postal_code: '',
    workplace_city: '',
    work_schedule: selectedTemplate?.work_schedule || '',
    contact_email: selectedTemplate?.contact_email || '',
    application_instructions: selectedTemplate?.application_instructions || '',
    pitch: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Update form data when props change - Copy ALL fields from template
  useEffect(() => {
    setFormData({
      title: jobTitle,
      description: selectedTemplate?.description || '',
      requirements: selectedTemplate?.requirements || '',
      location: selectedTemplate?.location || '',
      occupation: selectedTemplate?.occupation || '',
      salary_min: selectedTemplate?.salary_min?.toString() || '',
      salary_max: selectedTemplate?.salary_max?.toString() || '',
      employment_type: selectedTemplate?.employment_type || '',
      salary_type: selectedTemplate?.salary_type || '',
      positions_count: selectedTemplate?.positions_count?.toString() || '1',
      work_location_type: selectedTemplate?.work_location_type || '',
      remote_work_possible: selectedTemplate?.remote_work_possible || '',
      workplace_name: selectedTemplate?.workplace_name || '',
      workplace_address: selectedTemplate?.workplace_address || '',
      workplace_postal_code: selectedTemplate?.workplace_postal_code || '',
      workplace_city: selectedTemplate?.workplace_city || '',
      work_schedule: selectedTemplate?.work_schedule || '',
      contact_email: selectedTemplate?.contact_email || '',
      application_instructions: selectedTemplate?.application_instructions || '',
      pitch: selectedTemplate?.pitch || ''
    });
  }, [jobTitle, selectedTemplate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      // Automatically categorize the job based on title and description
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
        category // Add the auto-generated category
      };

      const { data, error } = await supabase
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

      // Save the created job ID and move to questions tab
      setCreatedJobId(data.id);
      setActiveTab("questions");

      toast({
        title: "Grundinfo sparad!",
        description: "Nu kan du lägga till ansökningsfrågor eller avsluta."
      });

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
    // Reset everything when closing
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
      work_location_type: '',
      remote_work_possible: '',
      workplace_name: '',
      workplace_address: '',
      workplace_postal_code: '',
      workplace_city: '',
      work_schedule: '',
      contact_email: '',
      application_instructions: '',
      pitch: ''
    });
    setCreatedJobId(null);
    setActiveTab("basic");
    onOpenChange(false);
    onJobCreated();
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

  const filteredOccupations = occupationSearchTerm.length > 0 ? searchOccupations(occupationSearchTerm) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-parium-gradient border-white/20 text-white [&>button]:hidden">
        <AnimatedBackground showBubbles={false} />
        <div className="relative z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute right-0 top-0 h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 z-10"
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogHeader>
            <DialogTitle className="text-white pr-10">Skapa jobbannons: {jobTitle}</DialogTitle>
            <DialogDescription className="text-white/70">
              {selectedTemplate ? `Baserad på mallen "${selectedTemplate.name}"` : 'Tom annons utan mall'}
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 border-white/20">
            <TabsTrigger 
              value="basic" 
              className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white"
            >
              Grundinformation
            </TabsTrigger>
            <TabsTrigger 
              value="questions" 
              disabled={!createdJobId}
              className="text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white disabled:text-white/40"
            >
              Ansökningsfrågor
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4 mt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-white">Jobbtitel *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="t.ex. Lagerarbetare, Lastbilschaufför"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupation" className="text-white">Yrke *</Label>
                <div className="relative">
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => handleOccupationSearch(e.target.value)}
                    onFocus={() => setShowOccupationDropdown(occupationSearchTerm.length > 0)}
                    placeholder="t.ex. Mjukvaru- och systemutvecklare"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 pr-10"
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
                          <div className="text-sm text-gray-400">Eget yrke</div>
                        </button>
                      )}
                      
                      {/* Show message if search is too short */}
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
                <Label htmlFor="location" className="text-white">Plats *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="t.ex. Stockholm, Göteborg"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary_min" className="text-white">Minimilön (kr/mån)</Label>
                  <Input
                    id="salary_min"
                    type="number"
                    value={formData.salary_min}
                    onChange={(e) => handleInputChange('salary_min', e.target.value)}
                    placeholder="25000"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary_max" className="text-white">Maxlön (kr/mån)</Label>
                  <Input
                    id="salary_max"
                    type="number"
                    value={formData.salary_max}
                    onChange={(e) => handleInputChange('salary_max', e.target.value)}
                    placeholder="35000"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary_type" className="text-white">Lönetyp</Label>
                <Select value={formData.salary_type} onValueChange={(value) => handleInputChange('salary_type', value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Välj lönetyp" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="fast" className="text-white hover:bg-gray-700 focus:bg-gray-700">
                      Fast månads- vecko- eller timlön
                    </SelectItem>
                    <SelectItem value="rorlig" className="text-white hover:bg-gray-700 focus:bg-gray-700">
                      Rörlig ackord- eller provisionslön
                    </SelectItem>
                    <SelectItem value="fast-rorlig" className="text-white hover:bg-gray-700 focus:bg-gray-700">
                      Fast och rörlig lön
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employment_type" className="text-white">Anställningsform</Label>
                <Select value={formData.employment_type} onValueChange={(value) => handleInputChange('employment_type', value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Välj anställningsform" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {EMPLOYMENT_TYPES.map(type => (
                      <SelectItem 
                        key={type.value} 
                        value={type.value}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700"
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="positions_count" className="text-white">Antal personer att rekrytera</Label>
                <Input
                  id="positions_count"
                  type="number"
                  min="1"
                  value={formData.positions_count}
                  onChange={(e) => handleInputChange('positions_count', e.target.value)}
                  placeholder="1"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_location_type" className="text-white">Typ av arbetsplats</Label>
                <Select value={formData.work_location_type} onValueChange={(value) => handleInputChange('work_location_type', value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Välj typ av arbetsplats" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="på-plats" className="text-white hover:bg-gray-700 focus:bg-gray-700">På plats</SelectItem>
                    <SelectItem value="hemarbete" className="text-white hover:bg-gray-700 focus:bg-gray-700">Hemarbete</SelectItem>
                    <SelectItem value="hybridarbete" className="text-white hover:bg-gray-700 focus:bg-gray-700">Hybridarbete</SelectItem>
                    <SelectItem value="fältarbete" className="text-white hover:bg-gray-700 focus:bg-gray-700">Fältarbete/ute</SelectItem>
                    <SelectItem value="utomlands" className="text-white hover:bg-gray-700 focus:bg-gray-700">Utomlands</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remote_work_possible" className="text-white">Distansarbete möjligt?</Label>
                <Select value={formData.remote_work_possible} onValueChange={(value) => handleInputChange('remote_work_possible', value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Välj distansarbetsalternativ" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="nej" className="text-white hover:bg-gray-700 focus:bg-gray-700">Nej</SelectItem>
                    <SelectItem value="delvis" className="text-white hover:bg-gray-700 focus:bg-gray-700">Delvis</SelectItem>
                    <SelectItem value="ja" className="text-white hover:bg-gray-700 focus:bg-gray-700">Ja, helt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workplace_name" className="text-white">Arbetsplatsnamn *</Label>
                <Input
                  id="workplace_name"
                  value={formData.workplace_name}
                  onChange={(e) => handleInputChange('workplace_name', e.target.value)}
                  placeholder="t.ex. Huvudkontoret Stockholm"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workplace_address" className="text-white">Arbetsplatsadress</Label>
                <Input
                  id="workplace_address"
                  value={formData.workplace_address}
                  onChange={(e) => handleInputChange('workplace_address', e.target.value)}
                  placeholder="t.ex. Storgatan 1"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workplace_postal_code" className="text-white">Postnummer</Label>
                  <Input
                    id="workplace_postal_code"
                    value={formData.workplace_postal_code}
                    onChange={(e) => handleInputChange('workplace_postal_code', e.target.value)}
                    placeholder="123 45"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workplace_city" className="text-white">Stad</Label>
                  <Input
                    id="workplace_city"
                    value={formData.workplace_city}
                    onChange={(e) => handleInputChange('workplace_city', e.target.value)}
                    placeholder="Stockholm"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_schedule" className="text-white">Arbetstider</Label>
                <Input
                  id="work_schedule"
                  value={formData.work_schedule}
                  onChange={(e) => handleInputChange('work_schedule', e.target.value)}
                  placeholder="t.ex. 08:00-17:00, Skiftarbete"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email" className="text-white">Kontakt-email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => handleInputChange('contact_email', e.target.value)}
                  placeholder="kontakt@företag.se"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pitch" className="text-white">Pitch (säljtext)</Label>
                <Textarea
                  id="pitch"
                  value={formData.pitch}
                  onChange={(e) => handleInputChange('pitch', e.target.value)}
                  placeholder="En kort, säljande text om varför någon ska söka jobbet..."
                  rows={3}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">Beskrivning *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..."
                  rows={4}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirements" className="text-white">Krav och kvalifikationer</Label>
                <Textarea
                  id="requirements"
                  value={formData.requirements}
                  onChange={(e) => handleInputChange('requirements', e.target.value)}
                  placeholder="Beskriv vilka krav och kvalifikationer som krävs för tjänsten..."
                  rows={3}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="application_instructions" className="text-white">Ansökningsinstruktioner</Label>
                <Textarea
                  id="application_instructions"
                  value={formData.application_instructions}
                  onChange={(e) => handleInputChange('application_instructions', e.target.value)}
                  placeholder="Hur ska kandidater ansöka? Via e-post, telefon eller webbsida?"
                  rows={3}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white border border-white/20"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Skapar...' : 'Spara och fortsätt'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4 mt-6">
            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4">
              <JobQuestionsManager 
                jobId={createdJobId} 
                onQuestionsChange={() => {}} 
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleClose}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white border border-white/20"
              >
                Avsluta och publicera
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setActiveTab("basic")}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Tillbaka
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CreateJobDetailDialog;
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
import { EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { searchOccupations } from '@/lib/occupations';
import { categorizeJob } from '@/lib/jobCategorization';
import { Loader2 } from 'lucide-react';
import JobQuestionsManager from '@/components/JobQuestionsManager';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';

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
  category?: string;
  salary_type?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  workplace_name?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_city?: string;
  pitch?: string;
}

interface JobFormData {
  title: string;
  description: string;
  requirements: string;
  location: string;
  occupation: string;
  salary_min: string;
  salary_max: string;
  salary_type: string;
  employment_type: string;
  positions_count: string;
  work_schedule: string;
  contact_email: string;
  application_instructions: string;
  work_location_type: string;
  remote_work_possible: string;
  workplace_name: string;
  workplace_address: string;
  workplace_postal_code: string;
  workplace_city: string;
  pitch: string;
}

interface EditJobDialogProps {
  job: JobPosting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobUpdated: () => void;
}

const EditJobDialog = ({ job, open, onOpenChange, onJobUpdated }: EditJobDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [occupationSearchTerm, setOccupationSearchTerm] = useState('');
  const [showOccupationDropdown, setShowOccupationDropdown] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    description: '',
    requirements: '',
    location: '',
    occupation: '',
    salary_min: '',
    salary_max: '',
    salary_type: '',
    employment_type: '',
    positions_count: '',
    work_schedule: '',
    contact_email: '',
    application_instructions: '',
    work_location_type: '',
    remote_work_possible: '',
    workplace_name: '',
    workplace_address: '',
    workplace_postal_code: '',
    workplace_city: '',
    pitch: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Mount content slightly after dialog opens to avoid portal timing issues
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setShowContent(true), 0);
      return () => { clearTimeout(t); setShowContent(false); };
    } else {
      setShowContent(false);
    }
  }, [open]);

  // Update form data when job changes
  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || '',
        description: job.description || '',
        requirements: job.requirements || '',
        location: job.location || '',
        occupation: job.occupation || '',
        salary_min: job.salary_min?.toString() || '',
        salary_max: job.salary_max?.toString() || '',
        salary_type: job.salary_type || '',
        employment_type: job.employment_type || '',
        positions_count: job.positions_count?.toString() || '1',
        work_schedule: job.work_schedule || '',
        contact_email: job.contact_email || '',
        application_instructions: job.application_instructions || '',
        work_location_type: job.work_location_type || '',
        remote_work_possible: job.remote_work_possible || '',
        workplace_name: job.workplace_name || '',
        workplace_address: job.workplace_address || '',
        workplace_postal_code: job.workplace_postal_code || '',
        workplace_city: job.workplace_city || '',
        pitch: job.pitch || ''
      });
      setOccupationSearchTerm(job.occupation || '');
    }
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !job) return;

    setLoading(true);

    try {
      // Re-categorize job based on updated information
      const category = categorizeJob(formData.title, formData.description, formData.occupation);

      const jobData = {
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || null,
        location: formData.location,
        occupation: formData.occupation || null,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        salary_type: formData.salary_type || null,
        employment_type: formData.employment_type || null,
        positions_count: formData.positions_count ? parseInt(formData.positions_count) : 1,
        work_schedule: formData.work_schedule || null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        work_location_type: formData.work_location_type || null,
        remote_work_possible: formData.remote_work_possible || null,
        workplace_name: formData.workplace_name || null,
        workplace_address: formData.workplace_address || null,
        workplace_postal_code: formData.workplace_postal_code || null,
        workplace_city: formData.workplace_city || null,
        pitch: formData.pitch || null,
        category
      };

      const { error } = await supabase
        .from('job_postings')
        .update(jobData)
        .eq('id', job.id);

      if (error) {
        toast({
          title: "Fel vid uppdatering av annons",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Annons uppdaterad!",
        description: "Dina ändringar har sparats."
      });

      onOpenChange(false);
      onJobUpdated();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte uppdatera jobbannonsen.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

  const filteredOccupations = occupationSearchTerm.length > 0 ? searchOccupations(occupationSearchTerm) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {(!showContent || !job) ? (
          <div className="py-10 text-center">
            <DialogHeader>
              <DialogTitle>{!job ? 'Laddar annons...' : 'Öppnar redigeraren...'}</DialogTitle>
              <DialogDescription>Hämtar data – klart strax.</DialogDescription>
            </DialogHeader>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Redigera jobbannons</DialogTitle>
              <DialogDescription>
                Uppdatera informationen om tjänsten och hantera ansökningsfrågor.
              </DialogDescription>
            </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Grundinformation</TabsTrigger>
            <TabsTrigger value="questions">Ansökningsfrågor</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4 mt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Grundläggande information */}
              <div className="space-y-2">
                <Label htmlFor="edit_title">Jobbtitel *</Label>
                <Input
                  id="edit_title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_occupation">Yrke *</Label>
                <div className="relative">
                  <Input
                    id="edit_occupation"
                    value={formData.occupation}
                    onChange={(e) => handleOccupationSearch(e.target.value)}
                    onFocus={() => setShowOccupationDropdown(occupationSearchTerm.length > 0)}
                    placeholder="t.ex. Mjukvaru- och systemutvecklare"
                    required
                  />
                  
                  {showOccupationDropdown && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                      {filteredOccupations.map((occupation, index) => (
                        <button
                          key={`${occupation}-${index}`}
                          type="button"
                          onClick={() => handleOccupationSelect(occupation)}
                          className="w-full px-3 py-3 text-left hover:bg-gray-100 text-gray-900 text-base border-b border-gray-200 last:border-b-0"
                        >
                          <div className="font-medium">{occupation}</div>
                        </button>
                      ))}
                      
                      {occupationSearchTerm.trim().length >= 2 &&
                       filteredOccupations.length === 0 && (
                        <button
                          type="button"
                          onClick={() => handleOccupationSelect(occupationSearchTerm)}
                          className="w-full px-3 py-3 text-left hover:bg-gray-100 text-gray-900 text-base"
                        >
                          <span className="font-medium">Använd "{occupationSearchTerm}"</span>
                          <div className="text-sm text-gray-500">Eget yrke</div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_pitch">Pitch (valfritt kort sammanfattning)</Label>
                <Textarea
                  id="edit_pitch"
                  value={formData.pitch}
                  onChange={(e) => handleInputChange('pitch', e.target.value)}
                  rows={2}
                  placeholder="En kort sammanfattning som syns i listningar"
                />
              </div>

              {/* Arbetsplatsadress */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Arbetsplats</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="edit_workplace_name">Arbetsplatsens namn</Label>
                  <Input
                    id="edit_workplace_name"
                    value={formData.workplace_name}
                    onChange={(e) => handleInputChange('workplace_name', e.target.value)}
                    placeholder="t.ex. Huvudkontoret, Fabrik 1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_workplace_address">Gatuadress</Label>
                  <Input
                    id="edit_workplace_address"
                    value={formData.workplace_address}
                    onChange={(e) => handleInputChange('workplace_address', e.target.value)}
                    placeholder="t.ex. Storgatan 1"
                  />
                </div>

                <WorkplacePostalCodeSelector
                  postalCodeValue={formData.workplace_postal_code}
                  cityValue={formData.workplace_city}
                  onPostalCodeChange={(postalCode) => handleInputChange('workplace_postal_code', postalCode)}
                  onLocationChange={(city) => handleInputChange('workplace_city', city)}
                />

                <div className="space-y-2">
                  <Label htmlFor="edit_work_location_type">Arbetsplatstyp</Label>
                  <Select 
                    value={formData.work_location_type || ''} 
                    onValueChange={(value) => handleInputChange('work_location_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj arbetsplatstyp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ej specificerat</SelectItem>
                      <SelectItem value="on_site">På plats</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="remote">Distans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_remote_work_possible">Distansarbete möjligt?</Label>
                  <Select 
                    value={formData.remote_work_possible || ''} 
                    onValueChange={(value) => handleInputChange('remote_work_possible', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj alternativ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ej specificerat</SelectItem>
                      <SelectItem value="yes">Ja</SelectItem>
                      <SelectItem value="no">Nej</SelectItem>
                      <SelectItem value="partially">Delvis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_location">Ort/Stad *</Label>
                  <Input
                    id="edit_location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    required
                    placeholder="t.ex. Stockholm"
                  />
                </div>
              </div>

              {/* Lön och anställning */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Lön och anställning</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_salary_min">Minimilön</Label>
                    <Input
                      id="edit_salary_min"
                      type="number"
                      value={formData.salary_min}
                      onChange={(e) => handleInputChange('salary_min', e.target.value)}
                      placeholder="t.ex. 35000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_salary_max">Maxlön</Label>
                    <Input
                      id="edit_salary_max"
                      type="number"
                      value={formData.salary_max}
                      onChange={(e) => handleInputChange('salary_max', e.target.value)}
                      placeholder="t.ex. 45000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_salary_type">Lönetyp</Label>
                  <Select 
                    value={formData.salary_type || ''} 
                    onValueChange={(value) => handleInputChange('salary_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj lönetyp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ej specificerat</SelectItem>
                      <SelectItem value="monthly">Månadslön</SelectItem>
                      <SelectItem value="hourly">Timlön</SelectItem>
                      <SelectItem value="yearly">Årslön</SelectItem>
                      <SelectItem value="commission">Provision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_employment_type">Anställningsform</Label>
                  <Select value={formData.employment_type || ''} onValueChange={(value) => handleInputChange('employment_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj anställningsform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ej specificerat</SelectItem>
                      {EMPLOYMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_positions_count">Antal personer att rekrytera</Label>
                  <Input
                    id="edit_positions_count"
                    type="number"
                    min="1"
                    value={formData.positions_count}
                    onChange={(e) => handleInputChange('positions_count', e.target.value)}
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_work_schedule">Arbetstider</Label>
                  <Input
                    id="edit_work_schedule"
                    value={formData.work_schedule}
                    onChange={(e) => handleInputChange('work_schedule', e.target.value)}
                    placeholder="t.ex. Heltid, 8-17"
                  />
                </div>
              </div>

              {/* Beskrivningar */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Beskrivningar</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="edit_description">Beskrivning *</Label>
                  <Textarea
                    id="edit_description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_requirements">Krav och kvalifikationer</Label>
                  <Textarea
                    id="edit_requirements"
                    value={formData.requirements}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Kontakt och ansökan */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Kontakt och ansökan</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="edit_contact_email">Kontakt-email *</Label>
                  <Input
                    id="edit_contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_application_instructions">Ansökningsinstruktioner</Label>
                  <Textarea
                    id="edit_application_instructions"
                    value={formData.application_instructions}
                    onChange={(e) => handleInputChange('application_instructions', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Uppdaterar...' : 'Spara ändringar'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4 mt-6">
            <JobQuestionsManager 
              jobId={job?.id || null} 
              onQuestionsChange={onJobUpdated} 
            />
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Stäng
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setActiveTab("basic")}
              >
                Tillbaka till grundinfo
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditJobDialog;

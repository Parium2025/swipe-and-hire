import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { categorizeJob } from '@/lib/jobCategorization';
import { EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { Plus, Loader2 } from 'lucide-react';
import JobQuestionsManager from '@/components/JobQuestionsManager';
import JobTemplateManager from '@/components/JobTemplateManager';

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

interface CreateJobDialogProps {
  onJobCreated: () => void;
}

const CreateJobDialog = ({ onJobCreated }: CreateJobDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    description: '',
    requirements: '',
    location: '',
    salary_min: '',
    salary_max: '',
    employment_type: '',
    work_schedule: '',
    contact_email: '',
    application_instructions: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      // Automatically categorize the job based on title and description
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

      setActiveTab("questions");

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
      salary_min: '',
      salary_max: '',
      employment_type: '',
      work_schedule: '',
      contact_email: '',
      application_instructions: ''
    });
    setCreatedJobId(null);
    setActiveTab("basic");
    setOpen(false);
    onJobCreated();
  };

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectTemplate = (template: JobTemplate) => {
    setFormData({
      title: template.title,
      description: template.description,
      requirements: template.requirements || '',
      location: template.location,
      salary_min: template.salary_min?.toString() || '',
      salary_max: template.salary_max?.toString() || '',
      employment_type: template.employment_type || '',
      work_schedule: template.work_schedule || '',
      contact_email: template.contact_email || '',
      application_instructions: template.application_instructions || ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus size={16} />
          Skapa ny annons
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900/95 backdrop-blur-xl border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Skapa ny jobbannons</DialogTitle>
          <DialogDescription className="text-white/70">
            Fyll i informationen om tjänsten och lägg till ansökningsfrågor.
          </DialogDescription>
        </DialogHeader>
        
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
              
              {/* Job Template Manager */}
              <JobTemplateManager 
                onSelectTemplate={handleSelectTemplate}
                currentFormData={formData}
              />
              
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
                  onClick={() => setOpen(false)}
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

export default CreateJobDialog;
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
import { Plus, Loader2 } from 'lucide-react';
import JobQuestionsManager from '@/components/JobQuestionsManager';

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus size={16} />
          Skapa ny annons
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa ny jobbannons</DialogTitle>
          <DialogDescription>
            Fyll i informationen om tjänsten och lägg till ansökningsfrågor.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Grundinformation</TabsTrigger>
            <TabsTrigger value="questions" disabled={!createdJobId}>
              Ansökningsfrågor
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4 mt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Jobbtitel *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="t.ex. Lagerarbetare, Lastbilschaufför"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Plats *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="t.ex. Stockholm, Göteborg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary_min">Minimilön (kr/mån)</Label>
                  <Input
                    id="salary_min"
                    type="number"
                    value={formData.salary_min}
                    onChange={(e) => handleInputChange('salary_min', e.target.value)}
                    placeholder="25000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary_max">Maxlön (kr/mån)</Label>
                  <Input
                    id="salary_max"
                    type="number"
                    value={formData.salary_max}
                    onChange={(e) => handleInputChange('salary_max', e.target.value)}
                    placeholder="35000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employment_type">Anställningsform</Label>
                <Select value={formData.employment_type} onValueChange={(value) => handleInputChange('employment_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj anställningsform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Heltid</SelectItem>
                    <SelectItem value="part_time">Deltid</SelectItem>
                    <SelectItem value="contract">Konsult</SelectItem>
                    <SelectItem value="temporary">Tillfällig</SelectItem>
                    <SelectItem value="internship">Praktik</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_schedule">Arbetstider</Label>
                <Input
                  id="work_schedule"
                  value={formData.work_schedule}
                  onChange={(e) => handleInputChange('work_schedule', e.target.value)}
                  placeholder="t.ex. 08:00-17:00, Skiftarbete"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Kontakt-email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => handleInputChange('contact_email', e.target.value)}
                  placeholder="kontakt@företag.se"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beskrivning *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..."
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirements">Krav och kvalifikationer</Label>
                <Textarea
                  id="requirements"
                  value={formData.requirements}
                  onChange={(e) => handleInputChange('requirements', e.target.value)}
                  placeholder="Beskriv vilka krav och kvalifikationer som krävs för tjänsten..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="application_instructions">Ansökningsinstruktioner</Label>
                <Textarea
                  id="application_instructions"
                  value={formData.application_instructions}
                  onChange={(e) => handleInputChange('application_instructions', e.target.value)}
                  placeholder="Hur ska kandidater ansöka? Via e-post, telefon eller webbsida?"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Skapar...' : 'Spara och fortsätt'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4 mt-6">
            <JobQuestionsManager 
              jobId={createdJobId} 
              onQuestionsChange={() => {}} 
            />
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleClose}
                className="flex-1"
              >
                Avsluta och publicera
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setActiveTab("basic")}
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
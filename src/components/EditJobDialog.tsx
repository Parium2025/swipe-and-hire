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
import { Loader2 } from 'lucide-react';
import JobQuestionsManager from '@/components/JobQuestionsManager';

// Keep this dialog lean and robust so edit always works
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
}

interface JobFormData {
  title: string;
  description: string;
  requirements: string;
  location: string;
  salary_min: string;
  salary_max: string;
  employment_type: string;
  positions_count: string;
  work_schedule: string;
  contact_email: string;
  application_instructions: string;
}

interface EditJobDialogProps {
  job: JobPosting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobUpdated: () => void;
}

const EditJobDialog = ({ job, open, onOpenChange, onJobUpdated }: EditJobDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    description: '',
    requirements: '',
    location: '',
    salary_min: '',
    salary_max: '',
    employment_type: '',
    positions_count: '1',
    work_schedule: '',
    contact_email: '',
    application_instructions: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Sync incoming job to form
  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || '',
        description: job.description || '',
        requirements: job.requirements || '',
        location: job.location || '',
        salary_min: job.salary_min?.toString() || '',
        salary_max: job.salary_max?.toString() || '',
        employment_type: job.employment_type || '',
        positions_count: (job.positions_count ?? 1).toString(),
        work_schedule: job.work_schedule || '',
        contact_email: job.contact_email || '',
        application_instructions: job.application_instructions || ''
      });
    }
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !job) return;

    setLoading(true);
    try {
      const payload = {
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
        application_instructions: formData.application_instructions || null
      };

      const { error } = await supabase
        .from('job_postings')
        .update(payload)
        .eq('id', job.id);

      if (error) {
        toast({ title: 'Fel vid uppdatering', description: error.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Annons uppdaterad', description: 'Dina ändringar har sparats.' });
      onOpenChange(false);
      onJobUpdated();
    } catch (err) {
      toast({ title: 'Ett fel uppstod', description: 'Kunde inte uppdatera annonsen.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const setField = (field: keyof JobFormData) => (value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!job ? (
          <div className="py-10 text-center">
            <DialogHeader>
              <DialogTitle>Laddar annons...</DialogTitle>
              <DialogDescription>Försök igen om ett ögonblick.</DialogDescription>
            </DialogHeader>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Redigera jobbannons</DialogTitle>
              <DialogDescription>Uppdatera information om tjänsten.</DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Grundinformation</TabsTrigger>
                <TabsTrigger value="questions">Ansökningsfrågor</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_title">Jobbtitel *</Label>
                    <Input id="edit_title" value={formData.title} onChange={(e) => setField('title')(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_location">Plats *</Label>
                    <Input id="edit_location" value={formData.location} onChange={(e) => setField('location')(e.target.value)} required />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_salary_min">Minimilön (kr/mån)</Label>
                      <Input id="edit_salary_min" type="number" value={formData.salary_min} onChange={(e) => setField('salary_min')(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_salary_max">Maxlön (kr/mån)</Label>
                      <Input id="edit_salary_max" type="number" value={formData.salary_max} onChange={(e) => setField('salary_max')(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_employment_type">Anställningsform</Label>
                    <Select value={formData.employment_type || ''} onValueChange={(v) => setField('employment_type')(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj anställningsform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Ej specificerat</SelectItem>
                        {EMPLOYMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_positions_count">Antal personer</Label>
                    <Input id="edit_positions_count" type="number" min="1" value={formData.positions_count} onChange={(e) => setField('positions_count')(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_work_schedule">Arbetstider</Label>
                    <Input id="edit_work_schedule" value={formData.work_schedule} onChange={(e) => setField('work_schedule')(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_contact_email">Kontakt‑email *</Label>
                    <Input id="edit_contact_email" type="email" value={formData.contact_email} onChange={(e) => setField('contact_email')(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_description">Beskrivning *</Label>
                    <Textarea id="edit_description" value={formData.description} onChange={(e) => setField('description')(e.target.value)} rows={4} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_requirements">Krav och kvalifikationer</Label>
                    <Textarea id="edit_requirements" value={formData.requirements} onChange={(e) => setField('requirements')(e.target.value)} rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_application_instructions">Ansökningsinstruktioner</Label>
                    <Textarea id="edit_application_instructions" value={formData.application_instructions} onChange={(e) => setField('application_instructions')(e.target.value)} rows={3} />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {loading ? 'Uppdaterar...' : 'Spara ändringar'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                      Avbryt
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="questions" className="space-y-4 mt-6">
                <JobQuestionsManager jobId={job?.id || null} onQuestionsChange={onJobUpdated} />
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => onOpenChange(false)} className="flex-1">Stäng</Button>
                  <Button variant="outline" onClick={() => setActiveTab('basic')}>Tillbaka till grundinfo</Button>
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

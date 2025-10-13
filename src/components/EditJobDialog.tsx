import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYMENT_TYPES, normalizeEmploymentType } from '@/lib/employmentTypes';
import { Loader2, X } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import WorkplacePostalCodeSelector from '@/components/WorkplacePostalCodeSelector';

const JobQuestionsManagerLazy = lazy(() => import('@/components/JobQuestionsManager'));

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
  salary_type?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  workplace_name?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_city?: string;
  pitch?: string;
  job_image_url?: string;
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

interface EditJobDialogProps {
  job: JobPosting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobUpdated: () => void;
}

const EditJobDialog = ({ job, open, onOpenChange, onJobUpdated }: EditJobDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [initialFormData, setInitialFormData] = useState<JobFormData | null>(null);
  
  const [formData, setFormData] = useState<JobFormData>({
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
    pitch: '',
    job_image_url: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Sync incoming job to form
  useEffect(() => {
    if (job && open) {
      const newFormData: JobFormData = {
        title: job.title || '',
        description: job.description || '',
        requirements: job.requirements || '',
        location: job.location || '',
        occupation: job.occupation || '',
        salary_min: job.salary_min?.toString() || '',
        salary_max: job.salary_max?.toString() || '',
        employment_type: normalizeEmploymentType(job.employment_type || ''),
        salary_type: job.salary_type || '',
        positions_count: (job.positions_count ?? 1).toString(),
        work_location_type: job.work_location_type || '',
        remote_work_possible: job.remote_work_possible || '',
        workplace_name: job.workplace_name || '',
        workplace_address: job.workplace_address || '',
        workplace_postal_code: job.workplace_postal_code || '',
        workplace_city: job.workplace_city || '',
        work_schedule: job.work_schedule || '',
        contact_email: job.contact_email || '',
        application_instructions: job.application_instructions || '',
        pitch: job.pitch || '',
        job_image_url: job.job_image_url || ''
      };
      setFormData(newFormData);
      setInitialFormData(newFormData);
      setHasUnsavedChanges(false);
    }
  }, [job, open]);

  // Track unsaved changes
  useEffect(() => {
    if (!initialFormData || !open) return;
    
    const changed = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    setHasUnsavedChanges(changed);
  }, [formData, initialFormData, open]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setPendingClose(true);
      setShowUnsavedDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedDialog(false);
    setPendingClose(false);
    setHasUnsavedChanges(false);
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowUnsavedDialog(false);
    setPendingClose(false);
  };

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
        job_image_url: formData.job_image_url || null
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
      setHasUnsavedChanges(false);
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

  const SALARY_TYPES = [
    { value: 'monthly', label: 'Månadslön' },
    { value: 'hourly', label: 'Timlön' },
    { value: 'fixed', label: 'Fast lön' }
  ];

  const WORK_LOCATION_TYPES = [
    { value: 'på-plats', label: 'På plats' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'remote', label: 'Distans' }
  ];

  const REMOTE_WORK_OPTIONS = [
    { value: 'ja', label: 'Ja' },
    { value: 'nej', label: 'Nej' },
    { value: 'delvis', label: 'Delvis' }
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        } else {
          onOpenChange(isOpen);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-parium-gradient border-none shadow-none">
          <div className="bg-white/10 backdrop-blur-sm border-transparent rounded-lg overflow-hidden">
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-white text-2xl">Redigera jobbannons</DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </DialogHeader>

            <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {!job ? (
                <div className="py-10 text-center text-white">
                  <p>Laddar annons...</p>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-white/5">
                    <TabsTrigger value="basic" className="data-[state=active]:bg-white/20">
                      Grundinformation
                    </TabsTrigger>
                    <TabsTrigger value="questions" className="data-[state=active]:bg-white/20">
                      Ansökningsfrågor
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 mt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Titel */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_title" className="text-white">Jobbtitel *</Label>
                        <Input
                          id="edit_title"
                          value={formData.title}
                          onChange={(e) => setField('title')(e.target.value)}
                          required
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Yrke */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_occupation" className="text-white">Yrke</Label>
                        <Input
                          id="edit_occupation"
                          value={formData.occupation}
                          onChange={(e) => setField('occupation')(e.target.value)}
                          placeholder="T.ex. Truckförare"
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Plats */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_location" className="text-white">Plats *</Label>
                        <Input
                          id="edit_location"
                          value={formData.location}
                          onChange={(e) => setField('location')(e.target.value)}
                          required
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Arbetsplats */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_workplace_name" className="text-white">Arbetsplatsnamn</Label>
                        <Input
                          id="edit_workplace_name"
                          value={formData.workplace_name}
                          onChange={(e) => setField('workplace_name')(e.target.value)}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit_workplace_address" className="text-white">Arbetsplatsadress</Label>
                        <Input
                          id="edit_workplace_address"
                          value={formData.workplace_address}
                          onChange={(e) => setField('workplace_address')(e.target.value)}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      <WorkplacePostalCodeSelector
                        postalCodeValue={formData.workplace_postal_code}
                        cityValue={formData.workplace_city}
                        onPostalCodeChange={setField('workplace_postal_code')}
                        onLocationChange={setField('workplace_city')}
                      />

                      {/* Lön */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_salary_min" className="text-white">Minimilön</Label>
                          <Input
                            id="edit_salary_min"
                            type="number"
                            value={formData.salary_min}
                            onChange={(e) => setField('salary_min')(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_salary_max" className="text-white">Maxlön</Label>
                          <Input
                            id="edit_salary_max"
                            type="number"
                            value={formData.salary_max}
                            onChange={(e) => setField('salary_max')(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit_salary_type" className="text-white">Lönetyp</Label>
                        <Select value={formData.salary_type || undefined} onValueChange={setField('salary_type')}>
                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Välj lönetyp" />
                          </SelectTrigger>
                          <SelectContent>
                            {SALARY_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Anställningsform */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_employment_type" className="text-white">Anställningsform</Label>
                        <Select
                          value={(EMPLOYMENT_TYPES.some(t => t.value === formData.employment_type) ? formData.employment_type : undefined) as any}
                          onValueChange={setField('employment_type')}
                        >
                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Välj anställningsform" />
                          </SelectTrigger>
                          <SelectContent>
                            {EMPLOYMENT_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Arbetstid */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_work_schedule" className="text-white">Arbetstider</Label>
                        <Input
                          id="edit_work_schedule"
                          value={formData.work_schedule}
                          onChange={(e) => setField('work_schedule')(e.target.value)}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Arbetsplatstyp */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_work_location_type" className="text-white">Arbetsplatstyp</Label>
                        <Select value={formData.work_location_type || undefined} onValueChange={setField('work_location_type')}>
                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Välj arbetsplatstyp" />
                          </SelectTrigger>
                          <SelectContent>
                            {WORK_LOCATION_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit_remote_work" className="text-white">Distansarbete möjligt?</Label>
                        <Select value={formData.remote_work_possible || undefined} onValueChange={setField('remote_work_possible')}>
                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Välj alternativ" />
                          </SelectTrigger>
                          <SelectContent>
                            {REMOTE_WORK_OPTIONS.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Antal personer */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_positions_count" className="text-white">Antal personer</Label>
                        <Input
                          id="edit_positions_count"
                          type="number"
                          min="1"
                          value={formData.positions_count}
                          onChange={(e) => setField('positions_count')(e.target.value)}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Kontakt */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_contact_email" className="text-white">Kontakt‑email *</Label>
                        <Input
                          id="edit_contact_email"
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => setField('contact_email')(e.target.value)}
                          required
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Beskrivning */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_description" className="text-white">Beskrivning *</Label>
                        <Textarea
                          id="edit_description"
                          value={formData.description}
                          onChange={(e) => setField('description')(e.target.value)}
                          rows={4}
                          required
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Krav */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_requirements" className="text-white">Krav och kvalifikationer</Label>
                        <Textarea
                          id="edit_requirements"
                          value={formData.requirements}
                          onChange={(e) => setField('requirements')(e.target.value)}
                          rows={3}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Pitch */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_pitch" className="text-white">Pitch (kort sammanfattning)</Label>
                        <Textarea
                          id="edit_pitch"
                          value={formData.pitch}
                          onChange={(e) => setField('pitch')(e.target.value)}
                          rows={2}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      {/* Ansökningsinstruktioner */}
                      <div className="space-y-2">
                        <Label htmlFor="edit_application_instructions" className="text-white">Ansökningsinstruktioner</Label>
                        <Textarea
                          id="edit_application_instructions"
                          value={formData.application_instructions}
                          onChange={(e) => setField('application_instructions')(e.target.value)}
                          rows={3}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button
                          type="submit"
                          disabled={loading}
                          className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/20"
                        >
                          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {loading ? 'Uppdaterar...' : 'Spara ändringar'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClose}
                          disabled={loading}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          Avbryt
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="questions" className="space-y-4 mt-6">
                    {activeTab === 'questions' && (
                      <Suspense fallback={<div className="text-sm text-white/70">Laddar frågor...</div>}>
                        <JobQuestionsManagerLazy jobId={job?.id || null} onQuestionsChange={onJobUpdated} />
                      </Suspense>
                    )}
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleClose}
                        className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/20"
                      >
                        Stäng
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('basic')}
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        Tillbaka till grundinfo
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
};

export default EditJobDialog;

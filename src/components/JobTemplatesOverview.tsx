import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { Plus, Edit, Trash2, Calendar, Loader2, Star, StarOff } from 'lucide-react';

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
  created_at: string;
  updated_at: string;
}

const JobTemplatesOverview = () => {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
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

  const fetchTemplates = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('job_templates')
        .select('*')
        .eq('employer_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Fel vid hämtning av mallar",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      setTemplates(data || []);
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte hämta jobbmallar.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [user]);

  const resetForm = () => {
    setFormData({
      name: '',
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
  };

  const handleCreate = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const templateData = {
        employer_id: user.id,
        name: formData.name,
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || null,
        location: formData.location,
        employment_type: formData.employment_type || null,
        work_schedule: formData.work_schedule || null,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        contact_email: formData.contact_email || null,
        application_instructions: formData.application_instructions || null,
        is_default: templates.length === 0 // First template becomes default
      };

      const { error } = await supabase
        .from('job_templates')
        .insert([templateData]);

      if (error) {
        toast({
          title: "Fel vid skapande av mall",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Mall skapad",
        description: `Mallen "${formData.name}" har skapats.`
      });

      resetForm();
      setShowCreateDialog(false);
      fetchTemplates();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skapa mallen.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!user || !editingTemplate) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('job_templates')
        .update({
          name: formData.name,
          title: formData.title,
          description: formData.description,
          requirements: formData.requirements || null,
          location: formData.location,
          employment_type: formData.employment_type || null,
          work_schedule: formData.work_schedule || null,
          salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
          salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
          contact_email: formData.contact_email || null,
          application_instructions: formData.application_instructions || null
        })
        .eq('id', editingTemplate.id);

      if (error) {
        toast({
          title: "Fel vid uppdatering av mall",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Mall uppdaterad",
        description: `Mallen "${formData.name}" har uppdaterats.`
      });

      resetForm();
      setShowEditDialog(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte uppdatera mallen.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (templateId: string, templateName: string) => {
    if (!confirm(`Är du säker på att du vill ta bort mallen "${templateName}"?`)) return;

    try {
      const { error } = await supabase
        .from('job_templates')
        .delete()
        .eq('id', templateId);

      if (error) {
        toast({
          title: "Fel vid borttagning",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Mall borttagen",
        description: `Mallen "${templateName}" har tagits bort.`
      });

      fetchTemplates();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte ta bort mallen.",
        variant: "destructive"
      });
    }
  };

  const toggleDefault = async (templateId: string) => {
    try {
      // First, remove default status from all templates
      await supabase
        .from('job_templates')
        .update({ is_default: false })
        .eq('employer_id', user?.id);

      // Then set the selected template as default
      const { error } = await supabase
        .from('job_templates')
        .update({ is_default: true })
        .eq('id', templateId);

      if (error) {
        toast({
          title: "Fel vid uppdatering",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Standardmall uppdaterad",
        description: "Den nya standardmallen har sparats."
      });

      fetchTemplates();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte uppdatera standardmall.",
        variant: "destructive"
      });
    }
  };

  const startEdit = (template: JobTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
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
    setShowEditDialog(true);
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return 'Ej angivet';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return 'Ej angivet';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-white" />
          <h2 className="text-xl text-white">Laddar mallar...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Jobbmallar</h1>
          <p className="text-white/90 mt-1">
            Hantera dina återanvändbara jobbmallar
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center gap-2">
              Skapa ny mall
              <Plus size={16} />
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Templates Grid */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2 text-white">Inga mallar än</h3>
              <p className="text-white/70 mb-4">
                Skapa din första jobbmall för att effektivisera ditt rekryteringsarbete.
              </p>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    Skapa första mallen
                    <Plus size={16} className="ml-2" />
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-xl text-white">{template.name}</CardTitle>
                      {template.is_default && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30">
                          <Star size={12} className="mr-1" />
                          Standard
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-white/70">
                      {template.title} • {template.location}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDefault(template.id)}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      title={template.is_default ? "Ta bort som standard" : "Sätt som standard"}
                    >
                      {template.is_default ? <StarOff size={14} /> : <Star size={14} />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(template)}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <Edit size={14} className="mr-1" />
                      Redigera
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id, template.name)}
                      className="bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40"
                    >
                      <Trash2 size={14} className="mr-1" />
                      Ta bort
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/80 mb-4 line-clamp-2">
                  {template.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-white/70">
                  <div>
                    <span className="font-medium">Lön:</span> {formatSalary(template.salary_min, template.salary_max)}
                  </div>
                  <div>
                    <span className="font-medium">Anställningsform:</span> {template.employment_type || 'Ej angivet'}
                  </div>
                  <div>
                    <span className="font-medium">Arbetstider:</span> {template.work_schedule || 'Ej angivet'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>Skapad: {new Date(template.created_at).toLocaleDateString('sv-SE')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Template Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          setEditingTemplate(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-parium-gradient border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Redigera mall' : 'Skapa ny jobbmall'}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {editingTemplate 
                ? 'Uppdatera din jobbmall med ny information.'
                : 'Skapa en återanvändbar mall för framtida jobbannonser.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Mallnamn *</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="t.ex. Lagerarbetare standardmall"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                required
              />
            </div>

            <div className="border-t border-white/10 my-4"></div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job-title">Jobbtitel *</Label>
                <Input
                  id="job-title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="t.ex. Lagerarbetare"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Plats *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="t.ex. Stockholm"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  required
                />
              </div>
            </div>

            <div className="border-t border-white/10 my-4"></div>

            <div className="space-y-2">
              <Label htmlFor="description">Jobbeskrivning *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Beskriv jobbet, arbetsuppgifter och vad ni erbjuder..."
                rows={4}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                required
              />
            </div>

            <div className="border-t border-white/10 my-4"></div>

            <div className="space-y-2">
              <Label htmlFor="requirements">Krav och kvalifikationer</Label>
              <Textarea
                id="requirements"
                value={formData.requirements}
                onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                placeholder="Beskriv vilka krav och kvalifikationer som krävs..."
                rows={3}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>

            <div className="border-t border-white/10 my-4"></div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary_min">Minimilön (kr/mån)</Label>
                <Input
                  id="salary_min"
                  type="number"
                  value={formData.salary_min}
                  onChange={(e) => setFormData({...formData, salary_min: e.target.value})}
                  placeholder="25000"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary_max">Maxlön (kr/mån)</Label>
                <Input
                  id="salary_max"
                  type="number"
                  value={formData.salary_max}
                  onChange={(e) => setFormData({...formData, salary_max: e.target.value})}
                  placeholder="35000"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>
            </div>

            <div className="border-t border-white/10 my-4"></div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employment_type">Anställningsform</Label>
                <Select value={formData.employment_type} onValueChange={(value) => setFormData({...formData, employment_type: value})}>
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
                <Label htmlFor="work_schedule">Arbetstider</Label>
                <Input
                  id="work_schedule"
                  value={formData.work_schedule}
                  onChange={(e) => setFormData({...formData, work_schedule: e.target.value})}
                  placeholder="t.ex. 08:00-17:00"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>
            </div>

            <div className="border-t border-white/10 my-4"></div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Kontakt-email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                placeholder="kontakt@företag.se"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>

            <div className="border-t border-white/10 my-4"></div>

            <div className="space-y-2">
              <Label htmlFor="application_instructions">Ansökningsinstruktioner</Label>
              <Textarea
                id="application_instructions"
                value={formData.application_instructions}
                onChange={(e) => setFormData({...formData, application_instructions: e.target.value})}
                placeholder="Hur ska kandidater ansöka?"
                rows={3}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={editingTemplate ? handleEdit : handleCreate}
                disabled={isSubmitting || !formData.name || !formData.title || !formData.description || !formData.location}
                className={`flex-1 ${
                  !isSubmitting && formData.name && formData.title && formData.description && formData.location 
                    ? 'border border-white/30' 
                    : ''
                }`}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Sparar...' : (editingTemplate ? 'Uppdatera mall' : 'Skapa mall')}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false);
                  setShowEditDialog(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
                disabled={isSubmitting}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Avbryt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobTemplatesOverview;
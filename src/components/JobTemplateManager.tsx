import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { Loader2, Trash2, Edit, Plus } from 'lucide-react';

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
}

interface JobTemplateManagerProps {
  onSelectTemplate: (template: JobTemplate) => void;
  currentFormData?: JobFormData;
  onCreateTemplate?: () => void;
}

const JobTemplateManager = ({ onSelectTemplate, currentFormData, onCreateTemplate }: JobTemplateManagerProps) => {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
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

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      onSelectTemplate(template);
    }
  };

  const handleCreateTemplate = async () => {
    if (!user || !currentFormData || !newTemplateName.trim()) return;

    setIsCreatingTemplate(true);

    try {
      const templateData = {
        employer_id: user.id,
        name: newTemplateName.trim(),
        title: currentFormData.title,
        description: currentFormData.description,
        requirements: currentFormData.requirements || null,
        location: currentFormData.location,
        employment_type: currentFormData.employment_type || null,
        work_schedule: currentFormData.work_schedule || null,
        salary_min: currentFormData.salary_min ? parseInt(currentFormData.salary_min) : null,
        salary_max: currentFormData.salary_max ? parseInt(currentFormData.salary_max) : null,
        contact_email: currentFormData.contact_email || null,
        application_instructions: currentFormData.application_instructions || null,
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
        description: `Mallen "${newTemplateName}" har skapats.`
      });

      setNewTemplateName('');
      setShowCreateDialog(false);
      fetchTemplates();
      onCreateTemplate?.();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skapa mallen.",
        variant: "destructive"
      });
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna mall?')) return;

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
        description: "Jobbmallen har tagits bort."
      });

      fetchTemplates();
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId('');
      }
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte ta bort mallen.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/70">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laddar mallar...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="template-select">Jobbmall</Label>
          <div className="flex gap-2">
            <Select 
              value={selectedTemplateId} 
              onValueChange={handleSelectTemplate}
            >
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Välj mall eller skapa från scratch" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {templates.map((template) => (
                  <SelectItem 
                    key={template.id} 
                    value={template.id}
                    className="text-white hover:bg-gray-700 focus:bg-gray-700"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{template.name}</span>
                      {template.is_default && (
                        <span className="text-xs text-blue-400 ml-2">Standard</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {currentFormData && currentFormData.title && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 whitespace-nowrap"
              >
                <Plus size={14} className="mr-1" />
                Spara som mall
              </Button>
            )}
          </div>
          
          {selectedTemplateId && (
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const template = templates.find(t => t.id === selectedTemplateId);
                  if (template) {
                    setEditingTemplate(template);
                    setShowEditDialog(true);
                  }
                }}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs h-7"
              >
                <Edit size={12} className="mr-1" />
                Redigera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDeleteTemplate(selectedTemplateId)}
                className="bg-white/10 border-white/20 text-white hover:bg-red-500/20 text-xs h-7"
              >
                <Trash2 size={12} className="mr-1" />
                Ta bort
              </Button>
            </div>
          )}
        </div>

        {templates.length === 0 && (
          <p className="text-sm text-white/70">
            Inga mallar än. Fyll i formuläret nedan och spara som mall för framtida användning.
          </p>
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gray-800 border-gray-600 text-white">
          <DialogHeader>
            <DialogTitle>Spara som mall</DialogTitle>
            <DialogDescription className="text-white/70">
              Ge din mall ett namn för att återanvända denna jobbannons i framtiden.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Mallnamn</Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="t.ex. Lagerarbetare standardmall"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateTemplate}
                disabled={isCreatingTemplate || !newTemplateName.trim()}
                className="flex-1"
              >
                {isCreatingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCreatingTemplate ? 'Skapar...' : 'Spara mall'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewTemplateName('');
                }}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Avbryt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default JobTemplateManager;
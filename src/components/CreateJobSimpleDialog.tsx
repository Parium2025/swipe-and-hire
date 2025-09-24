import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';
import CreateJobDetailDialog from '@/components/CreateJobDetailDialog';

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

interface CreateJobSimpleDialogProps {
  onJobCreated: () => void;
}

const CreateJobSimpleDialog = ({ onJobCreated }: CreateJobSimpleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<JobTemplate | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
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
      
      // Set default template if available and no title is set
      const defaultTemplate = data?.find(t => t.is_default);
      if (defaultTemplate && !jobTitle) {
        setSelectedTemplate(defaultTemplate);
        setJobTitle(defaultTemplate.title);
      }
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte hämta jobbmallar.",
        variant: "destructive"
      });
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [user, open]);

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === 'none') {
      setSelectedTemplate(null);
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      if (!jobTitle) {
        setJobTitle(template.title);
      }
    }
  };

  const handleCreateJob = () => {
    if (!jobTitle.trim()) {
      toast({
        title: "Titel krävs",
        description: "Vänligen ange en titel för jobbet.",
        variant: "destructive"
      });
      return;
    }

    setOpen(false);
    setShowDetailDialog(true);
  };

  const handleClose = () => {
    setOpen(false);
    setJobTitle('');
    setSelectedTemplate(null);
  };

  const handleJobCreated = () => {
    setShowDetailDialog(false);
    setJobTitle('');
    setSelectedTemplate(null);
    onJobCreated();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <Plus size={16} />
            Skapa ny annons
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md bg-parium-gradient">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-center">
                Skapa jobb
              </CardTitle>
              <CardDescription className="text-white/80 text-center">
                Namnge ditt jobb och välj en mall för att komma igång
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="job-title" className="text-white">Titel</Label>
                <Input
                  id="job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Namnge jobbet"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-template" className="text-white">Jobbmall</Label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-sm text-white/70 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laddar mallar...
                  </div>
                ) : (
                  <Select 
                    value={selectedTemplate?.id || 'none'} 
                    onValueChange={handleTemplateSelect}
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Standardmall" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 min-w-[var(--radix-select-trigger-width)] w-full">
                      <SelectItem 
                        value="none" 
                        className="text-white hover:bg-gray-700 focus:bg-gray-700 flex justify-center items-center pl-2 pr-2"
                      >
                        <div className="w-full text-center">Ingen mall (tom annons)</div>
                      </SelectItem>
                      {templates.map((template) => (
                        <SelectItem 
                          key={template.id} 
                          value={template.id}
                          className="text-white hover:bg-gray-700 focus:bg-gray-700 justify-center text-center"
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
                )}
              </div>

              {templates.length > 0 && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      // TODO: Open template management
                    }}
                    className="bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:text-white text-xs"
                  >
                    Lägg till en ny mall
                  </Button>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreateJob}
                  disabled={loading || !jobTitle.trim()}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Skapa jobb
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Avbryt
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <CreateJobDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        jobTitle={jobTitle}
        selectedTemplate={selectedTemplate}
        onJobCreated={handleJobCreated}
      />
    </>
  );
};

export default CreateJobSimpleDialog;
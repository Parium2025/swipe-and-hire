import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, ChevronDown, Search, X } from 'lucide-react';
import MobileJobWizard from '@/components/MobileJobWizard';
import CreateTemplateWizard from '@/components/CreateTemplateWizard';

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
  questions?: any[];
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
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTemplateWizard, setShowTemplateWizard] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
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

      setTemplates((data as any) || []);
      
      // Set default template if available and no title is set
      const defaultTemplate = data?.find(t => t.is_default);
      if (defaultTemplate && !jobTitle) {
        setSelectedTemplate(defaultTemplate as any);
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
  }, [user, jobTitle, toast]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [user, open]);

  const handleTemplateSelect = useCallback((templateId: string, templateName: string) => {
    if (templateId === 'none') {
      setSelectedTemplate(null);
      setTemplateMenuOpen(false);
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template as any);
      if (!jobTitle) {
        setJobTitle(template.title);
      }
    }
    setTemplateMenuOpen(false);
  }, [templates, jobTitle]);

  // Filter templates based on search term
  const filteredTemplates = useMemo(
    () => templates.filter(template =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [templates, searchTerm]
  );

  const handleCreateJob = useCallback(() => {
    if (!jobTitle.trim()) {
      toast({
        title: "Titel krävs",
        description: "Vänligen ange en titel för jobbet.",
        variant: "destructive"
      });
      console.warn('CreateJobSimpleDialog: prevented create, empty title');
      return;
    }

    console.log('CreateJobSimpleDialog: opening MobileJobWizard', {
      jobTitle,
      selectedTemplateId: selectedTemplate?.id,
    });
    setOpen(false);
    // Använd requestAnimationFrame för smidigare transition
    requestAnimationFrame(() => {
      setShowDetailDialog(true);
    });
  }, [jobTitle, selectedTemplate, toast]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setJobTitle('');
    setSelectedTemplate(null);
  }, []);

  const handleJobCreated = useCallback(() => {
    setShowDetailDialog(false);
    setJobTitle('');
    setSelectedTemplate(null);
    onJobCreated();
  }, [onJobCreated]);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          // Rensa data när dialogen stängs
          setJobTitle('');
          setSelectedTemplate(null);
          setSearchTerm('');
        }
      }}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <Plus size={16} />
            Skapa ny annons
          </Button>
        </DialogTrigger>
          <DialogContent className="max-w-md bg-parium-gradient [&>button]:hidden max-h-[95vh] overflow-y-auto sm:max-h-[90vh] border-none shadow-none sm:rounded-xl transition-all duration-200 ease-out animate-scale-in">
          <Card className="bg-white/10 backdrop-blur-sm border-transparent border-0 ring-0 shadow-none relative w-full mt-16 transition-all duration-200">
            <CardHeader className="pb-4 pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex-1 text-center text-xl">
                  Skapa jobb
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="absolute right-2 top-2 h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-white text-center text-sm leading-snug mt-2">
                Namnge ett jobb eller välj en utav dina färdig mallar för att komma igång
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="job-title" className="text-white">Titel</Label>
                <Input
                  id="job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Namnge jobbet"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 transition-all duration-150"
                  autoComplete="off"
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
                  <DropdownMenu modal={false} open={templateMenuOpen} onOpenChange={setTemplateMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-all duration-150 justify-between mt-1 text-left"
                      >
                        <span className="truncate text-left flex-1 px-1">
                          {selectedTemplate?.name || 'Ingen mall är vald'}
                        </span>
                        <ChevronDown className="h-5 w-5 flex-shrink-0 opacity-50 ml-2 transition-transform duration-150" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      className="w-80 bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl z-50 rounded-lg text-white overflow-hidden max-h-96 animate-scale-in"
                      side="bottom"
                      align="center"
                      alignOffset={0}
                      sideOffset={8}
                      avoidCollisions={false}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      {/* Search input */}
                      <div className="p-3 border-b border-slate-600/30 sticky top-0 bg-slate-700/95 backdrop-blur-md">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                          <Input
                            placeholder="Sök mall..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 h-10 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-white/40 rounded-lg"
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      {/* Template options */}
                      <div className="max-h-64 overflow-y-auto">
                        {/* Create new template option */}
                        <DropdownMenuItem
                          onClick={() => {
                            setTemplateMenuOpen(false);
                            setOpen(false);
                            setShowTemplateWizard(true);
                          }}
                          className="px-4 py-3 text-white hover:bg-slate-700/80 cursor-pointer transition-colors border-b border-slate-600/20"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">+ Skapa en ny mall</span>
                            <span className="text-xs text-white/60">Skapa en återanvändbar jobbmall</span>
                          </div>
                        </DropdownMenuItem>
                        
                        
                        {filteredTemplates.map((template) => (
                          <DropdownMenuItem
                            key={template.id}
                            onClick={() => handleTemplateSelect(template.id, template.name)}
                            className="px-4 py-3 text-white hover:bg-slate-700/80 cursor-pointer transition-colors border-b border-slate-600/20 last:border-b-0"
                          >
                            <div className="flex flex-col w-full">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{template.name}</span>
                                {template.is_default && (
                                  <span className="text-xs text-blue-400 ml-2">Standard</span>
                                )}
                              </div>
                              <span className="text-xs text-white/60 mt-1">{template.title}</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        
                        {filteredTemplates.length === 0 && searchTerm && (
                          <div className="px-4 py-6 text-center text-white/60">
                            Ingen mall hittades
                          </div>
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {templates.length > 0 && (
                <div className="text-center pt-2">
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

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleCreateJob}
                  disabled={loading || !jobTitle.trim()}
                  className="flex-1 transition-all duration-150 active:scale-95"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Skapa jobb
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-150 active:scale-95"
                >
                  Avbryt
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Mobile Job Wizard */}
      <MobileJobWizard
        open={showDetailDialog}
        onOpenChange={(isOpen) => {
          setShowDetailDialog(isOpen);
          if (!isOpen) {
            // Rensa data när wizard stängs
            setJobTitle('');
            setSelectedTemplate(null);
          }
        }}
        jobTitle={jobTitle}
        selectedTemplate={selectedTemplate}
        onJobCreated={handleJobCreated}
      />

      {/* Create Template Wizard */}
      <CreateTemplateWizard
        open={showTemplateWizard}
        onOpenChange={setShowTemplateWizard}
        onTemplateCreated={() => {
          fetchTemplates();
          toast({
            title: "Mall skapad!",
            description: "Din nya mall är nu tillgänglig."
          });
        }}
      />
    </>
  );
};

export default CreateJobSimpleDialog;
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, ChevronDown, Search, X, Trash2, Pencil } from 'lucide-react';
import MobileJobWizard from '@/components/MobileJobWizard';
import CreateTemplateWizard from '@/components/CreateTemplateWizard';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import type { JobPosting } from '@/hooks/useJobsData';
import { useIsMobile } from '@/hooks/use-mobile';

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
  onJobCreated: (job: JobPosting) => void;
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
  const [templateToEdit, setTemplateToEdit] = useState<JobTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<JobTemplate | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showMobileTemplatePicker, setShowMobileTemplatePicker] = useState(false);

  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const adjustTitleHeight = useCallback((el?: HTMLTextAreaElement | null) => {
    const node = el ?? titleRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = node.scrollHeight + 'px';
  }, []);

  useEffect(() => {
    adjustTitleHeight();
  }, [jobTitle, open, adjustTitleHeight]);

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
      setJobTitle(template.title);
    }
    setTemplateMenuOpen(false);
  }, [templates]);

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
    requestAnimationFrame(() => {
      setShowDetailDialog(true);
    });
  }, [jobTitle, selectedTemplate, toast]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setOpen(false);
      setJobTitle('');
      setSelectedTemplate(null);
      setHasUnsavedChanges(false);
    }
  }, [hasUnsavedChanges]);

  const handleConfirmClose = useCallback(() => {
    setShowUnsavedDialog(false);
    setOpen(false);
    setJobTitle('');
    setSelectedTemplate(null);
    setHasUnsavedChanges(false);
  }, []);

  const handleCancelClose = useCallback(() => {
    setShowUnsavedDialog(false);
  }, []);

  const handleJobCreated = useCallback((job: JobPosting) => {
    setShowDetailDialog(false);
    setJobTitle('');
    setSelectedTemplate(null);
    onJobCreated(job);
  }, [onJobCreated]);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setJobTitle('');
          setSelectedTemplate(null);
          setSearchTerm('');
        }
      }}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 border border-white/30">
            Skapa ny annons
            <Plus size={16} />
          </Button>
        </DialogTrigger>
        <DialogContent 
          hideClose
          className="max-w-md bg-card-parium text-white backdrop-blur-md border-white/20 max-h-[95vh] sm:max-h-[90vh] shadow-lg rounded-[24px] sm:rounded-xl transition-all duration-200 ease-out animate-scale-in overflow-y-auto"
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 ring-0 shadow-none relative w-full transition-all duration-200">
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
                <Textarea
                  id="job-title"
                  ref={titleRef}
                  value={jobTitle}
                  onChange={(e) => {
                    setJobTitle(e.target.value);
                    setHasUnsavedChanges(true);
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  placeholder="Namnge jobbet"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 transition-all duration-150 text-sm resize-none min-h-[36px] leading-tight py-2 overflow-hidden"
                  autoComplete="off"
                  title={jobTitle}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
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
                  <div className="flex items-start gap-2">
                    {isMobile ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-all duration-150 justify-between mt-1 text-left h-auto min-h-9 py-2 whitespace-normal"
                        title={selectedTemplate?.name || 'Ingen mall är vald'}
                        onClick={() => setShowMobileTemplatePicker(true)}
                      >
                        <span className="text-left flex-1 px-1 text-sm whitespace-normal break-words pr-6">
                          {selectedTemplate?.name || 'Ingen mall är vald'}
                        </span>
                        <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50 ml-2 transition-transform duration-150" />
                      </Button>
                    ) : (
                      <DropdownMenu modal={false} open={templateMenuOpen} onOpenChange={setTemplateMenuOpen}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-all duration-150 justify-between mt-1 text-left h-auto min-h-9 py-2 whitespace-normal"
                            title={selectedTemplate?.name || 'Ingen mall är vald'}
                          >
                            <span className="text-left flex-1 px-1 text-sm whitespace-normal break-words pr-6">
                              {selectedTemplate?.name || 'Ingen mall är vald'}
                            </span>
                            <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50 ml-2 transition-transform duration-150" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          className="w-[calc(100vw-2rem)] max-w-sm bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl pointer-events-auto rounded-lg text-white max-h-[70vh] sm:max-h-96 overflow-y-auto touch-pan-y pt-1 pb-2 animate-scale-in"
                          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
                          side="bottom"
                          align="center"
                          alignOffset={0}
                          sideOffset={8}
                          avoidCollisions={false}
                          onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="p-3 border-b border-slate-600/30 sticky top-0 bg-slate-800/95 backdrop-blur-md z-10">
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

                          <div className="bg-slate-800/95">
                            <DropdownMenuItem
                              onClick={() => {
                                setTemplateMenuOpen(false);
                                setOpen(false);
                                setShowTemplateWizard(true);
                              }}
                              className="px-4 py-3 text-white hover:bg-slate-700/80 focus:bg-slate-700/80 focus:text-white cursor-pointer transition-colors border-b border-slate-600/20"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-white">+ Skapa en ny mall</span>
                                <span className="text-sm text-white">Skapa en återanvändbar jobbmall</span>
                              </div>
                            </DropdownMenuItem>
                            
                            {filteredTemplates.map((template) => (
                              <DropdownMenuItem
                                key={template.id}
                                onSelect={(e) => e.preventDefault()}
                                className="px-4 py-3 text-white hover:bg-slate-700/80 focus:bg-slate-700/80 focus:text-white cursor-pointer transition-colors border-b border-slate-600/20 last:border-b-0"
                              >
                                <div className="flex items-center justify-between w-full gap-3">
                                  <button
                                    onClick={() => handleTemplateSelect(template.id, template.name)}
                                    className="flex flex-col flex-1 text-left hover:opacity-80 transition-opacity"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-white">{template.name}</span>
                                      {template.is_default && (
                                        <span className="text-sm text-blue-400 ml-2">Standard</span>
                                      )}
                                    </div>
                                    <span className="text-sm text-white mt-1 break-words line-clamp-2 sm:line-clamp-none">{template.title}</span>
                                  </button>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTemplateToEdit(template);
                                        setTemplateMenuOpen(false);
                                        setOpen(false);
                                        setShowTemplateWizard(true);
                                      }}
                                      variant="ghost"
                                      size="sm"
                                      className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0 flex-shrink-0"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTemplateToDelete(template);
                                      }}
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 h-8 w-8 p-0 flex-shrink-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
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
                    
                    {selectedTemplate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedTemplate(null);
                        }}
                        className="mt-1 h-9 w-9 flex-shrink-0 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-150"
                        title="Ta bort vald mall"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleCreateJob}
                  disabled={loading || !jobTitle.trim()}
                  className={`flex-1 transition-all duration-150 active:scale-95 ${
                    !loading && jobTitle.trim() ? 'border border-white/30' : ''
                  }`}
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
          
          {isMobile && showMobileTemplatePicker && (
            <>
              <div
                className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-300"
                onClick={() => setShowMobileTemplatePicker(false)}
              />
              <div
                className="fixed inset-x-0 bottom-0 z-[1001] rounded-t-3xl bg-slate-800/98 backdrop-blur-xl border-t border-slate-600/40 text-white shadow-2xl animate-in slide-in-from-bottom-0 duration-300 ease-out"
                role="dialog"
                aria-modal="true"
                aria-label="Välj jobbmall"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto max-w-md">
                  <div className="relative px-4 pt-5 pb-3">
                    <div className="absolute left-1/2 top-2 h-1 w-16 -translate-x-1/2 rounded-full bg-white/40" />
                    <div className="flex items-center justify-center mt-2">
                      <span className="font-semibold text-lg">Välj mall</span>
                    </div>
                  </div>
                  <div
                    className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] max-h-[75vh] overflow-y-auto touch-pan-y relative"
                    style={{ 
                      WebkitOverflowScrolling: 'touch', 
                      overscrollBehaviorY: 'contain',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  >
                    <style>{`
                      .overflow-y-auto::-webkit-scrollbar {
                        display: none;
                      }
                    `}</style>
                    
                    <div className="pb-3 sticky top-0 bg-slate-800/98 backdrop-blur-xl z-10 pt-1">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                        <Input
                          placeholder="Sök mall..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-11 pr-4 h-11 bg-white/8 border-white/25 text-white placeholder:text-white/50 focus:border-white/50 focus:ring-2 focus:ring-white/20 rounded-xl transition-all duration-150"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <Card 
                      className="mb-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 shadow-none cursor-pointer hover:from-blue-600/30 hover:to-purple-600/30 transition-all duration-150"
                      onClick={() => {
                        setShowMobileTemplatePicker(false);
                        setOpen(false);
                        setShowTemplateWizard(true);
                      }}
                    >
                      <div className="p-3 flex items-center gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10">
                          <Plus className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-white text-sm">Skapa en ny mall</span>
                          <span className="text-xs text-white/70 mt-0.5">Skapa en återanvändbar jobbmall</span>
                        </div>
                      </div>
                    </Card>

                    <div className="space-y-2">
                      {filteredTemplates.map((template) => (
                        <Card 
                          key={template.id}
                          className="bg-transparent border border-white/30 shadow-none cursor-pointer transition-colors hover:bg-white/5 hover:border-white/50"
                          onClick={() => {
                            handleTemplateSelect(template.id, template.name);
                            setShowMobileTemplatePicker(false);
                          }}
                        >
                          <div className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                                  {template.name}
                                </h3>
                              </div>
                              {template.is_default && (
                                <Badge className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30 flex-shrink-0">
                                  Standard
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-white/70 line-clamp-2">
                              {template.title}
                            </div>

                            <div className="flex gap-2 pt-1">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTemplateToEdit(template);
                                  setShowMobileTemplatePicker(false);
                                  setOpen(false);
                                  setShowTemplateWizard(true);
                                }}
                                className="flex-1 h-11 bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm"
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Redigera
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTemplateToDelete(template);
                                }}
                                className="flex-1 h-11 bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 text-sm"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Ta bort
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {filteredTemplates.length === 0 && searchTerm && (
                      <div className="px-4 py-8 text-center">
                        <div className="text-white/40 text-sm">Ingen mall hittades</div>
                        <div className="text-white/30 text-xs mt-1">Försök med ett annat sökord</div>
                      </div>
                    )}
                    
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-800/98 to-transparent pointer-events-none" />
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <MobileJobWizard
        open={showDetailDialog}
        onOpenChange={(isOpen) => {
          setShowDetailDialog(isOpen);
          if (!isOpen) {
            setJobTitle('');
            setSelectedTemplate(null);
          }
        }}
        jobTitle={jobTitle}
        selectedTemplate={selectedTemplate}
        onJobCreated={handleJobCreated}
      />

      <CreateTemplateWizard
        open={showTemplateWizard}
        onOpenChange={(isOpen) => {
          setShowTemplateWizard(isOpen);
          if (!isOpen) {
            setTemplateToEdit(null);
          }
        }}
        templateToEdit={templateToEdit}
        onTemplateCreated={() => {
          fetchTemplates();
          setTemplateToEdit(null);
          toast({
            title: templateToEdit ? "Mall uppdaterad!" : "Mall skapad!",
            description: templateToEdit ? "Din mall har uppdaterats." : "Din nya mall är nu tillgänglig."
          });
        }}
      />

      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent className="max-w-md bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Ta bort mall</AlertDialogTitle>
            <AlertDialogDescription className="text-white text-base">
              Är du säker på att du vill ta bort mallen <span className="font-semibold text-white">"{templateToDelete?.name}"</span>? 
              Denna åtgärd kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/20 border-white/30 text-white hover:bg-white/30">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!templateToDelete?.id) return;
                
                try {
                  const { error } = await supabase
                    .from('job_templates')
                    .delete()
                    .eq('id', templateToDelete.id);
                  
                  if (error) throw error;
                  
                  setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
                  
                  if (selectedTemplate?.id === templateToDelete.id) {
                    setSelectedTemplate(null);
                  }
                  
                  toast({
                    title: "Mall borttagen",
                    description: `"${templateToDelete.name}" har tagits bort.`
                  });
                } catch (error) {
                  console.error('Error deleting template:', error);
                  toast({
                    title: "Kunde inte ta bort mallen",
                    variant: "destructive"
                  });
                }
                
                setTemplateToDelete(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
};

export default CreateJobSimpleDialog;

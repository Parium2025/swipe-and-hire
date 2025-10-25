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
  const isNavigatingBack = useRef(false);


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

  // Återställ hasUnsavedChanges när formuläret är tomt/neutralt
  useEffect(() => {
    if (!jobTitle.trim() && !selectedTemplate) {
      setHasUnsavedChanges(false);
    }
  }, [jobTitle, selectedTemplate]);

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

  const handleWizardBack = useCallback(() => {
    isNavigatingBack.current = true;
    setShowDetailDialog(false);
    // Öppna mallvalssteget igen efter en kort delay
    requestAnimationFrame(() => {
      setOpen(true);
      setTimeout(() => setTemplateMenuOpen(true), 60);
      isNavigatingBack.current = false;
    });
  }, []);

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
          className="max-w-md bg-card-parium text-white backdrop-blur-md border-white/20 max-h-[95vh] sm:max-h-[90vh] shadow-lg rounded-[24px] sm:rounded-xl transition-all duration-200 ease-out animate-scale-in"
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle className="sr-only">Skapa jobb</DialogTitle>
            <DialogDescription className="sr-only">Välj mall eller ange titel</DialogDescription>
          </DialogHeader>
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
                  value={jobTitle}
                  onChange={(e) => {
                    setJobTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Namnge jobbet"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 transition-all duration-150 text-sm resize-none h-[44px] !min-h-[44px] md:!min-h-[44px] leading-[28px] py-2 overflow-y-auto"
                  autoComplete="off"
                  title={jobTitle}
                  rows={1}
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
                    <DropdownMenu 
                      modal={false} 
                      open={templateMenuOpen} 
                      onOpenChange={(isOpen) => {
                        setTemplateMenuOpen(isOpen);
                        if (isOpen) {
                          setSearchTerm('');
                        }
                      }}
                    >
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-all duration-150 justify-between mt-1 text-left h-auto min-h-[44px] py-2 whitespace-normal"
                            title={selectedTemplate?.name || 'Ingen mall är vald'}
                          >
                            <span className="text-left flex-1 px-1 text-sm whitespace-normal break-words pr-6">
                              {selectedTemplate?.name || 'Ingen mall är vald'}
                            </span>
                            <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50 ml-2 transition-transform duration-150" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          className="w-[calc(100vw-2rem)] max-w-sm bg-slate-800/95 backdrop-blur-md border-slate-600/30 shadow-xl pointer-events-auto rounded-lg text-white max-h-[40vh] overflow-y-auto scrollbar-hide flex flex-col pt-0 pb-0 animate-scale-in"
                          style={{ 
                            WebkitOverflowScrolling: 'touch', 
                            overscrollBehaviorY: 'contain', 
                            touchAction: 'pan-y'
                          }}
                          side="bottom"
                          align="center"
                          alignOffset={0}
                          sideOffset={8}
                          avoidCollisions={true}
                          collisionPadding={16}
                          onWheel={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                          onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="p-3 border-b border-slate-600/30 sticky top-0 bg-slate-800/95 backdrop-blur-md z-10">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/80" />
                              <Input
                                ref={(el) => {
                                  if (el && templateMenuOpen) {
                                    setTimeout(() => el.focus(), 0);
                                  }
                                }}
                                placeholder="Sök mall..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                }}
                                className="pl-10 pr-10 h-10 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-white/40 rounded-lg"
                                autoComplete="off"
                                autoFocus
                              />
                              {searchTerm && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSearchTerm('');
                                  }}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                                  type="button"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Result indicator */}
                          {searchTerm && (
                            <div className="px-4 py-2 text-sm text-white/90 bg-slate-800/50 border-b border-slate-600/20">
                              Visar <span className="text-white font-medium">{filteredTemplates.length}</span> av <span className="text-white font-medium">{templates.length}</span> mallar
                            </div>
                          )}

                          <div className="bg-slate-800/95 flex-1 pb-2">
                            <DropdownMenuItem
                              onClick={() => {
                                setTemplateMenuOpen(false);
                                setOpen(false);
                                setShowTemplateWizard(true);
                              }}
                              onFocus={(e) => {
                                const searchInput = e.currentTarget.closest('[role="menu"]')?.querySelector('input');
                                if (searchInput && document.activeElement === searchInput) {
                                  e.preventDefault();
                                }
                              }}
                              className="px-4 py-2 text-white hover:bg-slate-700/80 focus:bg-slate-700/80 focus:text-white cursor-pointer transition-colors border-b border-slate-600/20"
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
                                onFocus={(e) => {
                                  const searchInput = e.currentTarget.closest('[role="menu"]')?.querySelector('input');
                                  if (searchInput && document.activeElement === searchInput) {
                                    e.preventDefault();
                                  }
                                }}
                                className="px-4 py-2 text-white hover:bg-slate-700/80 focus:bg-slate-700/80 focus:text-white cursor-pointer transition-colors border-b border-slate-600/20 last:border-b-0"
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
                              <div className="px-4 py-8 text-center">
                                <p className="text-white font-medium">
                                  Ingen mall hittades för ({searchTerm})
                                </p>
                              </div>
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    
                    {selectedTemplate && (
                      <Button
                        variant="ghost"
                        size="icon"
                      onClick={() => {
                        setSelectedTemplate(null);
                        setJobTitle('');
                        setHasUnsavedChanges(false);
                      }}
                        className="mt-1 min-h-[44px] w-11 flex-shrink-0 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-150"
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
                  className={`flex-1 min-h-[44px] transition-all duration-150 active:scale-95 ${
                    !loading && jobTitle.trim() ? 'border border-white/30' : ''
                  }`}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Skapa jobb
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="min-h-[44px] bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-150 active:scale-95"
                >
                  Avbryt
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      <MobileJobWizard
        open={showDetailDialog}
        onOpenChange={(isOpen) => {
          setShowDetailDialog(isOpen);
          if (!isOpen && !isNavigatingBack.current) {
            setJobTitle('');
            setSelectedTemplate(null);
          }
        }}
        jobTitle={jobTitle}
        selectedTemplate={selectedTemplate}
        onJobCreated={handleJobCreated}
        onBack={handleWizardBack}
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

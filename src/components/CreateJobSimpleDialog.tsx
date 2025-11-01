import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
// Removed DropdownMenu - using custom dropdown pattern from MobileJobWizard
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
  const [loading, setLoading] = useState(false);
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
  const queryClient = useQueryClient();
  const isNavigatingBack = useRef(false);
  const isMobile = useIsMobile();
  const titleRef = useRef<HTMLInputElement>(null);
  const [titleInputKey, setTitleInputKey] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read from React Query cache (pre-fetched in EmployerLayout)
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['job_templates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Try snapshot first for instant render
      try {
        const snapshot = localStorage.getItem(`templates_snapshot_${user.id}`);
        if (snapshot) {
          const { templates, timestamp } = JSON.parse(snapshot);
          // Use snapshot if less than 5 minutes old
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            return templates;
          }
        }
      } catch {}

      const { data, error } = await supabase
        .from('job_templates')
        .select('*')
        .eq('employer_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    placeholderData: () => {
      // Show snapshot immediately while fetching
      try {
        const snapshot = localStorage.getItem(`templates_snapshot_${user?.id}`);
        if (snapshot) {
          const { templates } = JSON.parse(snapshot);
          return templates;
        }
      } catch {}
      return [];
    },
  });

  // Auto-select default template when templates load
  useEffect(() => {
    if (!loadingTemplates && templates.length > 0 && !selectedTemplate && !jobTitle) {
      const defaultTemplate = templates.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate as any);
        setJobTitle(defaultTemplate.title);
      }
    }
  }, [templates, loadingTemplates, selectedTemplate, jobTitle]);

  // Återställ hasUnsavedChanges när formuläret är tomt/neutralt
  useEffect(() => {
    if (!jobTitle.trim() && !selectedTemplate) {
      setHasUnsavedChanges(false);
    }
  }, [jobTitle, selectedTemplate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };

    if (templateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [templateMenuOpen]);


  // Pre-compute template lookup for instant access (0ms instead of 5-10ms)
  const templateMap = useMemo(
    () => new Map<string, JobTemplate>(templates.map(t => [t.id, t])),
    [templates]
  );

  // Filter templates based on search term
  const filteredTemplates = useMemo(
    () => templates.filter(template =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [templates, searchTerm]
  );

  const handleTemplateSelect = useCallback((templateId: string, templateName: string) => {
    if (templateId === 'none') {
      setSelectedTemplate(null);
      setJobTitle('');
      setHasUnsavedChanges(false);
      setTemplateMenuOpen(false);
      setTitleInputKey((k) => k + 1);
      // Force iOS refresh
      setTimeout(() => {
        if (titleRef.current) {
          titleRef.current.value = '';
          titleRef.current.blur();
          titleRef.current.focus();
          titleRef.current.blur();
        }
      }, 0);
      return;
    }
    
    // INSTANT: Use pre-computed Map (O(1) instead of O(n))
    const template = templateMap.get(templateId);
    if (template) {
      // PREMIUM: Haptic feedback on touch devices
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      
      // INSTANT: Close dropdown FIRST (visual feedback)
      setTemplateMenuOpen(false);
      
      // Batch state updates in single microtask
      startTransition(() => {
        setSelectedTemplate(template as any);
        setJobTitle(template.title);
      });
    }
  }, [templateMap]);

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
      // Stäng dropdown om den är öppen för att undvika felaktig position nästa gång
      setTemplateMenuOpen(false);
    } else {
      setOpen(false);
      setJobTitle('');
      setSelectedTemplate(null);
      setHasUnsavedChanges(false);
      setTemplateMenuOpen(false);
      setTitleInputKey((k) => k + 1);
    }
  }, [hasUnsavedChanges]);

  const handleConfirmClose = useCallback(() => {
    setShowUnsavedDialog(false);
    setOpen(false);
    setJobTitle('');
    setSelectedTemplate(null);
    setHasUnsavedChanges(false);
    setTemplateMenuOpen(false);
    setTitleInputKey((k) => k + 1);
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

  const handleTemplateWizardBack = useCallback(() => {
    setShowTemplateWizard(false);
    // Snabbare timing för mer responsiv känsla
    setTimeout(() => {
      setOpen(true);
      // Lägg till bounce-effekt på dropdown
      setTimeout(() => setTemplateMenuOpen(true), 150);
    }, 80);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setJobTitle('');
          setSelectedTemplate(null);
          setSearchTerm('');
          setTemplateMenuOpen(false);
          setTitleInputKey((k) => k + 1);
        }
      }}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 border border-white/30 text-white transition-transform duration-100 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.92] will-change-transform md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white">
            Skapa ny annons
            <Plus size={16} />
          </Button>
        </DialogTrigger>
        <DialogContent 
          hideClose
          className="w-[min(90vw,400px)] bg-card-parium text-white backdrop-blur-md border-white/20 max-h-[80vh] shadow-lg rounded-[24px] sm:rounded-xl transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform will-change-opacity overflow-hidden"
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
                  className="absolute right-2 top-2 h-8 w-8 text-white/70 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
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
                  key={titleInputKey}
                  ref={titleRef as any}
                  value={jobTitle}
                  onChange={(e) => {
                    setJobTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Namnge jobbet"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 transition-all duration-150 text-sm h-[44px]"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="text"
                  title={jobTitle || "Namnge jobbet"}
                  type="text"
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
                  <div className="relative w-full" ref={dropdownRef}>
                    <Input
                      value={selectedTemplate?.name || ''}
                      onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
                      placeholder="Ingen mall är vald"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-11 text-sm pr-10 cursor-pointer focus:border-white/40 touch-manipulation"
                      readOnly
                    />
                    <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none transition-transform duration-200 z-10 ${templateMenuOpen ? 'rotate-180' : ''}`} />
                    
                    {/* Custom Dropdown */}
                    {templateMenuOpen && !isMobile && (
                      <div 
                        className="absolute top-full left-0 right-0 z-[10000] bg-gray-800 border border-gray-600 rounded-md mt-1 shadow-xl max-h-[40vh] overflow-y-auto"
                        style={{ 
                          WebkitOverflowScrolling: 'touch',
                          overscrollBehaviorY: 'contain'
                        }}
                      >
                        {/* Search Bar */}
                        <div className="p-3 border-b border-gray-600/50 sticky top-0 bg-gray-800 z-10">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/80" />
                            <Input
                              placeholder="Sök mall..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 pr-10 h-10 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-white/40"
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="none"
                              spellCheck={false}
                              inputMode="search"
                            />
                            {searchTerm && (
                              <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                                type="button"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Result Indicator */}
                        {searchTerm && (
                          <div className="px-4 py-2 text-sm text-white/90 bg-gray-800/50 border-b border-gray-600/30">
                            Visar <span className="text-white font-medium">{filteredTemplates.length}</span> av <span className="text-white font-medium">{templates.length}</span> mallar
                          </div>
                        )}


                        {/* Create New Template */}
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateMenuOpen(false);
                            setOpen(false);
                            setShowTemplateWizard(true);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-700 text-white transition-colors border-b border-gray-700"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">+ Skapa en ny mall</span>
                            <span className="text-sm text-white/80">Skapa en återanvändbar jobbmall</span>
                          </div>
                        </button>

                        {/* Template List */}
                        {filteredTemplates.map((template) => (
                          <div
                            key={template.id}
                            className="px-4 py-3 hover:bg-gray-700 text-white transition-colors border-b border-gray-700 last:border-b-0"
                          >
                            <div className="flex items-center justify-between w-full gap-3">
                              <button
                                type="button"
                                onClick={() => handleTemplateSelect(template.id, template.name)}
                                className="flex flex-col flex-1 text-left active:opacity-70 transition-opacity touch-manipulation"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{template.name}</span>
                                  {template.is_default && (
                                    <span className="text-sm text-blue-400 ml-2">Standard</span>
                                  )}
                                </div>
                                <span className="text-sm text-white/80 mt-1 break-words">{template.title}</span>
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
                                  className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
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
                                  className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* No Results */}
                        {filteredTemplates.length === 0 && searchTerm && (
                          <div className="px-4 py-8 text-center">
                            <p className="text-white font-medium">
                              Ingen mall hittades för ({searchTerm})
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mobile Dropdown - opens downward */}
                    {templateMenuOpen && isMobile && (
                      <div 
                        className="absolute top-full left-0 right-0 z-[10000] bg-gray-800 border border-gray-600 rounded-md mt-2 shadow-xl flex flex-col max-h-[50vh] overflow-hidden"
                      >
                        {/* Search Bar - Fixed at top */}
                        <div className="p-3 border-b border-gray-600/50 bg-gray-800 flex-shrink-0">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/80" />
                            <Input
                              placeholder="Sök mall..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 pr-10 h-10 bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:border-white/40"
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="none"
                              spellCheck={false}
                              inputMode="search"
                            />
                            {searchTerm && (
                              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors" type="button">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Scrollable Content */}
                        <div 
                          className="overflow-y-auto flex-1"
                          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}
                        >
                          {/* Result Indicator */}
                          {searchTerm && (
                            <div className="px-4 py-2 text-sm text-white/90 bg-gray-800/50 border-b border-gray-600/30">
                              Visar <span className="text-white font-medium">{filteredTemplates.length}</span> av <span className="text-white font-medium">{templates.length}</span> mallar
                            </div>
                          )}

                          {/* Create New Template */}
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateMenuOpen(false);
                              setOpen(false);
                              setShowTemplateWizard(true);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-700 active:bg-gray-700 text-white transition-colors border-b border-gray-700"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">+ Skapa en ny mall</span>
                              <span className="text-sm text-white/80">Skapa en återanvändbar jobbmall</span>
                            </div>
                          </button>

                          {/* Template List */}
                          {filteredTemplates.map((template) => (
                            <div key={template.id} className="px-4 py-3 hover:bg-gray-700 active:bg-gray-700 text-white transition-colors border-b border-gray-700 last:border-b-0">
                              <div className="flex items-center justify-between w-full gap-3">
                                <button type="button" onClick={() => handleTemplateSelect(template.id, template.name)} className="flex flex-col flex-1 text-left active:opacity-70 transition-opacity touch-manipulation">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{template.name}</span>
                                    {template.is_default && (<span className="text-sm text-blue-400 ml-2">Standard</span>)}
                                  </div>
                                  <span className="text-sm text-white/80 mt-1 break-words">{template.title}</span>
                                </button>
                                <div className="flex gap-1 flex-shrink-0">
                                  <Button onClick={(e) => { e.stopPropagation(); setTemplateToEdit(template); setTemplateMenuOpen(false); setOpen(false); setShowTemplateWizard(true); }} variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 active:bg-white/10 h-8 w-8 p-0">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button onClick={(e) => { e.stopPropagation(); setTemplateToDelete(template); }} variant="ghost" size="sm" className="text-destructive hover:text-destructive/90 hover:bg-destructive/15 active:bg-destructive/15 h-8 w-8 p-0">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* No Results */}
                          {filteredTemplates.length === 0 && searchTerm && (
                            <div className="px-4 py-8 text-center">
                              <p className="text-white font-medium">Ingen mall hittades för ({searchTerm})</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedTemplate && (
                      <div className="flex justify-center mt-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedTemplate(null);
                            setJobTitle('');
                            setHasUnsavedChanges(false);
                            setTitleInputKey((k) => k + 1);
                            setTimeout(() => {
                              if (titleRef.current) {
                                titleRef.current.value = '';
                                titleRef.current.blur();
                                titleRef.current.focus();
                                titleRef.current.blur();
                              }
                            }, 0);
                          }}
                          className="h-8 w-8 text-white/70 transition-all duration-300 md:hover:text-white md:hover:bg-white/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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
                  className="min-h-[44px] bg-white/10 border-white/20 text-white transition-all duration-150 active:scale-95 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
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
          // Invalidate cache to refresh templates
          queryClient.invalidateQueries({ queryKey: ['job_templates', user?.id] });
          setTemplateToEdit(null);
          toast({
            title: templateToEdit ? "Mall uppdaterad!" : "Mall skapad!",
            description: templateToEdit ? "Din mall har uppdaterats." : "Din nya mall är nu tillgänglig."
          });
        }}
        onBack={handleTemplateWizardBack}
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
            <AlertDialogCancel className="bg-white/20 border-white/30 text-white transition-all duration-300 md:hover:bg-white/30 md:hover:text-white md:hover:border-white/50">
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
                  
                  // Invalidate cache to refresh templates
                  queryClient.invalidateQueries({ queryKey: ['job_templates', user?.id] });
                  
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
              variant="destructive"
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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, dialogCloseButtonClassName, dialogCloseIconClassName } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, ChevronDown, Search, X, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import MobileJobWizard from '@/components/MobileJobWizard';
import CreateTemplateWizard from '@/components/CreateTemplateWizard';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import type { JobPosting } from '@/hooks/useJobsData';
import { useIsMobile } from '@/hooks/use-mobile';
import { JobTemplate } from '@/types/jobWizard';
import { cn } from '@/lib/utils';
import { useTapToPreview } from '@/hooks/useTapToPreview';
import { TruncatedText } from '@/components/TruncatedText';

interface CreateJobSimpleDialogProps {
  onJobCreated: (job: JobPosting) => void;
  triggerRef?: React.RefObject<HTMLButtonElement>;
  triggerClassName?: string;
}

const CREATE_JOB_SESSION_KEY = 'parium-creating-job';
const JOB_WIZARD_SESSION_KEY = 'job-wizard-unsaved-state';
const JOB_WIZARD_DRAFT_KEY = 'parium_draft_job-wizard';
const JOB_WIZARD_INTENTIONAL_CLOSE_KEY = 'parium_job_wizard_intentional_close';

const CreateJobSimpleDialog = ({ onJobCreated, triggerRef, triggerClassName }: CreateJobSimpleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isWarmedUp, setIsWarmedUp] = useState(false);
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
  const queryClient = useQueryClient();
  const isNavigatingBack = useRef(false);
  const isMobile = useIsMobile();
  const titleRef = useRef<HTMLInputElement>(null);
  const [titleInputKey, setTitleInputKey] = useState(0);
  const [menuInstanceKey, setMenuInstanceKey] = useState(0);
  const hasPrefetched = useRef(false);
  const hasAutoRestoredDraft = useRef(false);
  const { handleTap, isPreview, resetPreview } = useTapToPreview();
  const templateTextRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const clearCreateJobSession = useCallback(() => {
    try {
      sessionStorage.removeItem(CREATE_JOB_SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const setIntentionalCloseMarker = useCallback((isClosed: boolean) => {
    try {
      if (isClosed) {
        sessionStorage.setItem(JOB_WIZARD_INTENTIONAL_CLOSE_KEY, '1');
        localStorage.setItem(JOB_WIZARD_INTENTIONAL_CLOSE_KEY, '1');
      } else {
        sessionStorage.removeItem(JOB_WIZARD_INTENTIONAL_CLOSE_KEY);
        localStorage.removeItem(JOB_WIZARD_INTENTIONAL_CLOSE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const clearCreateAndWizardDrafts = useCallback(() => {
    clearCreateJobSession();
    try {
      sessionStorage.removeItem(JOB_WIZARD_SESSION_KEY);
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(JOB_WIZARD_DRAFT_KEY);
    } catch {
      // ignore
    }
  }, [clearCreateJobSession]);

  // Auto-restore: if there's a create-job draft/session, re-open wizard directly
  useEffect(() => {
    if (hasAutoRestoredDraft.current || !user) return;
    hasAutoRestoredDraft.current = true;

    const wasIntentionallyClosed = (() => {
      try {
        return (
          sessionStorage.getItem(JOB_WIZARD_INTENTIONAL_CLOSE_KEY) === '1' ||
          localStorage.getItem(JOB_WIZARD_INTENTIONAL_CLOSE_KEY) === '1'
        );
      } catch {
        return false;
      }
    })();

    if (wasIntentionallyClosed) {
      clearCreateAndWizardDrafts();
      return;
    }

    const openWizardFromState = (title?: string) => {
      setJobTitle(typeof title === 'string' ? title : '');
      setSelectedTemplate(null);
      setTimeout(() => setShowDetailDialog(true), 300);
      return true;
    };
    
    try {
      const savedDraft = localStorage.getItem(JOB_WIZARD_DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        // Match wizard TTL (24h) and allow restore even if title is empty
        if (parsed?.savedAt && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000 && parsed?.formData) {
          console.log('🔄 Auto-restoring create job wizard from draft');
          if (openWizardFromState(parsed.formData.title)) {
            return;
          }
        }
      }

      const savedSession = sessionStorage.getItem(CREATE_JOB_SESSION_KEY);
      if (savedSession) {
        const parsedSession = JSON.parse(savedSession);
        if (openWizardFromState(parsedSession?.jobTitle)) {
          console.log('🔄 Auto-restoring create job wizard from session');
        }
      }
    } catch (e) {
      console.warn('Failed to check for job wizard draft');
    }
  }, [user, clearCreateAndWizardDrafts]);

  // Keep a lightweight session marker while wizard is open
  // Also clear intentional-close marker so auto-restore works again if user refreshes
  useEffect(() => {
    if (!showDetailDialog) return;

    // Clear the "intentionally closed" marker — user is opening the wizard again
    setIntentionalCloseMarker(false);

    try {
      sessionStorage.setItem(CREATE_JOB_SESSION_KEY, JSON.stringify({
        jobTitle,
        savedAt: Date.now(),
      }));
    } catch {
      // ignore
    }
  }, [showDetailDialog, jobTitle, setIntentionalCloseMarker]);

  // Warmup with hard hide via CSS to prevent any flash on iOS
  useEffect(() => {
    if (!isMobile) {
      setIsWarmedUp(true);
      return;
    }

    const style = document.createElement('style');
    style.id = 'parium-warmup-hide';
    style.textContent = '[data-parium="dialog-overlay"],[data-parium="dialog-content"]{display:none !important;}';
    document.head.appendChild(style);

    const timer = setTimeout(() => {
      setOpen(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpen(false);
          setIsWarmedUp(true);
          if (document.head.contains(style)) style.remove();
        });
      });
    }, 80);

    return () => {
      clearTimeout(timer);
      if (document.head.contains(style)) style.remove();
    };
  }, [isMobile]);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    try {
      // Try to get from cache first (prefetched in EmployerLayout)
      const cached = queryClient.getQueryData(['job-templates', user.id]) as JobTemplate[] | undefined;
      
      if (cached) {
        setTemplates(cached);
        const defaultTemplate = cached.find(t => t.is_default);
        if (defaultTemplate && !jobTitle) {
          setSelectedTemplate(defaultTemplate);
          setJobTitle(defaultTemplate.title);
        }
        setLoadingTemplates(false);
        return;
      }

      // Fallback to fetching if not in cache
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
  }, [user, jobTitle, toast, queryClient]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [user, open]);

  // Prefetch templates once on mobile to avoid first-open lag
  useEffect(() => {
    if (isMobile && user && !hasPrefetched.current) {
      hasPrefetched.current = true;
      fetchTemplates();
    }
  }, [isMobile, user, fetchTemplates]);

  // Track the initial state to detect real user changes
  const initialStateRef = useRef<{ title: string; templateId: string | null }>({ title: '', templateId: null });
  const hasSetInitialState = useRef(false);

  // Capture initial state once templates are loaded and auto-populated
  useEffect(() => {
    if (!loadingTemplates && !hasSetInitialState.current) {
      hasSetInitialState.current = true;
      initialStateRef.current = { title: jobTitle, templateId: selectedTemplate?.id ?? null };
    }
  }, [loadingTemplates, jobTitle, selectedTemplate]);

  // Reset initial state tracking when dialog opens/closes
  useEffect(() => {
    if (open) {
      hasSetInitialState.current = false;
    } else {
      setHasUnsavedChanges(false);
    }
  }, [open]);

  const handleTemplateSelect = useCallback((templateId: string, templateName: string) => {
    if (templateId === 'none') {
      setSelectedTemplate(null);
      setJobTitle('');
      setTemplateMenuOpen(false);
      setTitleInputKey((k) => k + 1);
      // Update initial state so title onChange tracks from this point
      initialStateRef.current = { title: '', templateId: null };
      setHasUnsavedChanges(false);
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
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template as any);
      setJobTitle(template.title);
      // Update initial state so title onChange tracks from this point
      initialStateRef.current = { title: template.title, templateId: template.id };
      setHasUnsavedChanges(false);
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

    setIntentionalCloseMarker(false);

    console.log('CreateJobSimpleDialog: opening MobileJobWizard', {
      jobTitle,
      selectedTemplateId: selectedTemplate?.id,
    });

    try {
      sessionStorage.setItem(CREATE_JOB_SESSION_KEY, JSON.stringify({
        jobTitle,
        savedAt: Date.now(),
      }));
    } catch {
      // ignore
    }
    
    // Kort delay för smidig övergång
    setOpen(false);
    setTimeout(() => {
      setShowDetailDialog(true);
    }, 150);
  }, [jobTitle, selectedTemplate, toast, setIntentionalCloseMarker]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
      return;
    }

    setShowUnsavedDialog(false);
    setOpen(false);
    setJobTitle('');
    setSelectedTemplate(null);
    setHasUnsavedChanges(false);
    setTemplateMenuOpen(false);
    setTitleInputKey((k) => k + 1);
    setMenuInstanceKey((k) => k + 1);
    setIntentionalCloseMarker(true);
    clearCreateAndWizardDrafts();
  }, [clearCreateAndWizardDrafts, hasUnsavedChanges, setIntentionalCloseMarker]);

  const handleConfirmClose = useCallback(() => {
    setShowUnsavedDialog(false);
    setOpen(false);
    setJobTitle('');
    setSelectedTemplate(null);
    setHasUnsavedChanges(false);
    setTemplateMenuOpen(false);
    setTitleInputKey((k) => k + 1);
    setMenuInstanceKey((k) => k + 1);
    setIntentionalCloseMarker(true);
    clearCreateAndWizardDrafts();
  }, [clearCreateAndWizardDrafts, setIntentionalCloseMarker]);

  const handleCancelClose = useCallback(() => {
    setShowUnsavedDialog(false);
  }, []);

  const handleJobCreated = useCallback((job: JobPosting) => {
    setShowDetailDialog(false);
    setJobTitle('');
    setSelectedTemplate(null);
    setIntentionalCloseMarker(false);
    clearCreateAndWizardDrafts();
    onJobCreated(job);
  }, [clearCreateAndWizardDrafts, onJobCreated, setIntentionalCloseMarker]);

  const handleWizardBack = useCallback(() => {
    isNavigatingBack.current = true;
    setShowDetailDialog(false);
    clearCreateJobSession();
    
    // Om en mall är vald, öppna dropdown igen
    // Annars stäng helt och gå till dashboard
    if (selectedTemplate) {
      requestAnimationFrame(() => {
        setOpen(true);
        setTimeout(() => setTemplateMenuOpen(true), 60);
        isNavigatingBack.current = false;
      });
    } else {
      // Ingen mall vald - stäng helt
      setJobTitle('');
      setSelectedTemplate(null);
      isNavigatingBack.current = false;
    }
  }, [clearCreateJobSession, selectedTemplate]);

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
          setIntentionalCloseMarker(true);
          clearCreateAndWizardDrafts();
        }
      }}>
        <DialogTrigger asChild>
          <Button 
            ref={triggerRef}
            variant="glass"
            className={cn(triggerClassName)}
          >
            Skapa ny annons
            <Plus size={16} />
          </Button>
        </DialogTrigger>
        <DialogContentNoFocus 
          hideClose
          forceMount
          overlayHidden={!open || !isWarmedUp}
          className={"parium-panel max-w-none w-[min(92vw,440px)] h-auto max-h-[75vh] sm:max-h-[80vh] bg-parium-gradient text-white [&>button]:hidden p-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden transform-gpu will-change-transform will-change-opacity transition-all duration-200 ease-out"}
          style={{ display: (!open || !isWarmedUp) ? 'none' : undefined }}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle className="sr-only">Skapa jobb</DialogTitle>
            <DialogDescription className="sr-only">Välj mall eller ange titel</DialogDescription>
          </DialogHeader>
          <AnimatedBackground showBubbles={false} />

          <div className="relative z-10 flex flex-col max-h-[75vh] sm:max-h-[80vh]">
            <div className="relative flex items-center justify-center p-4 border-b border-white/20 flex-shrink-0 bg-background/10">
              <h2 className="text-white text-lg font-semibold">Skapa jobb</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                className={dialogCloseButtonClassName}
              >
                <X className={dialogCloseIconClassName} />
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              <p className="text-white text-center text-sm leading-relaxed px-2">
                Namnge ett jobb eller välj en utav dina färdig mallar för att komma igång
              </p>

              <div className="space-y-2">
                <Label htmlFor="job-title" className="text-white">Titel</Label>
                <Input
                  id="job-title"
                  key={titleInputKey}
                  ref={titleRef as any}
                  value={jobTitle}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setJobTitle(newTitle);
                    // Only mark as unsaved if user changed from initial auto-populated state
                    const titleChanged = newTitle !== initialStateRef.current.title;
                    const templateChanged = (selectedTemplate?.id ?? null) !== initialStateRef.current.templateId;
                    setHasUnsavedChanges(titleChanged || templateChanged);
                  }}
                  placeholder="Namnge jobbet"
                  className="bg-white/5 border-white/20 hover:border-white/30 focus:border-white/40 text-white placeholder:text-white transition-colors duration-150 text-base h-12 !min-h-0 font-normal outline-none ring-0 focus:ring-0 focus:outline-none"
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
                  <div className="flex items-center gap-2 text-sm text-white py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laddar mallar...
                  </div>
                ) : (
                  <div className="relative w-full">
                    <DropdownMenu 
                      key={menuInstanceKey}
                      modal={false} 
                      open={templateMenuOpen} 
                      onOpenChange={(isOpen) => {
                        setTemplateMenuOpen(isOpen);
                        if (isOpen) {
                          setSearchTerm('');
                        } else {
                          resetPreview();
                        }
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onMouseDown={(e) => e.currentTarget.blur()}
                          onMouseUp={(e) => e.currentTarget.blur()}
                          className="w-full bg-white/5 border-white/20 text-white transition-colors duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white h-12 md:h-12 !min-h-0 py-2 px-3 font-normal focus:outline-none focus:ring-0 rounded-md overflow-hidden min-w-0"
                          title={selectedTemplate?.name || 'Välj mall...'}
                        >
                          <div className="flex items-center gap-2 w-full min-w-0">
                          <span className="text-base truncate font-normal text-white flex-1 min-w-0 text-left" title={selectedTemplate?.name || 'Välj mall...'}>
                              {selectedTemplate?.name || 'Välj mall...'}
                            </span>
                            <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white transition-transform duration-300 ${templateMenuOpen ? 'rotate-180' : 'rotate-0'}`} />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent 
                        key={menuInstanceKey}
                        className="w-[calc(100vw-2rem)] max-w-sm bg-slate-900/85 backdrop-blur-xl border-white/20 shadow-xl pointer-events-auto rounded-lg text-white max-h-[40vh] overflow-y-auto scrollbar-hide flex flex-col pt-0 pb-0 z-50 !animate-none"
                        style={{ 
                          WebkitOverflowScrolling: 'touch', 
                          overscrollBehaviorY: 'contain', 
                          touchAction: 'pan-y'
                        }}
                        side="top"
                        align="center"
                        alignOffset={0}
                        sideOffset={8}
                        avoidCollisions={false}
                        onWheel={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="p-3 border-b border-white/20 sticky top-0 z-20 bg-slate-900">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
                            <Input
                              placeholder="Sök mall..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                              }}
                              className="pl-10 pr-10 h-10 bg-white/5 border-white/20 text-white placeholder:text-white focus:border-white/40 rounded-lg"
                              autoComplete="off"
                            />
                            {searchTerm && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSearchTerm('');
                                }}
                                onMouseDown={(e) => e.currentTarget.blur()}
                                onMouseUp={(e) => e.currentTarget.blur()}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors md:hover:text-white md:hover:bg-white/10  focus:outline-none focus:ring-0"
                                type="button"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {searchTerm && (
                          <div className="px-4 py-2 text-sm text-white border-b border-white/20">
                            Visar <span className="text-white font-medium">{filteredTemplates.length}</span> av <span className="text-white font-medium">{templates.length}</span> mallar
                          </div>
                        )}

                        <div className="flex-1 pb-2">
                          <DropdownMenuItem
                            onSelect={() => {
                              setTemplateMenuOpen(false);
                              setOpen(false);
                              setTimeout(() => {
                                setShowTemplateWizard(true);
                              }, 150);
                            }}
                            className="px-4 py-2.5 text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer transition-colors border-b border-white/20"
                          >
                            <div className="flex flex-col min-w-0 w-full">
                              <span className="font-medium text-white">+ Skapa en ny mall</span>
                              <span className="text-sm text-white">Skapa en återanvändbar jobbmall</span>
                            </div>
                          </DropdownMenuItem>
                          
                          {filteredTemplates.map((template) => (
                            <div key={template.id} className="border-b border-white/20 last:border-b-0 relative">
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  handleTap(
                                    template.id,
                                    templateTextRefs.current[template.id] ?? null,
                                    () => handleTemplateSelect(template.id, template.name)
                                  );
                                }}
                                className="px-4 py-3 text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer transition-colors"
                              >
                                <div className="flex items-center w-full gap-3 min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <TruncatedText
                                      text={template.name}
                                      className="font-medium text-white truncate block"
                                      tooltipSide="top"
                                      alwaysShowTooltip="desktop-only"
                                    >
                                      <span
                                        ref={(el) => { templateTextRefs.current[template.id] = el; }}
                                        className="truncate block"
                                      >
                                        {template.name}
                                      </span>
                                    </TruncatedText>
                                  </div>
                                  {template.is_default && (
                                    <span className="text-xs text-white/80 shrink-0">Standard</span>
                                  )}
                                </div>
                              </DropdownMenuItem>

                              {/* Tap-to-preview tooltip for touch devices */}
                              {isPreview(template.id) && (
                                <div className="absolute left-3 right-3 top-0 -translate-y-full z-[60] px-3 py-2 rounded-lg bg-slate-900/95 border border-white/20 shadow-2xl text-sm text-white leading-relaxed whitespace-pre-wrap break-words animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-none">
                                  {template.name}
                                </div>
                              )}

                              <div className="flex justify-center gap-2 px-4 pt-1.5 pb-2.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTemplateToEdit(template);
                                    setTemplateMenuOpen(false);
                                    setOpen(false);
                                    setTimeout(() => {
                                      setShowTemplateWizard(true);
                                    }, 150);
                                  }}
                                  onMouseDown={(e) => e.currentTarget.blur()}
                                  onMouseUp={(e) => e.currentTarget.blur()}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-full border h-9 px-3 bg-white/5 backdrop-blur-[2px] border-white/20 text-white text-xs transition-colors duration-300 hover:bg-white/15 hover:border-white/50 active:scale-95 focus:outline-none focus:ring-0"
                                  aria-label={`Redigera mall ${template.name}`}
                                >
                                  <Edit size={13} />
                                  <span>Redigera</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTemplateToDelete(template);
                                  }}
                                  onMouseDown={(e) => e.currentTarget.blur()}
                                  onMouseUp={(e) => e.currentTarget.blur()}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-full border h-9 px-3 border-destructive/40 bg-destructive/20 backdrop-blur-[2px] text-white text-xs transition-colors duration-300 md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white active:scale-95 focus:outline-none focus:ring-0"
                                  aria-label={`Ta bort mall ${template.name}`}
                                >
                                  <Trash2 size={13} />
                                  <span>Ta bort</span>
                                </button>
                              </div>
                            </div>
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
                  </div>
                )}

                {/* Clear template selection */}
                {selectedTemplate && (
                  <div className="flex justify-center mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleTemplateSelect('none', '');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm text-white rounded-full bg-white/5 border border-white/20 md:hover:bg-white/15 md:hover:border-white/40 active:scale-[0.97]  transition-all duration-150"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Rensa mall</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-white/20 flex-shrink-0 bg-background/10">
              <Button 
                onMouseDown={(e) => {
                  e.currentTarget.blur();
                  const activeEl = document.activeElement as HTMLElement;
                  if (activeEl?.blur) activeEl.blur();
                }}
                onMouseUp={(e) => {
                  e.currentTarget.blur();
                }}
                onClick={handleCreateJob}
                disabled={loading || !jobTitle.trim()}
                className={`flex-1 min-h-[44px] rounded-full transition-colors duration-150 active:scale-95 ${
                  !loading && jobTitle.trim() ? 'border border-white/30' : 'border border-transparent'
                }`}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Skapa jobb
              </Button>
              <Button 
                variant="glass"
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                onClick={handleClose}
                className="min-h-[44px] rounded-full"
              >
                Avbryt
              </Button>
            </div>
          </div>
        </DialogContentNoFocus>
      </Dialog>

      <MobileJobWizard
        open={showDetailDialog}
        onOpenChange={(isOpen) => {
          setShowDetailDialog(isOpen);
          if (!isOpen && !isNavigatingBack.current) {
            setJobTitle('');
            setSelectedTemplate(null);
            clearCreateAndWizardDrafts();
            setIntentionalCloseMarker(false);
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
        onTemplateCreated={async () => {
          // Invalidate cache first to force fresh fetch
          queryClient.invalidateQueries({ queryKey: ['job-templates', user?.id] });
          // Also clear local cache to bypass early return
          queryClient.removeQueries({ queryKey: ['job-templates', user?.id] });
          await fetchTemplates();
          setTemplateToEdit(null);
          toast({
            title: templateToEdit ? "Mall uppdaterad!" : "Mall skapad!",
            description: templateToEdit ? "Din mall har uppdaterats." : "Din nya mall är nu tillgänglig."
          });
        }}
        onBack={handleTemplateWizardBack}
      />

      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort mall
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {templateToDelete && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">"{templateToDelete.name}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => {
                setTemplateToDelete(null);
                // Öppna dropdown-menyn igen efter att avbryt tryckts
                setTimeout(() => setTemplateMenuOpen(true), 100);
              }}
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
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
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        onSaveAndLeave={async () => {
          handleConfirmClose();
        }}
      />
    </>
  );
};

export default CreateJobSimpleDialog;

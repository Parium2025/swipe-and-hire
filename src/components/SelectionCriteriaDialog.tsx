import { useState, useEffect, useRef, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  AlertTriangle,
  Check,
  X,
  Loader2,
  Zap
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useEvaluateAllCandidates } from '@/hooks/useCriteriaResults';
import { checkForDiscrimination, checkDiscriminationWithAI, checkInputQuality } from '@/lib/criteriaValidation';

interface JobCriterion {
  id: string;
  job_id: string;
  employer_id: string;
  title: string;
  prompt: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

interface SelectionCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onActivate?: (criteriaCount: number) => void;
  candidates?: { applicant_id: string; application_id?: string }[];
}

export function SelectionCriteriaDialog({ 
  open, 
  onOpenChange, 
  jobId,
  onActivate,
  candidates = []
}: SelectionCriteriaDialogProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  const [criteria, setCriteria] = useState<JobCriterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const evaluateAllCandidates = useEvaluateAllCandidates();
  const queryClient = useQueryClient();
  
  // Inline editing state
  const [drafts, setDrafts] = useState<Record<string, { title: string; prompt: string }>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [hasFetched, setHasFetched] = useState(false);
  // Set when an already-activated criterion is removed — remaining candidates must
  // be re-scored so the X/Y pill and badges reflect the new criteria set.
  const needsReevalRef = useRef(false);


  useEffect(() => {
    setHasFetched(false);
  }, [jobId]);

  // When dialog closes, flush pending auto-saves and remove unsaved (empty) criteria
  useEffect(() => {
    if (open || criteria.length === 0) return;

    // Flush pending auto-save timers so nothing races the delete below
    Object.values(autoSaveTimers.current).forEach(clearTimeout);
    autoSaveTimers.current = {};

    const unsavedEmptyIds = criteria
      .filter(c => {
        const d = drafts[c.id];
        return !c.is_active && (!d?.title.trim() || !d?.prompt.trim());
      })
      .map(c => c.id);

    if (unsavedEmptyIds.length === 0) return;

    supabase.from('job_criteria').delete().in('id', unsavedEmptyIds).then(() => {
      queryClient.invalidateQueries({ queryKey: ['job-criteria', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-applications', jobId] });
    });
    setCriteria(prev => prev.filter(c => !unsavedEmptyIds.includes(c.id)));
    setDrafts(prev => {
      const next = { ...prev };
      unsavedEmptyIds.forEach(id => delete next[id]);
      return next;
    });
  }, [open, criteria, drafts, jobId, queryClient]);

  // Re-score candidates once, after the dialog closes, if an active criterion was removed
  useEffect(() => {
    if (open || !needsReevalRef.current) return;
    needsReevalRef.current = false;

    const remainingActive = criteria.filter(c => c.is_active && c.title?.trim() && c.prompt?.trim());
    if (remainingActive.length === 0 || candidates.length === 0) return;

    evaluateAllCandidates.mutate({ jobId, candidates });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);


  useEffect(() => {
    if (!jobId) return;
    if (open) {
      setValidationErrors({});
    }
    if (!hasFetched) {
      fetchCriteria().then(() => setHasFetched(true));
    }
  }, [open, jobId, hasFetched]);

  const fetchCriteria = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_criteria')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index');

      if (error) throw error;

      const rows = data || [];
      // Garbage-collect empty, never-activated rows left behind by an aborted session
      const orphanIds = rows
        .filter(c => !c.is_active && !c.title?.trim() && !c.prompt?.trim())
        .map(c => c.id);
      if (orphanIds.length > 0) {
        supabase.from('job_criteria').delete().in('id', orphanIds).then(() => {});
      }
      const loadedCriteria = rows.filter(c => !orphanIds.includes(c.id));
      setCriteria(loadedCriteria);
      
      const newDrafts: Record<string, { title: string; prompt: string }> = {};
      loadedCriteria.forEach(c => {
        newDrafts[c.id] = { title: c.title, prompt: c.prompt };
      });
      setDrafts(newDrafts);
      
      // Validate existing criteria on load
      loadedCriteria.forEach(c => {
        if (c.title.trim() || c.prompt.trim()) {
          validateInput(c.id, c.title, c.prompt);
        }
      });
    } catch (error) {
      console.error('Error fetching criteria:', error);
      toast.error('Kunde inte hämta urvalskriterier');
    } finally {
      setIsLoading(false);
    }
  };

  const DISCRIMINATION_MESSAGE =
    'Kriteriet kan uppfattas som kopplat till en skyddad diskrimineringsgrund. Formulera om det så att det beskriver ett konkret krav för tjänsten.';

  const validateInput = (id: string, title: string, prompt: string) => {
    const setError = (message: string) => {
      setValidationErrors(prev => ({ ...prev, [id]: message }));
      return false;
    };

    if (checkForDiscrimination(title).isDiscriminatory) return setError(DISCRIMINATION_MESSAGE);
    if (checkForDiscrimination(prompt).isDiscriminatory) return setError(DISCRIMINATION_MESSAGE);

    const promptQuality = checkInputQuality(prompt);
    if (!promptQuality.isValid) {
      return setError(promptQuality.reason || 'Formulera ett tydligt kriterium.');
    }

    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return true;
  };

  // Auto-save a single criterion to DB
  const autoSaveCriterion = useCallback(async (id: string, title: string, prompt: string) => {
    if (!title.trim() && !prompt.trim()) return; // Don't save completely empty
    try {
      await supabase
        .from('job_criteria')
        .update({
          title: title.trim(),
          prompt: prompt.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(autoSaveTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleDraftChange = (id: string, field: 'title' | 'prompt', value: string) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
    
    const draft = { ...drafts[id], [field]: value };
    validateInput(id, draft.title, draft.prompt);

    // Debounced auto-save (800ms)
    if (autoSaveTimers.current[id]) {
      clearTimeout(autoSaveTimers.current[id]);
    }
    autoSaveTimers.current[id] = setTimeout(() => {
      autoSaveCriterion(id, draft.title, draft.prompt);
    }, 800);
  };

  const addNewCriterion = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('job_criteria')
        .insert({
          job_id: jobId,
          employer_id: user.id,
          title: '',
          prompt: '',
          order_index: criteria.length,
          is_active: false,
        })
        .select()
        .single();

      if (error) throw error;
      
      setCriteria(prev => [...prev, data]);
      setDrafts(prev => ({
        ...prev,
        [data.id]: { title: '', prompt: '' }
      }));
    } catch (error) {
      console.error('Error adding criterion:', error);
      toast.error('Kunde inte lägga till kriterium');
    }
  };

  const deleteCriterion = async (id: string) => {
    
    try {
      const { error } = await supabase
        .from('job_criteria')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setCriteria(prev => prev.filter(c => c.id !== id));
      setDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      // Invalidate caches so counter + candidate cards update
      queryClient.invalidateQueries({ queryKey: ['job-criteria', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-applications', jobId] });
    } catch (error) {
      console.error('Error deleting criterion:', error);
      toast.error('Kunde inte ta bort kriterium');
    }
  };

  const handleSaveAndActivate = async () => {


    
    let hasErrors = false;
    const validCriteria: { id: string; title: string; prompt: string }[] = [];
    
    for (const criterion of criteria) {
      const draft = drafts[criterion.id];
      if (!draft) continue;
      
      if (!draft.title.trim() || !draft.prompt.trim()) continue;
      
      if (!validateInput(criterion.id, draft.title, draft.prompt)) {
        hasErrors = true;
      } else {
        validCriteria.push({
          id: criterion.id,
          title: draft.title.trim(),
          prompt: draft.prompt.trim(),
        });
      }
    }

    if (hasErrors) {
      toast.error('Korrigera varningsmeddelanden före du sparar');
      return;
    }

    if (validCriteria.length === 0) {
      toast.error('Lägg till minst ett kriterium');
      return;
    }

    // AI-powered discrimination check on all criteria before saving
    setIsSaving(true);
    try {
      const aiChecks = await Promise.all(
        validCriteria.map(c => checkDiscriminationWithAI(c.title, c.prompt))
      );

      let aiBlocked = false;
      aiChecks.forEach((check, i) => {
        if (check.isDiscriminatory) {
          aiBlocked = true;
          setValidationErrors(prev => ({
            ...prev,
            [validCriteria[i].id]: check.reason || DISCRIMINATION_MESSAGE,
          }));
        }
      });

      if (aiBlocked) {
        toast.error('AI flaggade ett eller flera kriterier som potentiellt diskriminerande. Granska och justera.');
        setIsSaving(false);
        return;
      }
    } catch {
      // Non-blocking: if AI check fails, allow save
      console.warn('AI discrimination pre-check failed, proceeding with save');
    }

    try {
      // Batch update all valid criteria at once
      await Promise.all(
        validCriteria.map(c =>
          supabase
            .from('job_criteria')
            .update({
              title: c.title,
              prompt: c.prompt,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', c.id)
        )
      );

      const emptyIds = criteria
        .filter(c => {
          const draft = drafts[c.id];
          return !draft?.title.trim() || !draft?.prompt.trim();
        })
        .map(c => c.id);

      if (emptyIds.length > 0) {
        await supabase
          .from('job_criteria')
          .delete()
          .in('id', emptyIds);
      }

      // Invalidate criteria cache so counter updates instantly
      await queryClient.invalidateQueries({ queryKey: ['job-criteria', jobId] });
      
      // Close dialog immediately — results appear via realtime
      onActivate?.(validCriteria.length);
      onOpenChange(false);
      
      // Start evaluation silently in background
      if (candidates.length > 0) {
        evaluateAllCandidates.mutate(
          { jobId, candidates },
          {
            onError: () => {
              toast.error('Kunde inte utvärdera kandidater', {
                description: 'Försök igen om en stund.',
              });
            },
          }
        );
      }
    } catch (error) {
      console.error('Error saving criteria:', error);
      toast.error('Kunde inte spara kriterier');
    } finally {
      setIsSaving(false);
    }
  };

  const canAddMore = criteria.length < 5;
  const hasValidCriteria = criteria.length > 0 && criteria.every(c => {
    const d = drafts[c.id];
    // Every criterion must have a title; empty criteria (no title AND no prompt) are also invalid
    return d?.title.trim();
  });

  const dialogContent = (
    <div className="h-full flex flex-col min-h-0">
      {/* Header — centered */}
      <div className="px-5 pt-5 pb-2 flex-shrink-0 text-center">
        {isMobile ? (
          <DrawerHeader className="p-0">
            <DrawerTitle className="text-white text-base tracking-tight font-medium flex items-center justify-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-white" />
              Urvalskriterier
            </DrawerTitle>
          </DrawerHeader>
        ) : (
          <DialogHeader>
            <DialogTitle className="text-white text-base tracking-tight font-medium flex items-center justify-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-white" />
              Urvalskriterier
            </DialogTitle>
          </DialogHeader>
        )}
        {criteria.length === 0 && !isLoading && (
            <div className="rounded-lg bg-white/[0.04] px-3.5 py-2.5 mt-3 mx-0 text-left">
              <p className="text-sm text-white leading-relaxed">
                Lägg till upp till fem kriterier som AI:n kontrollerar mot varje kandidats CV och svar. Formulera dem som konkreta, mätbara krav kopplade till tjänsten — t.ex. "Har B-körkort" eller "Minst 2 års erfarenhet inom lager".
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 space-y-2.5 pb-3">
          {isLoading ? (
            <div className="space-y-2.5">
              {[1, 2].map(i => (
                <div key={i} className="rounded-lg bg-white/[0.04] px-3.5 py-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20 bg-white/[0.06]" />
                    <Skeleton className="h-3.5 w-3.5 rounded bg-white/[0.06]" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-10 bg-white/[0.06]" />
                    <Skeleton className="h-9 w-full rounded-md bg-white/[0.06]" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-24 bg-white/[0.06]" />
                    <Skeleton className="h-14 w-full rounded-md bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>

              {/* Criteria cards */}
              {criteria.map((criterion, index) => (
                <div 
                  key={criterion.id}
                  className="rounded-2xl bg-white/[0.04] px-3.5 py-3 space-y-2.5 ring-1 ring-inset ring-white/[0.05]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white uppercase tracking-widest font-medium">
                      Kriterium {index + 1}
                    </span>
                    <button
                      onClick={() => deleteCriterion(criterion.id)}
                      className="rounded-full border border-red-500/40 bg-red-500/15 p-1.5 text-red-300 transition-colors md:hover:!border-red-500/60 md:hover:!bg-red-500/25 md:hover:!text-red-200 active:scale-[0.95] focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]"
                      aria-label="Ta bort kriterium"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-white uppercase tracking-wider font-medium">Titel</label>
                    <Input
                      placeholder="T.ex. Har B-körkort"
                      value={drafts[criterion.id]?.title || ''}
                      onChange={(e) => handleDraftChange(criterion.id, 'title', e.target.value)}
                      className="h-11 !min-h-0 bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/50 text-base md:text-sm focus:border-white/25 focus:ring-0 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-white uppercase tracking-wider font-medium">AI-instruktion</label>
                    <Textarea
                      placeholder="Beskriv vad AI ska leta efter i CV eller svar..."
                      value={drafts[criterion.id]?.prompt || ''}
                      onChange={(e) => handleDraftChange(criterion.id, 'prompt', e.target.value)}
                      rows={2}
                      className="resize-none bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/50 text-base md:text-sm focus:border-white/25 focus:ring-0 rounded-xl min-h-[56px]"
                    />
                  </div>


                  {validationErrors[criterion.id] && (
                    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-500/10">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-300 leading-relaxed">{validationErrors[criterion.id]}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Add button — oval Parium pill */}
              {canAddMore && (
                <button
                  onClick={addNewCriterion}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-auto mx-auto mt-1 py-2 px-5 rounded-full border border-white/20 md:hover:border-white/40
                    text-white md:hover:text-white flex items-center justify-center gap-1.5 transition-all
                    active:scale-[0.97] active:duration-75 focus:outline-none focus-visible:outline-none
                    [-webkit-tap-highlight-color:transparent]"
                >
                  <Plus className="h-4 w-4 text-white" />
                  <span className="text-sm font-medium">Lägg till kriterium</span>
                </button>
              )}


              {/* Tips box */}
              {criteria.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                  <p className="text-xs text-white mb-1.5 font-medium">Exempel på kriterier:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { good: 'Har B-körkort', bad: 'Är trevlig' },
                      { good: '2+ års erfarenhet', bad: 'Är man/kvinna' },
                      { good: 'Kan jobba helger', bad: 'Är ung' },
                    ].map(({ good, bad }) => (
                      <div key={good} className="contents">
                        <span className="inline-flex items-center gap-1 text-sm text-white bg-white/[0.05] px-2.5 py-1 rounded-full">
                          <Check className="h-3 w-3 text-green-400 shrink-0" />
                          {good}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm text-white bg-white/[0.05] px-2.5 py-1 rounded-full">
                          <X className="h-3 w-3 text-red-400 shrink-0" />
                          {bad}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — Parium solid green pill (matches Skicka ansökan) */}
        {criteria.length > 0 && (
          <div className="flex-shrink-0 px-5 py-3 border-t border-white/[0.05] flex items-center justify-center">
            <button
              onClick={handleSaveAndActivate}
              disabled={isSaving || !hasValidCriteria || Object.keys(validationErrors).length > 0}
              className="py-2.5 px-8 rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 hover:bg-green-600 transition-all active:scale-[0.97] text-sm font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sparar...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Spara & aktivera
                </>
              )}
            </button>
          </div>
        )}

    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="bg-card-parium backdrop-blur-xl border-white/[0.06] text-white max-h-[85svh] overflow-hidden flex flex-col p-0">
          {dialogContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus className="sm:max-w-sm md:max-w-md lg:max-w-lg bg-card-parium backdrop-blur-xl border-white/[0.06] text-white max-h-[85vh] overflow-hidden flex flex-col p-0">
        {dialogContent}
      </DialogContentNoFocus>
    </Dialog>
  );
}

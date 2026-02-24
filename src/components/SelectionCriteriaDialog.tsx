import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnlineStatus';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
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
  const { user } = useAuth();
  const { isOnline, showOfflineToast } = useOnline();
  const [criteria, setCriteria] = useState<JobCriterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const evaluateAllCandidates = useEvaluateAllCandidates();
  
  // Inline editing state
  const [drafts, setDrafts] = useState<Record<string, { title: string; prompt: string }>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    if (open && jobId) {
      fetchCriteria();
    }
  }, [open, jobId]);

  const fetchCriteria = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_criteria')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index');

      if (error) throw error;
      
      const loadedCriteria = data || [];
      setCriteria(loadedCriteria);
      
      const newDrafts: Record<string, { title: string; prompt: string }> = {};
      loadedCriteria.forEach(c => {
        newDrafts[c.id] = { title: c.title, prompt: c.prompt };
      });
      setDrafts(newDrafts);
    } catch (error) {
      console.error('Error fetching criteria:', error);
      toast.error('Kunde inte hämta urvalskriterier');
    } finally {
      setIsLoading(false);
    }
  };

  const validateInput = (id: string, title: string, prompt: string) => {
    // Title: only check discrimination (it's just a label, not AI input)
    const titleCheck = checkForDiscrimination(title);
    if (titleCheck.isDiscriminatory) {
      setValidationErrors(prev => ({ ...prev, [id]: titleCheck.reason! }));
      return false;
    }

    // Prompt (AI-instruktion): discrimination FIRST (catches even single offensive words)
    const promptCheck = checkForDiscrimination(prompt);
    if (promptCheck.isDiscriminatory) {
      setValidationErrors(prev => ({ ...prev, [id]: promptCheck.reason! }));
      return false;
    }
    // Then quality check
    const promptQuality = checkInputQuality(prompt);
    if (!promptQuality.isValid) {
      setValidationErrors(prev => ({ ...prev, [id]: promptQuality.reason! }));
      return false;
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
    if (!isOnline) { showOfflineToast(); return; }
    
    try {
      const { data, error } = await supabase
        .from('job_criteria')
        .insert({
          job_id: jobId,
          employer_id: user.id,
          title: '',
          prompt: '',
          order_index: criteria.length,
          is_active: true,
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
    if (!isOnline) { showOfflineToast(); return; }
    
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
    } catch (error) {
      console.error('Error deleting criterion:', error);
      toast.error('Kunde inte ta bort kriterium');
    }
  };

  const handleSaveAndActivate = async () => {
    if (!isOnline) { showOfflineToast(); return; }
    
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
            [validCriteria[i].id]: check.reason || 'AI flaggade detta som potentiellt diskriminerande.',
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

      // Close dialog immediately — results appear via realtime
      onActivate?.(validCriteria.length);
      onOpenChange(false);
      
      // Start evaluation silently in background
      if (candidates.length > 0) {
        evaluateAllCandidates.mutate({ jobId, candidates });
      }
    } catch (error) {
      console.error('Error saving criteria:', error);
      toast.error('Kunde inte spara kriterier');
    } finally {
      setIsSaving(false);
    }
  };

  const canAddMore = criteria.length < 5;
  const hasValidCriteria = criteria.some(c => {
    const d = drafts[c.id];
    return d?.title.trim() && d?.prompt.trim();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus className="sm:max-w-sm md:max-w-md lg:max-w-lg bg-card-parium backdrop-blur-xl border-white/[0.06] text-white max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header — centered */}
        <div className="px-5 pt-5 pb-2 flex-shrink-0 text-center">
          <DialogHeader>
            <DialogTitle className="text-white text-base tracking-tight font-medium flex items-center justify-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-white" />
              Urvalskriterier
            </DialogTitle>
          </DialogHeader>
          {criteria.length === 0 && !isLoading && (
            <div className="rounded-lg bg-white/[0.04] px-3.5 py-2.5 mt-3 mx-0 text-left">
              <p className="text-sm text-white leading-relaxed">
                Titeln och AI-instruktionen är otydliga och har ingen tydlig koppling till tjänstens faktiska krav. Att använda detta som urvalsgrund kan innebära en risk för indirekt diskriminering, särskilt om det påverkar kandidater utifrån skyddade diskrimineringsgrunder.
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 space-y-2.5 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
          ) : (
            <>

              {/* Criteria cards */}
              {criteria.map((criterion, index) => (
                <div 
                  key={criterion.id}
                  className="rounded-lg bg-white/[0.04] px-3.5 py-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white uppercase tracking-widest font-medium">
                      Kriterium {index + 1}
                    </span>
                    <button
                      onClick={() => deleteCriterion(criterion.id)}
                      className="p-1 rounded text-white hover:text-red-400/80 transition-colors"
                      aria-label="Ta bort"
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
                      className="h-9 bg-white/[0.05] border-white/[0.06] text-white placeholder:text-white/50 text-sm focus:border-white/15 focus:ring-0 rounded-md"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-white uppercase tracking-wider font-medium">AI-instruktion</label>
                    <Textarea
                      placeholder="Beskriv vad AI ska leta efter i CV eller svar..."
                      value={drafts[criterion.id]?.prompt || ''}
                      onChange={(e) => handleDraftChange(criterion.id, 'prompt', e.target.value)}
                      rows={2}
                      className="resize-none bg-white/[0.05] border-white/[0.06] text-white placeholder:text-white/50 text-sm focus:border-white/15 focus:ring-0 rounded-md min-h-[56px]"
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

              {/* Add button */}
              {canAddMore && (
                <button
                  onClick={addNewCriterion}
                  className="w-auto mx-auto py-2 px-6 rounded-lg border border-solid border-white/[0.15] hover:border-white/[0.30] 
                    text-white hover:text-white flex items-center justify-center gap-1.5 transition-all text-xs"
                >
                  <Plus className="h-4 w-4 text-white" />
                  <span className="text-sm">Lägg till kriterium</span>
                </button>
              )}


              {/* Tips box */}
              {criteria.length > 0 && (
                <div className="rounded-lg bg-white/[0.03] px-3.5 py-2.5">
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

        {/* Footer — only show when there are criteria */}
        {criteria.length > 0 && (
          <div className="flex-shrink-0 px-5 py-3 border-t border-white/[0.05] flex items-center justify-center">
            <button
              onClick={handleSaveAndActivate}
              disabled={isSaving || !hasValidCriteria || Object.keys(validationErrors).length > 0}
              className="py-2.5 px-6 rounded-lg border border-solid border-white/[0.15] hover:border-white/[0.30] text-sm text-white hover:text-white flex items-center gap-2 transition-all disabled:opacity-30 font-medium"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sparar...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Spara & aktivera
                </>
              )}
            </button>
          </div>
        )}
      </DialogContentNoFocus>
    </Dialog>
  );
}

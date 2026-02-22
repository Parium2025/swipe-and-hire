import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnlineStatus';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { useEvaluateAllCandidates } from '@/hooks/useCriteriaResults';

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

// Discrimination keywords to check
const DISCRIMINATION_PATTERNS = [
  { pattern: /\bålder\b|\bår gammal\b|\bunder \d+\b|\böver \d+\b|\bung\b|\bgammal\b|\bpensionär\b|\bsenior\b/i, category: 'Åldersdiskriminering' },
  { pattern: /\bkön\b|\bman\b|\bkvinna\b|\bmanlig\b|\bkvinnlig\b|\btjej\b|\bkille\b/i, category: 'Könsdiskriminering' },
  { pattern: /\betnicitet\b|\bras\b|\bhudfärg\b|\binvandrare\b|\butländsk\b/i, category: 'Etnisk diskriminering' },
  { pattern: /\breligion\b|\bmuslim\b|\bkristen\b|\bjude\b|\bhindu\b|\bbuddhist\b/i, category: 'Religiös diskriminering' },
  { pattern: /\bfunktionsnedsättning\b|\bhandikapp\b|\bfunktionshinder\b|\brullstol\b/i, category: 'Diskriminering pga funktionsnedsättning' },
  { pattern: /\bsexuell läggning\b|\bhomosexuell\b|\bheterosexuell\b|\bbisexuell\b|\bgay\b|\blesbisk\b/i, category: 'Diskriminering pga sexuell läggning' },
  { pattern: /\bgraviditet\b|\bgravid\b|\bföräldraledig\b/i, category: 'Diskriminering pga graviditet' },
];

function checkForDiscrimination(text: string): { isDiscriminatory: boolean; reason?: string } {
  for (const { pattern, category } of DISCRIMINATION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isDiscriminatory: true,
        reason: `${category} — kriterier ska baseras på kompetens.`,
      };
    }
  }
  return { isDiscriminatory: false };
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
    const titleCheck = checkForDiscrimination(title);
    const promptCheck = checkForDiscrimination(prompt);
    
    if (titleCheck.isDiscriminatory) {
      setValidationErrors(prev => ({ ...prev, [id]: titleCheck.reason! }));
      return false;
    }
    if (promptCheck.isDiscriminatory) {
      setValidationErrors(prev => ({ ...prev, [id]: promptCheck.reason! }));
      return false;
    }
    
    if (prompt.length > 0 && prompt.length < 10 && !/[aeiouåäö]/i.test(prompt)) {
      setValidationErrors(prev => ({ 
        ...prev, 
        [id]: 'Kriteriet verkar inte vara ett tydligt krav.' 
      }));
      return false;
    }
    
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return true;
  };

  const handleDraftChange = (id: string, field: 'title' | 'prompt', value: string) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
    
    const draft = { ...drafts[id], [field]: value };
    validateInput(id, draft.title, draft.prompt);
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

    setIsSaving(true);
    try {
      for (const c of validCriteria) {
        await supabase
          .from('job_criteria')
          .update({
            title: c.title,
            prompt: c.prompt,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', c.id);
      }

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

      toast.success(`${validCriteria.length} kriterier sparade`);
      
      if (candidates.length > 0) {
        toast.info('AI börjar utvärdera kandidater...');
        evaluateAllCandidates.mutate({ jobId, candidates });
      }
      
      onActivate?.(validCriteria.length);
      onOpenChange(false);
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
      <DialogContentNoFocus className="sm:max-w-lg bg-card-parium backdrop-blur-xl border-white/10 text-white max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header — clean and minimal */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2.5 text-lg tracking-tight">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/[0.08]">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              AI-urvalskriterier
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-white/50 mt-2 leading-relaxed">
            Definiera vad AI ska utvärdera hos varje kandidat. Max 5 kriterier.
          </p>
        </div>

        {/* Criteria list */}
        <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          ) : (
            <>
              {criteria.map((criterion, index) => (
                <div 
                  key={criterion.id}
                  className="rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] overflow-hidden"
                >
                  {/* Criterion header bar */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03]">
                    <span className="text-[11px] text-white/40 uppercase tracking-widest font-medium">
                      Kriterium {index + 1}
                    </span>
                    <button
                      onClick={() => deleteCriterion(criterion.id)}
                      className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      aria-label="Ta bort kriterium"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="px-4 pb-4 pt-2 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                        Titel
                      </label>
                      <Input
                        placeholder="T.ex. Har B-körkort"
                        value={drafts[criterion.id]?.title || ''}
                        onChange={(e) => handleDraftChange(criterion.id, 'title', e.target.value)}
                        className="h-9 bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/25 text-sm focus:border-white/20 focus:ring-0 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                        AI-instruktion
                      </label>
                      <Textarea
                        placeholder="Beskriv vad AI ska leta efter i CV eller svar..."
                        value={drafts[criterion.id]?.prompt || ''}
                        onChange={(e) => handleDraftChange(criterion.id, 'prompt', e.target.value)}
                        rows={2}
                        className="resize-none bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/25 text-sm focus:border-white/20 focus:ring-0 transition-colors"
                      />
                    </div>

                    {validationErrors[criterion.id] && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 ring-1 ring-inset ring-amber-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-300/90">{validationErrors[criterion.id]}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add criterion button */}
              {canAddMore && (
                <button
                  onClick={addNewCriterion}
                  className="w-full py-3 rounded-xl border border-dashed border-white/[0.12] hover:border-white/25 
                    text-white/50 hover:text-white/80 flex items-center justify-center gap-2 transition-all text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Lägg till kriterium
                </button>
              )}

              {/* Empty state */}
              {criteria.length === 0 && !isLoading && (
                <div className="text-center py-10">
                  <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-white/[0.06] mx-auto mb-3">
                    <Sparkles className="h-5 w-5 text-white/40" />
                  </div>
                  <p className="text-sm text-white/70">Inga kriterier ännu</p>
                  <p className="text-xs text-white/40 mt-1">
                    Lägg till ditt första kriterium ovan
                  </p>
                </div>
              )}

              {/* Tips — compact and subtle */}
              {criteria.length > 0 && (
                <div className="py-3 px-4 rounded-xl bg-white/[0.03]">
                  <p className="text-[11px] text-white/40 mb-1.5 font-medium">Exempel på bra kriterier:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Har B-körkort', '2+ års erfarenhet', 'Kan jobba helger'].map(tip => (
                      <span key={tip} className="inline-flex items-center gap-1 text-[11px] text-white/50 bg-white/[0.05] px-2 py-0.5 rounded-full">
                        <Check className="h-2.5 w-2.5 text-green-400/70" />
                        {tip}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/50 bg-white/[0.05] px-2 py-0.5 rounded-full">
                      <X className="h-2.5 w-2.5 text-red-400/70" />
                      Är trevlig
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — single primary action */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="text-white/50 hover:text-white hover:bg-white/[0.06] text-sm"
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSaveAndActivate}
            size="sm"
            disabled={isSaving || !hasValidCriteria || Object.keys(validationErrors).length > 0}
            className="bg-white/[0.12] hover:bg-white/[0.18] text-white border border-white/[0.1] text-sm px-5 transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 mr-2" />
                Spara & aktivera
              </>
            )}
          </Button>
        </div>
      </DialogContentNoFocus>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
  Pencil,
  Zap
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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
        reason: `${category} är inte tillåtet enligt diskrimineringslagen. Kriterier ska baseras på kompetens och kvalifikationer.`,
      };
    }
  }
  return { isDiscriminatory: false };
}

export function SelectionCriteriaDialog({ 
  open, 
  onOpenChange, 
  jobId,
  onActivate 
}: SelectionCriteriaDialogProps) {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<JobCriterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
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
      
      // Initialize drafts for all criteria
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
    
    // Check for nonsensical text (very short or gibberish)
    if (prompt.length > 0 && prompt.length < 10 && !/[aeiouåäö]/i.test(prompt)) {
      setValidationErrors(prev => ({ 
        ...prev, 
        [id]: 'Kriteriet verkar inte vara ett tydligt, meningsfullt krav.' 
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
      setEditingId(data.id);
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
    } catch (error) {
      console.error('Error deleting criterion:', error);
      toast.error('Kunde inte ta bort kriterium');
    }
  };

  const handleSaveAndActivate = async () => {
    // Validate all criteria
    let hasErrors = false;
    const validCriteria: { id: string; title: string; prompt: string }[] = [];
    
    for (const criterion of criteria) {
      const draft = drafts[criterion.id];
      if (!draft) continue;
      
      if (!draft.title.trim() || !draft.prompt.trim()) {
        // Skip empty criteria (they'll be deleted)
        continue;
      }
      
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
      // Update all valid criteria
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

      // Delete empty criteria
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

      toast.success(`${validCriteria.length} kriterier sparade och aktiverade`);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card-parium backdrop-blur-md border-white/20 text-white max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Urvalskriterier
          </DialogTitle>
          <DialogDescription className="text-white/70 text-sm leading-relaxed">
            AI bedömer om kandidaten uppfyller kraven utifrån dessa kriterier. 
            Du kan lägga till upp till 5 stycken. Kontrollera att kriterierna är tydliga 
            och varken innehåller fel eller diskriminerande krav innan du sparar.
          </DialogDescription>
        </DialogHeader>

        <div className="text-xs text-white/50 px-1">
          Ibland kan varningsmeddelanden visas för giltiga kriterier. Du kan fortfarande 
          spara kriterierna, men vi rekommenderar att du granskar varningsmeddelandet först.
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          ) : (
            <>
              {criteria.map((criterion, index) => (
                <div 
                  key={criterion.id}
                  className="space-y-3 p-4 rounded-lg bg-white/5 ring-1 ring-inset ring-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50 uppercase tracking-wider">
                      Kriterium {index + 1}
                    </span>
                    <button
                      onClick={() => deleteCriterion(criterion.id)}
                      className="p-1.5 hover:bg-white/10 rounded text-white/50 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                      Titel <span className="text-red-400">*</span>
                    </label>
                    <Input
                      placeholder="T.ex. Har körkort"
                      value={drafts[criterion.id]?.title || ''}
                      onChange={(e) => handleDraftChange(criterion.id, 'title', e.target.value)}
                      className="h-9 bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    />
                    <p className="text-[11px] text-white/50">
                      Syns bara för dig, som referens.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                      Prompt <span className="text-red-400">*</span>
                    </label>
                    <Textarea
                      placeholder="T.ex. Har körkort"
                      value={drafts[criterion.id]?.prompt || ''}
                      onChange={(e) => handleDraftChange(criterion.id, 'prompt', e.target.value)}
                      rows={2}
                      className="resize-none bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    />
                    <p className="text-[11px] text-white/50">
                      AI utgår från detta vid bedömningen av kandidaterna. 
                      Formulera dig tydligt och objektivt.
                    </p>
                  </div>

                  {validationErrors[criterion.id] && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 ring-1 ring-inset ring-amber-500/30">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300">{validationErrors[criterion.id]}</p>
                    </div>
                  )}
                </div>
              ))}

              {canAddMore && (
                <button
                  onClick={addNewCriterion}
                  className="w-full py-3 rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 
                    text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Lägg till kriterium
                </button>
              )}

              {criteria.length === 0 && (
                <div className="text-center py-8 text-white/60">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-white/30" />
                  <p className="text-sm">Inga kriterier ännu</p>
                  <p className="text-xs text-white/40 mt-1">
                    Lägg till kriterier för att AI ska utvärdera kandidater
                  </p>
                </div>
              )}

              {/* Tips section */}
              <div className="p-3 rounded-lg bg-white/5 ring-1 ring-inset ring-white/10">
                <p className="text-xs text-white/70 mb-2">
                  <strong className="text-white">Tips:</strong> Bra kriterier är specifika och mätbara:
                </p>
                <ul className="text-xs text-white/60 space-y-1">
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-green-400" />
                    "Har B-körkort"
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-green-400" />
                    "Minst 2 års erfarenhet inom lager"
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-green-400" />
                    "Kan arbeta kvällar och helger"
                  </li>
                  <li className="flex items-center gap-1.5">
                    <X className="h-3 w-3 text-red-400" />
                    "Är trevlig" (för subjektivt)
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 border-t border-white/10 pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="text-white hover:bg-white/10"
          >
            Avbryt
          </Button>
          <Button
            variant="ghost"
            onClick={fetchCriteria}
            disabled={isSaving || isLoading}
            className="text-white/70 hover:bg-white/10"
          >
            Bekräfta kriterierna
          </Button>
          <Button
            onClick={handleSaveAndActivate}
            disabled={isSaving || criteria.length === 0 || Object.keys(validationErrors).length > 0}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Spara och aktivera
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

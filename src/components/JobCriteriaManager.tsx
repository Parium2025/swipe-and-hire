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
  GripVertical, 
  AlertTriangle,
  Check,
  X,
  AlertCircle,
  Loader2,
  Pencil
} from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';

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

interface JobCriteriaManagerProps {
  jobId: string;
  onCriteriaChange?: () => void;
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

export function JobCriteriaManager({ jobId, onCriteriaChange }: JobCriteriaManagerProps) {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<JobCriterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<JobCriterion | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCriteria();
  }, [jobId]);

  const fetchCriteria = async () => {
    try {
      const { data, error } = await supabase
        .from('job_criteria')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index');

      if (error) throw error;
      setCriteria(data || []);
    } catch (error) {
      console.error('Error fetching criteria:', error);
      toast.error('Kunde inte hämta urvalskriterier');
    } finally {
      setIsLoading(false);
    }
  };

  const validateInput = (value: string) => {
    const check = checkForDiscrimination(value);
    if (check.isDiscriminatory) {
      setValidationError(check.reason || 'Diskriminerande kriterium');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    validateInput(value);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    validateInput(value);
  };

  const openNewCriterionDialog = () => {
    setEditingCriterion(null);
    setTitle('');
    setPrompt('');
    setValidationError(null);
    setIsDialogOpen(true);
  };

  const openEditCriterionDialog = (criterion: JobCriterion) => {
    setEditingCriterion(criterion);
    setTitle(criterion.title);
    setPrompt(criterion.prompt);
    setValidationError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !prompt.trim()) {
      toast.error('Fyll i både titel och prompt');
      return;
    }

    if (!validateInput(title) || !validateInput(prompt)) {
      toast.error('Kriteriet innehåller diskriminerande innehåll');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCriterion) {
        // Update existing
        const { error } = await supabase
          .from('job_criteria')
          .update({
            title: title.trim(),
            prompt: prompt.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCriterion.id);

        if (error) throw error;
        toast.success('Kriterium uppdaterat');
      } else {
        // Create new
        const { error } = await supabase
          .from('job_criteria')
          .insert({
            job_id: jobId,
            employer_id: user?.id,
            title: title.trim(),
            prompt: prompt.trim(),
            order_index: criteria.length,
          });

        if (error) throw error;
        toast.success('Kriterium tillagt');
      }

      setIsDialogOpen(false);
      fetchCriteria();
      onCriteriaChange?.();
    } catch (error) {
      console.error('Error saving criterion:', error);
      toast.error('Kunde inte spara kriterium');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (criterionId: string) => {
    try {
      const { error } = await supabase
        .from('job_criteria')
        .delete()
        .eq('id', criterionId);

      if (error) throw error;
      toast.success('Kriterium borttaget');
      fetchCriteria();
      onCriteriaChange?.();
    } catch (error) {
      console.error('Error deleting criterion:', error);
      toast.error('Kunde inte ta bort kriterium');
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <>
      {/* Simple button instead of card */}
      <Button
        variant="ghost"
        size="sm"
        onClick={openNewCriterionDialog}
        className="h-8 px-3 text-xs text-white/70 hover:text-white hover:bg-white/10 gap-2"
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI-kriterier
        {criteria.length > 0 && (
          <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full ml-1">
            {criteria.length}
          </span>
        )}
      </Button>

      {/* Dialog - matching app's glass style */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContentNoFocus className="sm:max-w-md bg-card-parium backdrop-blur-md border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCriterion ? 'Redigera kriterium' : 'Nytt urvalskriterium'}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              AI:n utvärderar kandidater baserat på detta kriterium och visar ✅, ❌ eller ⚠️.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">
                Titel <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="T.ex. Har körkort"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="h-9 bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/50">
                Visas på kandidatkortet som referens för dig.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">
                Prompt <span className="text-red-400">*</span>
              </label>
              <Textarea
                placeholder="T.ex. Kontrollera om kandidaten har B-körkort baserat på CV eller svar"
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                rows={3}
                className="resize-none bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/50">
                Vad AI:n ska leta efter. Formulera tydligt och objektivt.
              </p>
            </div>

            {validationError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{validationError}</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-white/70">
                <strong className="text-white">Tips:</strong> Bra kriterier är specifika och mätbara:
              </p>
              <ul className="text-xs text-white/60 mt-1.5 space-y-0.5">
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
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
              className="text-white hover:bg-white/10"
            >
              Avbryt
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !!validationError || !title.trim() || !prompt.trim()}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/20"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sparar...
                </>
              ) : (
                'Spara'
              )}
            </Button>
          </DialogFooter>
        </DialogContentNoFocus>
      </Dialog>
    </>
  );
}

// Component to display criterion results on candidate cards
interface CriterionResultBadgeProps {
  result: 'match' | 'no_match' | 'no_data';
  title: string;
  reasoning?: string;
}

export function CriterionResultBadge({ result, title, reasoning }: CriterionResultBadgeProps) {
  const config = {
    match: { 
      icon: Check, 
      iconColor: 'text-green-400', 
      ringColor: 'ring-green-500/50',
      bg: 'bg-green-500/10' 
    },
    no_match: { 
      icon: X, 
      iconColor: 'text-red-400', 
      ringColor: 'ring-red-500/50',
      bg: 'bg-red-500/10' 
    },
    no_data: { 
      icon: AlertCircle, 
      iconColor: 'text-yellow-400', 
      ringColor: 'ring-yellow-500/50',
      bg: 'bg-yellow-500/10' 
    },
  };
  
  const { icon: Icon, iconColor, ringColor, bg } = config[result];

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${bg}`}
      title={reasoning}
    >
      {/* Circular icon with ring - matching Tim Taylor reference */}
      <span className={`flex items-center justify-center h-3.5 w-3.5 rounded-full ring-1 ${ringColor} ${bg}`}>
        <Icon className={`h-2 w-2 ${iconColor}`} />
      </span>
      <span className="text-white/80 truncate max-w-[60px]">{title}</span>
    </div>
  );
}

// Badge showing criterion title + icon (Team Tailor style)
interface CriterionIconBadgeProps {
  result: 'match' | 'no_match' | 'no_data';
  title: string;
}

export function CriterionIconBadge({ result, title }: CriterionIconBadgeProps) {
  const config = {
    match: { 
      icon: Check, 
      iconColor: 'text-green-500',
      label: title,
    },
    no_match: { 
      icon: X, 
      iconColor: 'text-red-500',
      label: title,
    },
    no_data: { 
      icon: AlertCircle, 
      iconColor: 'text-yellow-500',
      label: `${title} (ej angivet)`,
    },
  };
  
  const { icon: Icon, iconColor, label } = config[result];

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-white/80">
      <Icon className={`h-3 w-3 ${iconColor} flex-shrink-0`} />
      <span className="truncate">{label}</span>
    </span>
  );
}

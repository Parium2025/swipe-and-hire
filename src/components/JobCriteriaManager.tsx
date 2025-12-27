import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Loader2
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
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">AI-Urvalskriterier</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {criteria.length} st
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={openNewCriterionDialog}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Lägg till
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {criteria.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <p>Inga urvalskriterier ännu.</p>
              <p className="text-xs mt-1">
                AI:n utvärderar kandidater automatiskt mot dina kriterier.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {criteria.map((criterion, index) => (
                <div
                  key={criterion.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-background/50 border border-border/30 group hover:border-border/60 transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{criterion.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {criterion.prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditCriterionDialog(criterion)}
                      className="h-6 w-6 p-0"
                    >
                      <Sparkles className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(criterion.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCriterion ? 'Redigera kriterium' : 'Nytt urvalskriterium'}
            </DialogTitle>
            <DialogDescription>
              AI:n utvärderar kandidater baserat på detta kriterium och visar ✅, ❌ eller ⚠️.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Titel <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="T.ex. Har körkort"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Visas på kandidatkortet som referens för dig.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Prompt <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="T.ex. Kontrollera om kandidaten har B-körkort baserat på CV eller svar"
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Vad AI:n ska leta efter. Formulera tydligt och objektivt.
              </p>
            </div>

            {validationError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{validationError}</p>
              </div>
            )}

            <div className="p-3 rounded-md bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground">
                <strong>Tips:</strong> Bra kriterier är specifika och mätbara:
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <li>✅ "Har B-körkort"</li>
                <li>✅ "Minst 2 års erfarenhet inom lager"</li>
                <li>✅ "Kan arbeta kvällar och helger"</li>
                <li>❌ "Är trevlig" (för subjektivt)</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Avbryt
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !!validationError || !title.trim() || !prompt.trim()}
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
        </DialogContent>
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
  const icons = {
    match: <Check className="h-3 w-3 text-green-500" />,
    no_match: <X className="h-3 w-3 text-red-500" />,
    no_data: <AlertCircle className="h-3 w-3 text-yellow-500" />,
  };

  const colors = {
    match: 'bg-green-500/10 border-green-500/30 text-green-200',
    no_match: 'bg-red-500/10 border-red-500/30 text-red-200',
    no_data: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200',
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${colors[result]}`}
      title={reasoning}
    >
      {icons[result]}
      <span className="truncate max-w-[80px]">{title}</span>
    </div>
  );
}

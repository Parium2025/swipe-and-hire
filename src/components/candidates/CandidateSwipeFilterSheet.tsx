import { useMemo, useState } from 'react';
import { Sparkles, Play } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCriteriaResultsForCandidates } from '@/hooks/useCriteriaResults';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface JobCriterion {
  id: string;
  title: string;
}

interface CandidateSwipeFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: ApplicationData[];
  criteria: JobCriterion[];
  onStart: (filtered: ApplicationData[]) => void;
}

/**
 * Väljer urvalskriterier innan swipe-läget startar. Kandidater vars
 * AI-granskning inte är klar exkluderas aldrig — de märks i stället som
 * väntande så att ingen kandidat tappas bort.
 */
export function CandidateSwipeFilterSheet({
  open,
  onOpenChange,
  candidates,
  criteria,
  onStart,
}: CandidateSwipeFilterSheetProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const pairs = useMemo(
    () => candidates.map(c => ({ applicant_id: c.applicant_id, job_id: c.job_id })),
    [candidates],
  );
  const { data: resultMap } = useCriteriaResultsForCandidates(open ? pairs : []);

  const { matching, pending } = useMemo(() => {
    if (selected.length === 0) return { matching: candidates, pending: 0 };
    let pendingCount = 0;
    const kept = candidates.filter((candidate) => {
      const entry = resultMap?.[`${candidate.job_id}-${candidate.applicant_id}`];
      if (!entry || entry.status !== 'completed') {
        pendingCount += 1;
        return true;
      }
      return selected.every(criterionId =>
        entry.results.some(r => r.criterion_id === criterionId && r.result === 'match'),
      );
    });
    return { matching: kept, pending: pendingCount };
  }, [candidates, resultMap, selected]);

  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Starta swipe-läge
          </SheetTitle>
          <SheetDescription>
            Välj vilka urvalskriterier kandidaterna ska uppfylla. Utan val visas alla kandidater.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {criteria.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Den här annonsen har inga urvalskriterier ännu. Du kan ändå swipa igenom alla kandidater.
            </p>
          )}
          {criteria.map((criterion) => (
            <label
              key={criterion.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-3 py-2"
            >
              <Checkbox
                checked={selected.includes(criterion.id)}
                onCheckedChange={() => toggle(criterion.id)}
              />
              <span className="text-sm break-words [overflow-wrap:anywhere]">{criterion.title}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-sm text-muted-foreground">
            {matching.length} av {candidates.length} kandidater matchar ditt urval.
          </p>
          {pending > 0 && (
            <p className="text-sm text-muted-foreground">
              {pending} kandidater visas med AI-granskningen väntar.
            </p>
          )}
          <Button
            className="w-full min-h-11"
            disabled={matching.length === 0}
            onClick={() => {
              onOpenChange(false);
              onStart(matching);
            }}
          >
            <Play className="h-4 w-4" />
            <span>Starta swipe</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CandidateSwipeFilterSheet;

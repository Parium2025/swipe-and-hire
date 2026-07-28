import { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Search, RotateCcw, ArrowRight } from 'lucide-react';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';

interface NoResultsRescueProps {
  query: string;
  onSuggestionClick: (term: string) => void;
  onClearAll: () => void;
}

const norm = (s: string) =>
  s.toLocaleLowerCase('sv').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Enkel Levenshtein-distans (0 = identisk). */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

const NoResultsRescue = memo(function NoResultsRescue({ query, onSuggestionClick, onClearAll }: NoResultsRescueProps) {
  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    const pool = new Set<string>();
    for (const cat of OCCUPATION_CATEGORIES) {
      for (const sub of cat.subcategories || []) pool.add(sub);
    }
    const scored = Array.from(pool).map((s) => {
      const ns = norm(s);
      // Bäst score = närmaste ord i suben
      const words = ns.split(/\s+/);
      const best = Math.min(distance(q, ns), ...words.map((w) => distance(q, w)));
      return { s, score: best };
    }).sort((a, b) => a.score - b.score).slice(0, 5);
    // Filtrera bort orimliga träffar
    const maxAllowed = Math.max(3, Math.floor(q.length * 0.6));
    return scored.filter((x) => x.score <= maxAllowed).map((x) => x.s);
  }, [query]);

  return (
    <Card className="bg-white/5 border-white/15">
      <CardContent className="p-6 md:p-8 flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
          <Search className="h-6 w-6 text-white" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">Inga jobb stämde med din sökning</h3>
          <p className="text-sm text-white/70 max-w-md">
            {query ? <>Vi hittade inga jobb för <span className="text-white font-medium">"{query}"</span>. Prova något av förslagen nedan eller rensa filtren.</> : 'Prova att justera dina filter för att hitta fler jobb.'}
          </p>
        </div>

        {suggestions.length > 0 && (
          <div className="w-full max-w-md space-y-2 pt-2">
            <p className="text-[11px] uppercase tracking-wider text-white/50">Menade du</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSuggestionClick(s)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/10 border border-white/15 text-sm text-white hover:bg-white/15 active:scale-[0.97] transition-all"
                >
                  {s}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClearAll}
          className="mt-2 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white/10 border border-white/20 text-sm text-white hover:bg-white/15 active:scale-[0.97] transition-all"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Rensa alla filter
        </button>
      </CardContent>
    </Card>
  );
});

export default NoResultsRescue;

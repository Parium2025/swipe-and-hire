import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, Briefcase, Building2, Sparkles, Clock, TrendingUp } from 'lucide-react';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { getAllCities } from '@/lib/swedishCities';
import { useRecentSearches } from '@/lib/recentSearches';
import type { SearchJob } from '@/hooks/useOptimizedJobSearch';
import { cn } from '@/lib/utils';

type SuggestionKind = 'yrke' | 'stad' | 'företag' | 'titel' | 'recent' | 'trending';

interface Suggestion {
  key: string;
  label: string;
  kind: SuggestionKind;
  sublabel?: string;
  count?: number;
}

interface SmartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  jobs: SearchJob[];
  placeholder?: string;
}

const norm = (s: string) =>
  s.toLocaleLowerCase('sv').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const iconFor = (kind: SuggestionKind) => {
  switch (kind) {
    case 'yrke': return Briefcase;
    case 'stad': return MapPin;
    case 'företag': return Building2;
    case 'titel': return Sparkles;
    case 'recent': return Clock;
    case 'trending': return TrendingUp;
  }
};

const labelFor = (kind: SuggestionKind): string => {
  switch (kind) {
    case 'yrke': return 'Yrke';
    case 'stad': return 'Plats';
    case 'företag': return 'Företag';
    case 'titel': return 'Titel';
    case 'recent': return 'Senast';
    case 'trending': return 'Populärt';
  }
};

const SmartSearchInput = memo(function SmartSearchInput({
  value,
  onChange,
  jobs,
  placeholder = 'Sök yrke, företag eller plats…',
}: SmartSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { items: recent, push: pushRecent, clear: clearRecent } = useRecentSearches('parium-search-recent-v1');

  // Precompute suggestion pools
  const allSubcategories = useMemo(() => {
    const set = new Set<string>();
    for (const cat of OCCUPATION_CATEGORIES) {
      for (const sub of cat.subcategories || []) set.add(sub);
    }
    return Array.from(set);
  }, []);

  const allCities = useMemo(() => getAllCities(), []);

  const { uniqueTitles, uniqueCompanies, topCities, topCategories } = useMemo(() => {
    const titles = new Map<string, number>();
    const companies = new Map<string, number>();
    const cities = new Map<string, number>();
    const cats = new Map<string, number>();
    for (const j of jobs || []) {
      if (j.title) titles.set(j.title, (titles.get(j.title) || 0) + 1);
      if (j.workplace_name) companies.set(j.workplace_name, (companies.get(j.workplace_name) || 0) + 1);
      const city = j.workplace_city || j.workplace_municipality;
      if (city) cities.set(city, (cities.get(city) || 0) + 1);
      if (j.category) cats.set(j.category, (cats.get(j.category) || 0) + 1);
    }
    const topBy = (m: Map<string, number>, n: number) =>
      Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
    return {
      uniqueTitles: Array.from(titles.entries()),
      uniqueCompanies: Array.from(companies.entries()),
      topCities: topBy(cities, 4),
      topCategories: topBy(cats, 4),
    };
  }, [jobs]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = norm(value.trim());

    // Empty state: recent + trending
    if (!q) {
      const out: Suggestion[] = [];
      for (const r of recent.slice(0, 4)) {
        out.push({ key: `r:${r}`, label: r, kind: 'recent' });
      }
      for (const [cat, count] of topCategories) {
        const label = OCCUPATION_CATEGORIES.find((c) => c.value === cat)?.label || cat;
        out.push({ key: `tc:${cat}`, label, kind: 'trending', sublabel: 'Yrkesområde', count });
      }
      for (const [city, count] of topCities) {
        out.push({ key: `tci:${city}`, label: city, kind: 'trending', sublabel: 'Plats', count });
      }
      return out.slice(0, 8);
    }

    // Live matching
    const results: Suggestion[] = [];
    const seen = new Set<string>();
    const add = (s: Suggestion) => {
      const k = `${s.kind}:${norm(s.label)}`;
      if (seen.has(k)) return;
      seen.add(k);
      results.push(s);
    };

    const matches = (needle: string) => norm(needle).includes(q);
    const startsWith = (needle: string) => norm(needle).startsWith(q);

    // Titles from actual jobs (highest signal)
    const titleMatches = uniqueTitles
      .filter(([t]) => matches(t))
      .sort((a, b) => {
        const as = startsWith(a[0]) ? 0 : 1;
        const bs = startsWith(b[0]) ? 0 : 1;
        if (as !== bs) return as - bs;
        return b[1] - a[1];
      })
      .slice(0, 4);
    for (const [t, count] of titleMatches) add({ key: `t:${t}`, label: t, kind: 'titel', count });

    // Occupations (subcategories) — with live count in jobs
    const subMatches = allSubcategories.filter((s) => matches(s)).slice(0, 20);
    const subScored = subMatches.map((s) => {
      const ns = norm(s);
      let count = 0;
      for (const j of jobs || []) {
        const hay = norm(`${j.title || ''} ${j.occupation || ''}`);
        if (hay.includes(ns)) count++;
      }
      return { s, count, starts: startsWith(s) };
    }).sort((a, b) => {
      if (a.starts !== b.starts) return a.starts ? -1 : 1;
      return b.count - a.count;
    }).slice(0, 4);
    for (const { s, count } of subScored) add({ key: `y:${s}`, label: s, kind: 'yrke', count: count || undefined });

    // Cities
    const cityMatches = allCities.filter((c) => matches(c)).sort((a, b) => {
      const as = startsWith(a) ? 0 : 1;
      const bs = startsWith(b) ? 0 : 1;
      return as - bs;
    }).slice(0, 3);
    for (const c of cityMatches) {
      const ns = norm(c);
      let count = 0;
      for (const j of jobs || []) {
        const hay = norm(`${j.workplace_city || ''} ${j.workplace_municipality || ''} ${j.workplace_county || ''} ${j.location || ''}`);
        if (hay.includes(ns)) count++;
      }
      add({ key: `c:${c}`, label: c, kind: 'stad', count: count || undefined });
    }

    // Companies
    const companyMatches = uniqueCompanies
      .filter(([c]) => matches(c))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    for (const [c, count] of companyMatches) add({ key: `co:${c}`, label: c, kind: 'företag', count });

    return results.slice(0, 8);
  }, [value, recent, topCategories, topCities, uniqueTitles, allSubcategories, allCities, uniqueCompanies, jobs]);

  // Click-outside
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => setActive(-1), [value, open]);

  const commit = useCallback((s: Suggestion) => {
    onChange(s.label);
    pushRecent(s.label);
    setOpen(false);
    inputRef.current?.blur();
  }, [onChange, pushRecent]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter' && value.trim()) pushRecent(value.trim());
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (active >= 0 && active < suggestions.length) {
        e.preventDefault();
        commit(suggestions[active]);
      } else if (value.trim()) {
        pushRecent(value.trim());
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="smart-search-listbox"
          className="w-full h-12 pl-10 pr-10 rounded-md text-base bg-white/5 border border-white/10 hover:border-white/50 text-white placeholder:text-white/60 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-white/25 transition-colors"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(''); inputRef.current?.focus(); setOpen(true); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 rounded-full p-1 transition-colors"
            aria-label="Rensa sökning"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          id="smart-search-listbox"
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-2 rounded-xl overflow-hidden bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          {!value.trim() && recent.length > 0 && (
            <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-white/50">
              <span>Snabbval</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearRecent}
                className="text-white/60 hover:text-white transition-colors normal-case tracking-normal text-[11px]"
              >
                Rensa historik
              </button>
            </div>
          )}
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {suggestions.map((s, i) => {
              const Icon = iconFor(s.kind);
              const isActive = i === active;
              return (
                <li key={s.key} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); commit(s); }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      isActive ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0',
                      s.kind === 'recent' || s.kind === 'trending' ? 'bg-white/10' : 'bg-primary/15'
                    )}>
                      <Icon className="h-4 w-4 text-white" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] text-white truncate leading-tight">{s.label}</span>
                      <span className="block text-[11px] text-white/55 truncate leading-tight mt-0.5">
                        {s.sublabel || labelFor(s.kind)}
                      </span>
                    </span>
                    {typeof s.count === 'number' && s.count > 0 && (
                      <span className="text-[11px] text-white/70 tabular-nums flex-shrink-0 px-2 py-0.5 rounded-full bg-white/10">
                        {s.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
});

export default SmartSearchInput;

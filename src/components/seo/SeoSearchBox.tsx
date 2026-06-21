import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, TrendingUp, X, ArrowRight } from 'lucide-react';
import { useRecentSearches } from '@/lib/recentSearches';

export type SeoSuggestion = {
  /** Visad text */
  label: string;
  /** Underrubrik (t.ex. kategori eller län) */
  sub?: string;
  /** Navigeringsmål vid klick */
  to: string;
  /** Råterm som ska sparas i "senast sökta" (defaultar till label) */
  term?: string;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** Topp N förslag baserat på nuvarande query */
  suggestions: SeoSuggestion[];
  /** Statiska populära termer som visas när rutan är tom */
  popular: string[];
  /** Unik nyckel för localStorage (t.ex. "parium:recent-yrken") */
  storageKey: string;
};

/**
 * Premium-sökruta för SEO-hubbar. Visar dropdown med:
 *   – Live-förslag medan användaren skriver (klick = navigera direkt)
 *   – Senast sökta (per enhet, localStorage) när rutan är tom
 *   – Populära sökningar (statiska) när rutan är tom
 *
 * Tangentbord: ↑/↓ för att navigera, Enter för att välja, Esc för att stänga.
 * Ingen databas, ingen telemetri – allt lokalt. 16px font för att undvika
 * iOS-zoom. Touch target ≥ 44px på alla rader.
 */
export default function SeoSearchBox({
  value,
  onChange,
  placeholder,
  ariaLabel,
  suggestions,
  popular,
  storageKey,
}: Props) {
  const navigate = useNavigate();
  const { items: recent, push: pushRecent, clear: clearRecent } = useRecentSearches(storageKey);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stäng vid klick utanför
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const hasQuery = value.trim().length > 0;
  const visibleSuggestions = hasQuery ? suggestions.slice(0, 8) : [];

  const selectSuggestion = (s: SeoSuggestion) => {
    pushRecent(s.term ?? s.label);
    setOpen(false);
    navigate(s.to);
  };

  const selectTerm = (term: string) => {
    onChange(term);
    pushRecent(term);
    setActiveIdx(-1);
    // Behåll dropdown öppen så användaren ser nya förslag direkt
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
      return;
    }
    if (!hasQuery) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, visibleSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      const s = visibleSuggestions[activeIdx] ?? visibleSuggestions[0];
      if (s) {
        e.preventDefault();
        selectSuggestion(s);
      } else if (value.trim()) {
        pushRecent(value.trim());
      }
    }
  };

  const onBlur = () => {
    // Spara senast skrivna term om den var meningsfull
    if (value.trim().length >= 2) pushRecent(value.trim());
  };

  const showEmptyState = !hasQuery && (recent.length > 0 || popular.length > 0);

  return (
    <div ref={wrapperRef} className="relative mx-auto max-w-xl">
      <label className="relative block">
        <span className="sr-only">{ariaLabel}</span>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full min-h-11 rounded-full border border-white/15 bg-white/[0.07] pl-11 pr-10 text-base text-white placeholder:text-white/50 outline-none focus:border-white/30 focus:bg-white/[0.10] [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
          style={{ fontSize: '16px' }}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="seo-search-listbox"
        />

        {value && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onChange('');
              setActiveIdx(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label="Rensa sökning"
          >
            <X className="h-4 w-4" />
          </button>
        )}

      </label>

      {open && (hasQuery ? visibleSuggestions.length > 0 : showEmptyState) && (
        <div
          id="seo-search-listbox"
          role="listbox"
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/15 bg-[hsl(215_60%_10%)]/95 backdrop-blur-xl shadow-2xl"
        >
          {hasQuery ? (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {visibleSuggestions.map((s, i) => (
                <li key={`${s.to}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIdx}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(s);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-left text-white transition-colors ${
                      i === activeIdx ? 'bg-white/10' : 'hover:bg-white/[0.07]'
                    }`}
                  >
                    <Search className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{s.label}</span>
                      {s.sub && (
                        <span className="block truncate text-xs text-white">{s.sub}</span>
                      )}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />

                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-2">
              {recent.length > 0 && (
                <div className="pb-2">
                  <div className="flex items-center justify-between px-4 pt-1 pb-2">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white">
                      <Clock className="h-3 w-3" aria-hidden="true" /> Senast sökta
                    </div>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        clearRecent();
                      }}
                      className="text-[11px] text-white hover:text-white"
                    >
                      Rensa
                    </button>
                  </div>

                  <ul>
                    {recent.map((term) => (
                      <li key={`r-${term}`}>
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            selectTerm(term);
                          }}
                          className="flex w-full min-h-11 items-center gap-3 px-4 py-2 text-left text-sm text-white hover:bg-white/[0.07]"
                        >
                          <Clock className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                          <span className="truncate">{term}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {popular.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center gap-2 px-4 pt-1 pb-2 text-[11px] uppercase tracking-wider text-white">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" /> Populära sökningar
                  </div>
                  <div className="flex flex-wrap gap-2 px-3 pb-3">
                    {popular.map((term) => (
                      <button
                        key={`p-${term}`}
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          selectTerm(term);
                        }}
                        className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-sm text-white hover:bg-white/[0.12] hover:border-white/25 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

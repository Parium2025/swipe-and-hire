import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequiredMark } from '@/components/wizard/RequiredMark';

interface AuthSelectFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  maxLength?: number;
}

/**
 * Väljare med exakt samma interaktionsmodell som tunnelns födelsedatumfält:
 * readOnly-input + egen dropdown. Ingen Radix = ingen fokusram/blixt när man
 * klickar utanför.
 */
const AuthSelectField = ({
  id,
  label,
  placeholder,
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder = 'Sök...',
  allowCustom = false,
  maxLength,
}: AuthSelectFieldProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const filtered =
    searchable && search.trim().length >= 2
      ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
      : options;
  const hasCustomOption =
    allowCustom && search.trim().length >= 2 && filtered.length === 0;
  const activeDescendantId = filtered[activeIndex]
    ? `${id}-option-${activeIndex}`
    : hasCustomOption
      ? `${id}-custom-option`
      : undefined;

  const select = (next: string) => {
    onChange(next);
    setSearch('');
    setOpen(false);
  };

  const openWithSelection = () => {
    const selectedIndex = filtered.indexOf(value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setSearch('');
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openWithSelection();
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        if (filtered.length === 0) return 0;
        return (current + direction + filtered.length) % filtered.length;
      });
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      if (!open || filtered.length === 0) return;
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : filtered.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openWithSelection();
        return;
      }
      const activeOption = filtered[activeIndex];
      if (activeOption) select(activeOption);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setSearch('');
      return;
    }

    if (event.key === 'Enter' && filtered.length === 0 && allowCustom && search.trim().length >= 2) {
      event.preventDefault();
      select(search.trim());
      return;
    }

    if (
      event.key === 'Enter' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Home' ||
      event.key === 'End'
    ) {
      handleKeyDown(event);
    }
  };

  return (
    <div>
      <Label htmlFor={id} className="text-white">
        {label}
        <RequiredMark filled={!!value} />
      </Label>
      <div className="relative mt-1" ref={containerRef}>
        <Input
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open ? activeDescendantId : undefined}
          value={value}
          onChange={() => {}}
          onClick={() => {
            if (open) {
              setOpen(false);
              setSearch('');
            } else {
              openWithSelection();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly
          className={`bg-white/10 border-white/20 text-white placeholder:text-white h-11 !min-h-0 text-sm pr-10 cursor-pointer ${open ? 'border-white/50' : ''}`}
        />
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
        />

        {open && (
          <div
            className="absolute top-full left-0 right-0 z-[9999] glass-dropdown overflow-hidden isolate"
          >
            {/* Opak botten: i jobbwizarden ligger menyn ovanpå ett solitt ark,
                här ligger den direkt på sidan – utan detta lager lyser fälten
                bakom igenom. */}
            <div className="absolute inset-0 -z-10 bg-[hsl(215_50%_11%)]" aria-hidden />
            {searchable && (
              <div className="relative border-b border-white/10">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
                <input
                  role="searchbox"
                  aria-label={searchPlaceholder}
                  aria-controls={listboxId}
                  aria-activedescendant={activeDescendantId}
                  placeholder={searchPlaceholder}
                  maxLength={maxLength}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full bg-transparent pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white outline-none border-0"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            )}

            <div
              id={listboxId}
              role="listbox"
              aria-label={label}
              className="max-h-72 overflow-y-auto overscroll-contain"
            >
              {filtered.map((option, index) => (
                <button
                  key={option}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={value === option}
                  tabIndex={-1}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(option)}
                  className={`w-full px-3 py-2.5 text-left text-white text-sm border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/20 flex items-center justify-between ${activeIndex === index ? 'bg-white/10' : ''}`}
                >
                  <span className="font-medium flex-1 pr-2">{option}</span>
                  {value === option && <Check className="h-4 w-4 text-green-400 flex-shrink-0" />}
                </button>
              ))}

              {hasCustomOption && (
                <button
                  type="button"
                  id={`${id}-custom-option`}
                  role="option"
                  aria-selected={value === search.trim()}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(search.trim())}
                  className="w-full px-3 py-2.5 text-left text-white text-sm border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/20"
                >
                  Använd "{search.trim()}"
                </button>
              )}

              {!allowCustom && filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-white text-sm">Inga resultat hittades</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthSelectField;

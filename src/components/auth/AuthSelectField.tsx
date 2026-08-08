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
}: AuthSelectFieldProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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

  const select = (next: string) => {
    onChange(next);
    setSearch('');
    setOpen(false);
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
          value={value}
          onChange={() => {}}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((prev) => !prev)}
          placeholder={placeholder}
          readOnly
          className={`bg-white/10 border-white/20 text-white placeholder:text-white h-11 !min-h-0 text-sm pr-10 cursor-pointer ${open ? 'border-white/50' : ''}`}
        />
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
        />

        {open && (
          <div className="absolute top-full left-0 right-0 z-[9999] glass-dropdown overflow-hidden">
            {searchable && (
              <div className="relative border-b border-white/10">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
                <input
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white outline-none border-0"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            )}

            <div className="max-h-72 overflow-y-auto overscroll-contain">
              {filtered.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(option)}
                  className="w-full px-3 py-2.5 text-left text-white text-sm border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/20 flex items-center justify-between"
                >
                  <span className="font-medium flex-1 pr-2">{option}</span>
                  {value === option && <Check className="h-4 w-4 text-green-400 flex-shrink-0" />}
                </button>
              ))}

              {allowCustom && search.trim().length >= 2 && filtered.length === 0 && (
                <button
                  type="button"
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

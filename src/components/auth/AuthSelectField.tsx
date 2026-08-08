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
          className={`bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white pr-10 cursor-pointer md:hover:bg-white/10 md:hover:border-white/50 ${open ? 'border-white/50' : ''}`}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white opacity-50" />

        {open && (
          <div className="absolute top-full left-0 z-[9999] mt-2 w-full glass-panel rounded-md text-white overflow-hidden">
            {searchable && (
              <div className="p-3 border-b border-white/20">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
                  <Input
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-4 h-10 text-base bg-transparent border-white/20 text-white placeholder:text-white focus:border-white/40 rounded-lg"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
              </div>
            )}

            <div className="overflow-y-auto max-h-72 overscroll-contain">
              {filtered.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(option)}
                  className="w-full cursor-pointer hover:bg-white/20 py-2 px-3 text-white flex items-center justify-between transition-colors touch-manipulation text-left"
                >
                  <span className="flex-1 pr-2">{option}</span>
                  {value === option && <Check className="h-4 w-4 text-green-400 flex-shrink-0" />}
                </button>
              ))}

              {allowCustom && search.trim().length >= 2 && filtered.length === 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(search.trim())}
                  className="w-full cursor-pointer hover:bg-white/20 py-2 px-3 text-white border-t border-white/20 transition-colors text-left"
                >
                  Använd "{search.trim()}"
                </button>
              )}

              {!allowCustom && filtered.length === 0 && (
                <div className="py-4 px-3 text-center text-white">Inga resultat hittades</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthSelectField;

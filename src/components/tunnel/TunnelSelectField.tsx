import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequiredMark } from '@/components/wizard/RequiredMark';

export interface TunnelSelectOption {
  value: string;
  label: string;
}

interface TunnelSelectFieldProps {
  id?: string;
  label: string;
  placeholder: string;
  value: string;
  options: TunnelSelectOption[];
  onChange: (value: string) => void;
}

/**
 * Samma struktur som fälten i jobbwizarden: readOnly-input + egen dropdown.
 * Ingen Radix-fokushantering = ingen "blixt" när man stänger/klickar utanför.
 */
const TunnelSelectField = ({ id, label, placeholder, value, options, onChange }: TunnelSelectFieldProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const selectedLabel = options.find((option) => option.value === value)?.label || '';

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-white font-medium text-sm">
        {label}
        <RequiredMark filled={!!value} />
      </Label>
      <div className="relative" ref={containerRef}>
        <Input
          id={id}
          value={selectedLabel}
          onChange={() => {}}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((prev) => !prev)}
          placeholder={placeholder}
          className={`bg-white/10 border-white/20 text-white placeholder:text-white h-11 !min-h-0 text-sm pr-10 cursor-pointer ${open ? 'border-white/50' : ''}`}
          readOnly
        />
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
        />

        {open && (
          <div className="absolute top-full left-0 right-0 glass-dropdown max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left text-white text-sm border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/20"
              >
                <div className="font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TunnelSelectField;

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { RequiredMark } from '@/components/wizard/RequiredMark';

interface TunnelBirthDateFieldProps {
  id?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Födelsedatum med exakt samma interaktionsmodell som jobbwizardens fält:
 * readOnly-input + egen dropdown. Ingen Radix-popover = ingen fokusblixt när
 * man klickar utanför.
 */
const TunnelBirthDateField = ({
  id = 'birthDate',
  label,
  placeholder = 'Välj födelsedatum',
  value,
  onChange,
}: TunnelBirthDateFieldProps) => {
  const [open, setOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value) : undefined;
  const [viewMonth, setViewMonth] = useState<Date>(selectedDate ?? new Date());

  useEffect(() => {
    if (value) setViewMonth(new Date(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setYearOpen(false);
        setMonthOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i),
    [currentYear],
  );
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const name = format(new Date(2000, i, 1), 'MMMM', { locale: sv });
        return { value: i, label: name.charAt(0).toUpperCase() + name.slice(1) };
      }),
    [],
  );

  const commit = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-white font-medium text-sm">
        {label}
        <RequiredMark filled={!!value} />
      </Label>
      <div className="relative" ref={containerRef}>
        <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white z-10" />
        <Input
          id={id}
          value={value ? format(new Date(value), 'yyyy-MM-dd') : ''}
          onChange={() => {}}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((prev) => !prev)}
          placeholder={placeholder}
          readOnly
          className={`bg-white/10 border-white/20 text-white placeholder:text-white h-11 !min-h-0 text-sm pl-10 cursor-pointer ${open ? 'border-white/50' : ''}`}
        />

        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full max-w-[320px] glass-dropdown p-3 space-y-3">
            <div className="flex gap-2">
              {/* År */}
              <div className="relative flex-1">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setYearOpen((p) => !p);
                    setMonthOpen(false);
                  }}
                  className="w-full h-9 px-3 flex items-center justify-between rounded-md bg-white/5 border border-white/10 text-white text-sm transition-colors hover:bg-white/10"
                >
                  <span>{selectedDate ? selectedDate.getFullYear() : 'År'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
                </button>
                {yearOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 glass-dropdown max-h-52 overflow-y-auto">
                    {years.map((year) => (
                      <button
                        key={year}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const base = selectedDate ?? new Date();
                          const next = new Date(year, base.getMonth(), base.getDate());
                          setViewMonth(next);
                          commit(next);
                          setYearOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-white text-sm border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/20"
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Månad */}
              <div className="relative flex-1">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMonthOpen((p) => !p);
                    setYearOpen(false);
                  }}
                  className="w-full h-9 px-3 flex items-center justify-between rounded-md bg-white/5 border border-white/10 text-white text-sm transition-colors hover:bg-white/10"
                >
                  <span>{selectedDate ? months[selectedDate.getMonth()].label : 'Månad'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${monthOpen ? 'rotate-180' : ''}`} />
                </button>
                {monthOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 glass-dropdown max-h-52 overflow-y-auto">
                    {months.map((month) => (
                      <button
                        key={month.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const base = selectedDate ?? new Date();
                          const next = new Date(base.getFullYear(), month.value, base.getDate());
                          setViewMonth(next);
                          commit(next);
                          setMonthOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-white text-sm border-b border-white/10 last:border-b-0 transition-colors hover:bg-white/20"
                      >
                        {month.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div onMouseDown={(e) => e.preventDefault()}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (!date) return;
                  commit(date);
                  setOpen(false);
                }}
                disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                month={viewMonth}
                onMonthChange={setViewMonth}
                className="p-0 pointer-events-auto text-white"
                classNames={{
                  day: 'h-9 w-9 p-0 font-normal text-white hover:bg-white/20',
                  day_selected:
                    '!bg-transparent !border !border-white !outline-none !shadow-none !text-white font-semibold hover:!bg-white/10',
                  day_today: 'bg-transparent text-white font-normal',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TunnelBirthDateField;

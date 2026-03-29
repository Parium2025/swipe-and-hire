import { useRef, useCallback } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownOption } from '@/types/jobWizard';
import { useTapToPreview } from '@/hooks/useTapToPreview';

interface DropdownFieldProps {
  label: string;
  required?: boolean;
  value: string;
  displayValue: string;
  placeholder: string;
  options: DropdownOption[];
  isOpen: boolean;
  searchTerm: string;
  onToggle: () => void;
  onSelect: (value: string) => void;
  onSearchChange: (term: string) => void;
  onClear?: () => void;
  showSearch?: boolean;
  className?: string;
}

export const DropdownField = ({
  label,
  required = false,
  value,
  displayValue,
  placeholder,
  options,
  isOpen,
  searchTerm,
  onToggle,
  onSelect,
  onSearchChange,
  onClear,
  showSearch = true,
  className = '',
}: DropdownFieldProps) => {
  const { handleTap, isPreview, resetPreview } = useTapToPreview();
  const textRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const filteredOptions = searchTerm
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleToggle = useCallback(() => {
    if (isOpen) resetPreview();
    onToggle();
  }, [isOpen, onToggle, resetPreview]);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-white text-sm font-medium">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          className="w-full h-11 px-3 py-2 bg-white/5 border border-white/20 rounded-md text-left flex items-center justify-between text-white text-sm transition-all duration-300 md:hover:bg-white/15 md:hover:border-white/30"
        >
          <span className="text-white">
            {displayValue || placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && onClear && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="flex h-7 w-7 !min-h-0 !min-w-0 items-center justify-center overflow-hidden rounded-full bg-white/10 transition-colors md:hover:bg-white/20"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full glass-panel rounded-md max-h-60 overflow-hidden">
            {showSearch && (
              <div className="p-2 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Sök..."
                    className="pl-7 h-8 bg-white/10 border-white/20 text-white text-sm placeholder:text-white"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
            <div className="max-h-48 overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div key={option.value} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        handleTap(
                          option.value,
                          textRefs.current[option.value] ?? null,
                          () => onSelect(option.value)
                        );
                      }}
                      className={`w-full px-3 py-2.5 text-left text-sm transition-all duration-300 hover:bg-white/20 ${
                        value === option.value 
                          ? 'bg-white/10 text-white' 
                          : 'text-white'
                      }`}
                    >
                      <span
                        ref={(el) => { textRefs.current[option.value] = el; }}
                        className="block truncate"
                      >
                        {option.label}
                      </span>
                    </button>

                    {/* Tap-to-preview tooltip */}
                    {isPreview(option.value) && (
                      <div className="absolute left-2 right-2 -top-1 -translate-y-full z-[60] px-3 py-2 rounded-lg bg-slate-900/95 border border-white/20 shadow-2xl text-sm text-white leading-relaxed whitespace-pre-wrap break-words animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-none">
                        {option.label}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-white text-sm">
                  Inga resultat
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DropdownField;

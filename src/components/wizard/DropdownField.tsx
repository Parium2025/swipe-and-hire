import { ChevronDown, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownOption } from '@/types/jobWizard';

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
  const filteredOptions = searchTerm
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-white text-sm font-medium">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
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
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md shadow-lg max-h-60 overflow-hidden">
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
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSelect(option.value)}
                    className={`w-full px-3 py-2 text-left text-sm transition-all duration-300 hover:bg-white/20 ${
                      value === option.value 
                        ? 'bg-white/10 text-white' 
                        : 'text-white'
                    }`}
                  >
                    {option.label}
                  </button>
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

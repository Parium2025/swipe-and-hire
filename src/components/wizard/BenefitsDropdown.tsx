import { useState } from 'react';
import { ChevronDown, X, Heart, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BENEFITS_OPTIONS, getBenefitLabel } from '@/types/jobWizard';

interface BenefitsDropdownProps {
  selectedBenefits: string[];
  onChange: (benefits: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const BenefitsDropdown = ({
  selectedBenefits,
  onChange,
  isOpen,
  onToggle,
}: BenefitsDropdownProps) => {
  const [customBenefitInput, setCustomBenefitInput] = useState('');

  const toggleBenefit = (value: string) => {
    if (selectedBenefits.includes(value)) {
      onChange(selectedBenefits.filter(b => b !== value));
    } else {
      onChange([...selectedBenefits, value]);
    }
  };

  const addCustomBenefit = () => {
    const trimmed = customBenefitInput.trim();
    if (trimmed && !selectedBenefits.includes(trimmed)) {
      onChange([...selectedBenefits, trimmed]);
      setCustomBenefitInput('');
    }
  };

  const removeBenefit = (benefit: string) => {
    onChange(selectedBenefits.filter(b => b !== benefit));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomBenefit();
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-white text-sm font-medium">Förmåner</Label>
      
      {/* Selected benefits badges */}
      {selectedBenefits.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedBenefits.map((benefit) => (
            <span
              key={benefit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/5 border border-white/20 rounded-full text-xs text-white backdrop-blur-sm"
            >
              {getBenefitLabel(benefit)}
              <button
                type="button"
                onClick={() => removeBenefit(benefit)}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Dropdown button */}
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="w-full h-11 px-3 py-2 bg-white/5 border border-white/20 rounded-md text-left flex items-center justify-between text-white text-sm transition-all duration-300 md:hover:bg-white/15 md:hover:border-white/30"
        >
          <span className="text-white">
            {selectedBenefits.length > 0 
              ? `${selectedBenefits.length} vald${selectedBenefits.length > 1 ? 'a' : ''}`
              : 'Välj förmåner'
            }
          </span>
          <ChevronDown className={`h-4 w-4 text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full glass-panel rounded-md max-h-72 overflow-hidden">
            {/* Predefined benefits */}
            <div className="max-h-48 overflow-y-auto">
              {BENEFITS_OPTIONS.map((option) => {
                const isSelected = selectedBenefits.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleBenefit(option.value)}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-all duration-150 flex items-center gap-2 ${
                      isSelected 
                        ? 'bg-primary/30' 
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-[3px] border shrink-0 ${
                      isSelected 
                        ? 'bg-primary border-primary' 
                        : 'border-white/30 bg-white/10'
                    } flex items-center justify-center`}>
                      {isSelected && (
                        <Heart className="w-2.5 h-2.5 text-white" strokeWidth={2.25} />
                      )}
                    </div>
                    <span className="text-white">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
            
            {/* Custom benefit input */}
            <div className="p-2 border-t border-white/10">
              <div className="flex gap-2">
                <Input
                  value={customBenefitInput}
                  onChange={(e) => setCustomBenefitInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Lägg till egen förmån"
                  className="flex-1 h-11 bg-white/10 border-white/20 text-white text-sm placeholder:text-white"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  onClick={addCustomBenefit}
                  disabled={!customBenefitInput.trim()}
                  className="h-11 w-11 min-w-[44px] shrink-0 aspect-square bg-white/10 border border-white/20 !rounded-full text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BenefitsDropdown;

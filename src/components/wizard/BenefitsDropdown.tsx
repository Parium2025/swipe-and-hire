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
          <div className="absolute z-50 mt-1 w-full bg-slate-900/85 backdrop-blur-xl border border-white/20 rounded-md shadow-lg max-h-72 overflow-hidden">
            {/* Predefined benefits */}
            <div className="max-h-48 overflow-y-auto">
              {BENEFITS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleBenefit(option.value)}
                  className="w-full px-3 py-2 text-left text-sm transition-all duration-300 hover:bg-white/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border ${selectedBenefits.includes(option.value) ? 'bg-white border-white' : 'border-white/30 bg-white/10'} flex items-center justify-center`}>
                      {selectedBenefits.includes(option.value) && (
                        <Heart className="w-3 h-3 text-primary" />
                      )}
                    </div>
                    <span className="text-white">{option.label}</span>
                  </div>
                </button>
              ))}
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
                  className="h-11 px-3 bg-white/10 border border-white/20 rounded-md text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
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

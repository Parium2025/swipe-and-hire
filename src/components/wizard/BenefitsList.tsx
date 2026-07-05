import React, { memo } from 'react';
import { Check } from 'lucide-react';

const BENEFIT_OPTIONS = [
  { value: 'friskvard', label: 'Friskvårdsbidrag' },
  { value: 'tjanstepension', label: 'Tjänstepension' },
  { value: 'kollektivavtal', label: 'Kollektivavtal' },
  { value: 'flexibla-tider', label: 'Flexibla arbetstider' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'tjanstebil', label: 'Tjänstebil' },
  { value: 'mobiltelefon', label: 'Mobiltelefon' },
  { value: 'utbildning', label: 'Utbildning/kompetensutveckling' },
  { value: 'forsakringar', label: 'Försäkringar' },
  { value: 'extra-semester', label: 'Extra semesterdagar' },
  { value: 'gym', label: 'Gym/träning' },
  { value: 'foraldraledithet', label: 'Föräldraledighetstillägg' },
  { value: 'lunch', label: 'Lunch/mat' },
  { value: 'fri-parkering', label: 'Fri parkering' },
  { value: 'personalrabatter', label: 'Personalrabatter' },
];

interface BenefitsListProps {
  selectedBenefits: string[];
  onToggle: (value: string) => void;
}

export const BenefitsList = memo(({ selectedBenefits, onToggle }: BenefitsListProps) => {
  return (
    <>
      {BENEFIT_OPTIONS.map((benefit) => {
        const isSelected = selectedBenefits.includes(benefit.value);

        return (
          <button
            key={benefit.value}
            type="button"
            onClick={() => onToggle(benefit.value)}
            aria-pressed={isSelected}
            className={`relative w-full px-3 pr-10 py-2.5 text-left text-white text-sm border-b border-white/10 last:border-b-0 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${isSelected ? 'bg-white/20' : 'hover:bg-white/20'}`}
          >
            <span className="block truncate font-medium">{benefit.label}</span>
            {isSelected && (
              <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" strokeWidth={2.75} />
            )}
          </button>
        );
      })}
    </>
  );
});
BenefitsList.displayName = 'BenefitsList';

export { BENEFIT_OPTIONS };
export default BenefitsList;

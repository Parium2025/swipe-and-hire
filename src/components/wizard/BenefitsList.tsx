import React, { memo, useCallback } from 'react';
import { Heart } from 'lucide-react';

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

const BenefitRow = memo(({ value, label, isSelected, onToggle }: {
  value: string;
  label: string;
  isSelected: boolean;
  onToggle: (value: string) => void;
}) => (
  <button
    key={value}
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onToggle(value);
    }}
    className={`w-full px-3 py-2.5 text-left text-white text-sm border-b border-white/10 last:border-b-0 flex items-center gap-2 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors ${isSelected ? 'bg-primary/30' : 'hover:bg-white/10'}`}
  >
    <div className={`w-4 h-4 rounded border shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-white/30 bg-white/10'} flex items-center justify-center`}>
      {isSelected && (
        <Heart className="w-2.5 h-2.5 text-white" fill="currentColor" />
      )}
    </div>
    <span>{label}</span>
  </button>
));
BenefitRow.displayName = 'BenefitRow';

export const BenefitsList = memo(({ selectedBenefits, onToggle }: BenefitsListProps) => {
  return (
    <>
      {BENEFIT_OPTIONS.map((benefit) => (
        <BenefitRow
          key={benefit.value}
          value={benefit.value}
          label={benefit.label}
          isSelected={selectedBenefits.includes(benefit.value)}
          onToggle={onToggle}
        />
      ))}
    </>
  );
});
BenefitsList.displayName = 'BenefitsList';

export { BENEFIT_OPTIONS };
export default BenefitsList;

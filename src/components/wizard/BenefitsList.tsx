import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
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

/**
 * BenefitsList uses local state for instant UI updates,
 * then syncs to parent via onToggle in a microtask to avoid
 * blocking the UI with a massive parent re-render.
 */
export const BenefitsList = memo(({ selectedBenefits, onToggle }: BenefitsListProps) => {
  // Local copy for instant UI — avoids waiting for parent re-render
  const [localSelected, setLocalSelected] = useState<Set<string>>(() => new Set(selectedBenefits));
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  // Sync from parent when selectedBenefits changes externally
  useEffect(() => {
    setLocalSelected(new Set(selectedBenefits));
  }, [selectedBenefits]);

  const handleToggle = useCallback((value: string) => {
    // Instant local update
    setLocalSelected(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
    // Deferred parent update so UI doesn't freeze
    requestAnimationFrame(() => {
      onToggleRef.current(value);
    });
  }, []);

  return (
    <>
      {BENEFIT_OPTIONS.map((benefit) => {
        const isSelected = localSelected.has(benefit.value);
        return (
          <button
            key={benefit.value}
            type="button"
            onClick={() => handleToggle(benefit.value)}
            className={`w-full px-3 py-2.5 text-left text-white text-sm border-b border-white/10 last:border-b-0 flex items-center gap-2 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors ${isSelected ? 'bg-primary/30' : 'hover:bg-white/10'}`}
          >
            <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-white/30 bg-white/10'}`}>
              {isSelected && (
                <Heart className="w-2.5 h-2.5 text-white" fill="currentColor" />
              )}
            </div>
            <span>{benefit.label}</span>
          </button>
        );
      })}
    </>
  );
});
BenefitsList.displayName = 'BenefitsList';

export { BENEFIT_OPTIONS };
export default BenefitsList;

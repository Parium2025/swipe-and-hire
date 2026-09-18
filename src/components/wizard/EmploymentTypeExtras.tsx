import React, { useEffect } from 'react';
import {
  WEEKDAYS,
  PART_TIME_SHIFTS,
  TYPES_WITH_DURATION,
  TYPES_WITH_PART_TIME_DAYS,
  type DurationUnit,
} from '@/lib/employmentTypes';
import { RequiredMark } from '@/components/wizard/RequiredMark';

interface EmploymentTypeExtrasProps {
  employmentType?: string;
  partTimeDays: string[];
  partTimeShifts?: string[];
  durationAmount: number | null;
  durationUnit: DurationUnit;
  onPartTimeDaysChange: (days: string[]) => void;
  onPartTimeShiftsChange?: (shifts: string[]) => void;
  onDurationAmountChange: (n: number | null) => void;
  onDurationUnitChange: (u: DurationUnit) => void;
}

/**
 * Extra inputs rendered directly under the employment-type dropdown when the
 * selected type needs weekday selection (Deltid) or a duration (Konsult,
 * Vikariat, Praktik, LIA). Renders nothing for Heltid/Sommarjobb.
 */
export const EmploymentTypeExtras: React.FC<EmploymentTypeExtrasProps> = ({
  employmentType,
  partTimeDays,
  partTimeShifts = [],
  durationAmount,
  durationUnit,
  onPartTimeDaysChange,
  onPartTimeShiftsChange,
  onDurationAmountChange,
  onDurationUnitChange,
}) => {
  // Weeks were removed as an option — always coerce to months when a
  // duration-based type is active.
  useEffect(() => {
    if (
      employmentType &&
      TYPES_WITH_DURATION.has(employmentType) &&
      durationUnit !== 'months'
    ) {
      onDurationUnitChange('months');
    }
  }, [employmentType, durationUnit, onDurationUnitChange]);

  if (!employmentType) return null;


  if (TYPES_WITH_PART_TIME_DAYS.has(employmentType)) {
    const toggle = (v: string) => {
      if (partTimeDays.includes(v)) {
        onPartTimeDaysChange(partTimeDays.filter(d => d !== v));
      } else {
        // keep weekday order
        const order = WEEKDAYS.map(w => w.value);
        onPartTimeDaysChange(
          [...partTimeDays, v].sort((a, b) => order.indexOf(a) - order.indexOf(b))
        );
      }
    };
    const toggleShift = (v: string) => {
      if (!onPartTimeShiftsChange) return;
      if (partTimeShifts.includes(v)) {
        onPartTimeShiftsChange(partTimeShifts.filter(s => s !== v));
      } else {
        const order = PART_TIME_SHIFTS.map(s => s.value);
        onPartTimeShiftsChange(
          [...partTimeShifts, v].sort((a, b) => order.indexOf(a) - order.indexOf(b))
        );
      }
    };
    return (
      <div className="mt-3 space-y-3">
        <div className="space-y-2">
          <div className="text-white text-xs font-medium">Vilka dagar? (välj en eller flera)<RequiredMark filled={partTimeDays.length > 0} /></div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map(day => {
              const active = partTimeDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(day.value)}
                  className={`h-9 min-w-[3rem] px-3 rounded-full text-xs font-medium transition-all duration-200 border ${
                    active
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                  }`}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-white text-xs font-medium">Arbetspass (välj en eller flera)<RequiredMark filled={partTimeShifts.length > 0} /></div>
          <div className="flex flex-wrap gap-1.5">
            {PART_TIME_SHIFTS.map(shift => {
              const active = partTimeShifts.includes(shift.value);
              return (
                <button
                  key={shift.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleShift(shift.value)}
                  className={`h-9 min-w-[3rem] px-4 rounded-full text-xs font-medium transition-all duration-200 border ${
                    active
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                  }`}
                >
                  {shift.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (TYPES_WITH_DURATION.has(employmentType)) {
    return (

      <div className="mt-3 space-y-2">
        <div className="text-white text-xs font-medium">Hur många månader?<RequiredMark filled={!!durationAmount && durationAmount > 0} /></div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            placeholder="t.ex. 6"
            value={durationAmount ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') {
                onDurationAmountChange(null);
              } else {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > 0) onDurationAmountChange(n);
              }
            }}
            className="h-9 w-24 px-3 rounded-full bg-white/5 border border-white/15 text-white text-xs font-medium placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-all duration-200 [font-size:16px] sm:[font-size:12px] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-white text-xs font-medium">
            {durationAmount === 1 ? 'månad' : 'månader'}
          </span>
        </div>
      </div>
    );
  }



  return null;
};

export default EmploymentTypeExtras;

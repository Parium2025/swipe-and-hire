export interface EmploymentType {
  value: string;
  label: string;
  description?: string;
}

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  { value: 'full_time', label: 'Heltid', description: 'Heltidsanställning' },
  { value: 'part_time', label: 'Deltid', description: 'Deltidsanställning' },
  { value: 'contract', label: 'Konsult', description: 'Konsultuppdrag' },
  { value: 'temporary', label: 'Vikariat', description: 'Tillfällig anställning' },
  { value: 'interim', label: 'Interim', description: 'Interimsuppdrag' },
  { value: 'internship', label: 'Praktik', description: 'Praktikplats' },
  { value: 'lia', label: 'LIA', description: 'Lärande i arbete (LIA)' },

  { value: 'summer_job', label: 'Sommarjobb', description: 'Sommaranställning' }
];

export const getEmploymentTypeLabel = (value?: string): string => {
  if (!value) return '';
  const type = EMPLOYMENT_TYPES.find(t => t.value === value);
  return type ? type.label : value;
};

export const getEmploymentTypeByLabel = (label: string): EmploymentType | undefined => {
  return EMPLOYMENT_TYPES.find(t => t.label === label);
};

// For backward compatibility with existing data that might use display labels
export const normalizeEmploymentType = (value: string): string => {
  if (EMPLOYMENT_TYPES.some(t => t.value === value)) {
    return value;
  }
  const type = getEmploymentTypeByLabel(value);
  return type ? type.value : value;
};

// For search functionality - includes both Swedish display labels and code values
export const SEARCH_EMPLOYMENT_TYPES = EMPLOYMENT_TYPES.map(type => ({
  value: type.value,
  label: type.label,
  code: type.value
}));

// ---------------------------------------------------------------------------
// Detail-fields per employment type (see plan)
// ---------------------------------------------------------------------------

/** Employment types that need a duration (X weeks / X months). */
export const TYPES_WITH_DURATION = new Set(['contract', 'temporary', 'interim', 'internship', 'lia']);

/** Employment types that need part-time weekday picker. */
export const TYPES_WITH_PART_TIME_DAYS = new Set(['part_time']);

export interface WeekdayOption {
  value: string;
  short: string;
  label: string;
}

export const WEEKDAYS: WeekdayOption[] = [
  { value: 'mon', short: 'Mån', label: 'Måndag' },
  { value: 'tue', short: 'Tis', label: 'Tisdag' },
  { value: 'wed', short: 'Ons', label: 'Onsdag' },
  { value: 'thu', short: 'Tor', label: 'Torsdag' },
  { value: 'fri', short: 'Fre', label: 'Fredag' },
  { value: 'sat', short: 'Lör', label: 'Lördag' },
  { value: 'sun', short: 'Sön', label: 'Söndag' },
];

export interface ShiftOption {
  value: string;
  label: string;
}

export const PART_TIME_SHIFTS: ShiftOption[] = [
  { value: 'day', label: 'Dag' },
  { value: 'evening', label: 'Kväll' },
  { value: 'night', label: 'Natt' },
];

export const formatPartTimeShifts = (shifts?: string[] | null): string => {
  if (!shifts || shifts.length === 0) return '';
  const order = PART_TIME_SHIFTS.map(s => s.value);
  const sorted = [...shifts].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sorted.map(v => PART_TIME_SHIFTS.find(s => s.value === v)?.label || v).join(', ');
};

export type DurationUnit = 'weeks' | 'months';

export const DURATION_UNIT_LABEL: Record<DurationUnit, { singular: string; plural: string }> = {
  weeks: { singular: 'vecka', plural: 'veckor' },
  months: { singular: 'månad', plural: 'månader' },
};

export const formatDuration = (amount?: number | null, unit?: string | null): string => {
  if (!amount || amount <= 0 || !unit) return '';
  const u = unit as DurationUnit;
  const map = DURATION_UNIT_LABEL[u];
  if (!map) return '';
  return `${amount} ${amount === 1 ? map.singular : map.plural}`;
};

export const formatPartTimeDays = (days?: string[] | null): string => {
  if (!days || days.length === 0) return '';
  // Preserve weekday order
  const order = WEEKDAYS.map(w => w.value);
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sorted.map(d => WEEKDAYS.find(w => w.value === d)?.short || d).join(', ');
};

/**
 * Produce a short human string describing extra employment details, e.g.
 *  - "Mån, Ons, Fre"
 *  - "ca 6 månader"
 * Empty string when nothing to show.
 */
export const formatEmploymentDetails = (job: {
  employment_type?: string | null;
  part_time_days?: string[] | null;
  part_time_shifts?: string[] | null;
  duration_amount?: number | null;
  duration_unit?: string | null;
}): string => {
  if (!job.employment_type) return '';
  if (TYPES_WITH_PART_TIME_DAYS.has(job.employment_type)) {
    const days = formatPartTimeDays(job.part_time_days);
    const shifts = formatPartTimeShifts(job.part_time_shifts);
    return [days, shifts].filter(Boolean).join(' · ');
  }
  if (TYPES_WITH_DURATION.has(job.employment_type)) {
    const d = formatDuration(job.duration_amount, job.duration_unit);
    return d ? `ca ${d}` : '';
  }
  return '';
};

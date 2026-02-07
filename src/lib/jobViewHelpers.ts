/**
 * Pure helper/utility functions for JobView display formatting.
 * Extracted from JobView.tsx for reuse and maintainability.
 */

/** Capitalize first letter of any string for premium typography */
export const capitalize = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/** Map salary type to Swedish label */
export const getSalaryTypeLabel = (salaryType: string): string => {
  const labels: Record<string, string> = {
    monthly: 'Månadslön',
    hourly: 'Timlön',
    fixed: 'Fast lön',
    commission: 'Provision',
  };
  return labels[salaryType] || salaryType;
};

/** Format salary range for display */
export const formatSalary = (min?: number, max?: number, salaryType?: string) => {
  const suffix = salaryType === 'hourly' ? 'kr/tim' : 'kr/mån';
  const fmt = (n: number) => n.toLocaleString('sv-SE');
  if (!min && !max) return null;
  if (min && max) return `${fmt(min)} – ${fmt(max)} ${suffix}`;
  if (min) return `Från ${fmt(min)} ${suffix}`;
  if (max) return `Upp till ${fmt(max)} ${suffix}`;
  return null;
};

/** Map work location type to Swedish label */
export const getWorkLocationLabel = (type?: string) => {
  const labels: Record<string, string> = {
    onsite: 'På plats',
    remote: 'Distans',
    hybrid: 'Hybridarbete',
  };
  return type ? labels[type] || capitalize(type) : null;
};

/** Map remote work option to Swedish label */
export const getRemoteWorkLabel = (value?: string) => {
  const labels: Record<string, string> = {
    yes: 'Ja, helt på distans möjligt',
    partially: 'Delvis möjligt',
    no: 'Nej',
  };
  return value ? labels[value] || capitalize(value) : null;
};

/** Map salary transparency option to Swedish label, with smart formatting */
export const getSalaryTransparencyLabel = (value?: string) => {
  const labels: Record<string, string> = {
    full: 'Lön visas öppet',
    range: 'Löneintervall',
    hidden: 'Enligt överenskommelse',
  };
  if (!value) return null;
  // Known label → return it
  if (labels[value]) return labels[value];
  // Detect salary range strings like "75000-80000" and format them nicely
  const rangeMatch = value.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1]).toLocaleString('sv-SE');
    const max = parseInt(rangeMatch[2]).toLocaleString('sv-SE');
    return `${min} – ${max} kr/mån`;
  }
  // Single number
  const singleMatch = value.match(/^(\d+)$/);
  if (singleMatch) {
    return `${parseInt(singleMatch[1]).toLocaleString('sv-SE')} kr/mån`;
  }
  return value;
};

import { formatSalaryTransparencyValue, formatSwedishAmount } from '@/lib/salaryRange';

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
  if (!min && !max) return null;
  if (min && max) return `${formatSwedishAmount(min)} – ${formatSwedishAmount(max)} ${suffix}`;
  if (min) return `Från ${formatSwedishAmount(min)} ${suffix}`;
  if (max) return `Upp till ${formatSwedishAmount(max)} ${suffix}`;
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
  return formatSalaryTransparencyValue(value) || value;
};

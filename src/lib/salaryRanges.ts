// Måste matcha exakt de värden som skrivs av MobileJobWizard till
// job_postings.salary_transparency — så filtret kan matcha via ren
// string-jämförelse (ingen parsing behövs).
export const SALARY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Alla löner' },
  { value: '0-5000', label: '0 – 5 000 kr/mån' },
  { value: '5000-10000', label: '5 000 – 10 000 kr/mån' },
  { value: '10000-15000', label: '10 000 – 15 000 kr/mån' },
  { value: '15000-20000', label: '15 000 – 20 000 kr/mån' },
  { value: '20000-25000', label: '20 000 – 25 000 kr/mån' },
  { value: '25000-30000', label: '25 000 – 30 000 kr/mån' },
  { value: '30000-40000', label: '30 000 – 40 000 kr/mån' },
  { value: '40000-45000', label: '40 000 – 45 000 kr/mån' },
  { value: '45000-50000', label: '45 000 – 50 000 kr/mån' },
  { value: '50000-55000', label: '50 000 – 55 000 kr/mån' },
  { value: '55000-60000', label: '55 000 – 60 000 kr/mån' },
  { value: '60000-65000', label: '60 000 – 65 000 kr/mån' },
  { value: '65000-70000', label: '65 000 – 70 000 kr/mån' },
  { value: '70000-75000', label: '70 000 – 75 000 kr/mån' },
  { value: '75000-80000', label: '75 000 – 80 000 kr/mån' },
  { value: '80000-85000', label: '80 000 – 85 000 kr/mån' },
  { value: '85000-90000', label: '85 000 – 90 000 kr/mån' },
  { value: '90000-100000', label: '90 000 – 100 000 kr/mån' },
  { value: '100000+', label: '100 000+ kr/mån' },
];

export const TIME_FILTER_OPTIONS = [
  { value: '12h', label: '12 tim' },
  { value: '24h', label: '24 tim' },
  { value: '3d', label: '3 dagar' },
  { value: '7d', label: '7 dagar' },
  { value: 'all', label: 'Alla' },
] as const;

export type TimeFilterValue = (typeof TIME_FILTER_OPTIONS)[number]['value'];

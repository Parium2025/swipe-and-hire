// Auto-generate a minimal but SEO-valid OccupationData for any occupation name
// from src/lib/occupations.ts that doesn't have a hand-written page in
// src/data/jobOccupations.ts. Used as a fallback so EVERY yrke-link resolves
// to a real /yrke/{slug} page (no /auth dead-ends).

import type { OccupationData } from '@/data/jobOccupations';
import { OCCUPATION_CATEGORIES, getAllOccupations } from '@/lib/occupations';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const slugifyOccupation = (s: string) =>
  normalize(s)
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const categoryByNormalizedName = new Map<string, string>(
  OCCUPATION_CATEGORIES.flatMap((c) =>
    c.subcategories.map((n) => [normalize(n), c.label] as const),
  ),
);

const SLUG_TO_NAME = new Map<string, string>(
  getAllOccupations().map((n) => [slugifyOccupation(n), n] as const),
);

// Bygg böjd form: "som lärare", "som personlig assistent"
const toAsForm = (name: string) => `som ${name.toLowerCase()}`;
const toPlural = (name: string) => name.toLowerCase();

const genericTasks = (name: string): string[] => [
  `Utföra dagliga arbetsuppgifter som ${name.toLowerCase()}`,
  'Samarbeta med kollegor och kunder',
  'Följa rutiner och säkerhetskrav',
  'Dokumentera och rapportera utfört arbete',
  'Bidra till ett positivt arbetsklimat',
];

const genericSkills = (): string[] => [
  'Relevant utbildning eller erfarenhet meriterande',
  'God samarbetsförmåga och kommunikation',
  'Noggrannhet och ansvarstagande',
  'Vilja att lära och utvecklas',
];

// Ungefärliga månadslönespann (kr/månad) per kategori – baserade på SCB:s
// lönestrukturstatistik. Används som SEO-fallback för yrken utan handskriven data.
const SALARY_BY_CATEGORY: Record<string, [number, number]> = {
  'Administration, Ekonomi, Juridik': [28000, 45000],
  'Bygg och Anläggning': [28000, 40000],
  'Chefer och Verksamhetsledare': [45000, 80000],
  'Data/IT': [38000, 65000],
  'Försäljning, Inköp, Marknadsföring': [28000, 50000],
  Hantverkyrken: [26000, 38000],
  'Hotell, Restaurang, Storhushåll': [24000, 32000],
  'Hälso- och Sjukvård': [27000, 45000],
  'Industriell Tillverkning': [26000, 38000],
  'Installation, Drift, Underhåll': [28000, 42000],
  Transport: [26000, 38000],
  'Kropps- och Skönhetsvård': [24000, 34000],
  'Kultur, Media, Design': [26000, 42000],
  'Militärt Arbete': [25000, 40000],
  Naturbruk: [24000, 34000],
  'Naturvetenskapligt Arbete': [32000, 50000],
  'Pedagogiskt Arbete': [28000, 42000],
  'Sanering och Renhållning': [24000, 32000],
  'Säkerhet och Skydd': [26000, 38000],
  'Socialt Arbete': [26000, 38000],
  'Tekniskt Arbete': [32000, 52000],
};

const fmtKr = (n: number) => n.toLocaleString('sv-SE').replace(/\u00a0/g, ' ');

const buildSalaryText = (name: string, category: string): string => {
  const range = SALARY_BY_CATEGORY[category] ?? [25000, 38000];
  const [low, high] = range;
  return `Genomsnittlig lön ${toAsForm(name)} ligger ungefär mellan ${fmtKr(low)}–${fmtKr(high)} kr/månad beroende på erfarenhet, ort och arbetsgivare. Skapa en profil i Parium för att se aktuella jobb och löneintervall.`;
};

export const buildGenericOccupation = (slug: string): OccupationData | null => {
  const name = SLUG_TO_NAME.get(slug);
  if (!name) return null;

  const category = categoryByNormalizedName.get(normalize(name)) || 'Yrke';

  return {
    slug,
    name,
    plural: toPlural(name),
    asForm: toAsForm(name),
    category,
    intro: `Letar du efter lediga jobb ${toAsForm(name)}? Skapa en profil i Parium och matcha direkt med arbetsgivare i hela Sverige som söker ${toPlural(name)}.`,
    tasks: genericTasks(name),
    skills: genericSkills(),
    salary: buildSalaryText(name, category),
  };
};

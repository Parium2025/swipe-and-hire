/**
 * Normaliserad löneläsning för annonser.
 *
 * Bakgrund: lön sparas på TVÅ sätt i `job_postings`:
 *  1. `salary_min` / `salary_max` (numeriska kolumner — används av äldre annonser)
 *  2. `salary_transparency` (text, t.ex. "30000-40000" eller "after_interview")
 *     — det är den vägen jobbguiden faktiskt skriver idag.
 *
 * All publik yta (annonssida, JSON-LD/Google) måste läsa BÅDA, annars ser
 * det ut som att annonsen saknar lön trots att arbetsgivaren fyllt i den.
 */

export interface SalaryJobFields {
  salary_min?: number | null;
  salary_max?: number | null;
  salary_type?: string | null;
  salary_transparency?: string | null;
}

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  /** Google schema.org unitText */
  unitText: 'HOUR' | 'MONTH';
  /** Svensk etikett, t.ex. "kr/mån" */
  unitLabel: string;
  /** true när arbetsgivaren valt "Lön diskuteras vid intervju". */
  afterInterview: boolean;
}

const HOURLY_TYPES = new Set(['hourly', 'rorlig', 'timlon', 'timlön']);

export function parseSalary(job: SalaryJobFields): ParsedSalary | null {
  const type = (job.salary_type || '').toLowerCase();
  const isHourly = HOURLY_TYPES.has(type) || type.includes('tim');
  const unitText: 'HOUR' | 'MONTH' = isHourly ? 'HOUR' : 'MONTH';
  const unitLabel = isHourly ? 'kr/tim' : 'kr/mån';

  const transparency = (job.salary_transparency || '').trim();

  if (transparency === 'after_interview') {
    return { min: null, max: null, unitText, unitLabel, afterInterview: true };
  }

  let min = typeof job.salary_min === 'number' ? job.salary_min : null;
  let max = typeof job.salary_max === 'number' ? job.salary_max : null;

  if (min === null && max === null && transparency) {
    const range = transparency.match(/^(\d[\d\s]*)\s*[-–—]\s*(\d[\d\s]*)$/);
    if (range) {
      min = parseInt(range[1].replace(/\s/g, ''), 10);
      max = parseInt(range[2].replace(/\s/g, ''), 10);
    } else {
      const single = transparency.match(/^(\d[\d\s]*)$/);
      if (single) min = parseInt(single[1].replace(/\s/g, ''), 10);
    }
  }

  if (min === null && max === null) return null;
  if (Number.isNaN(min as number)) min = null;
  if (Number.isNaN(max as number)) max = null;
  if (min === null && max === null) return null;

  return { min, max, unitText, unitLabel, afterInterview: false };
}

/** Formaterad svensk lönetext, t.ex. "30 000 – 40 000 kr/mån". */
export function formatSalary(job: SalaryJobFields): string | null {
  const s = parseSalary(job);
  if (!s) return null;
  if (s.afterInterview) return 'Lön diskuteras vid intervju';
  const fmt = (n: number) => n.toLocaleString('sv-SE');
  if (s.min !== null && s.max !== null) return `${fmt(s.min)} – ${fmt(s.max)} ${s.unitLabel}`;
  if (s.min !== null) return `Från ${fmt(s.min)} ${s.unitLabel}`;
  return `Upp till ${fmt(s.max!)} ${s.unitLabel}`;
}

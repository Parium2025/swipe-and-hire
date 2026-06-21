/**
 * Smart sökning för SEO-sidor (yrken, städer, kommuner).
 *
 * Mål: hjälpa användaren hitta rätt även när de:
 *   - stavar lite fel ("bilmekanker", "skiterska")
 *   - använder synonymer ("kock" → "kök/restaurang", "hr" → "rekryterare")
 *   - använder fel form ("städa" → "städare", "kör" → "chaufför")
 *   - kombinerar ord ("kock stockholm")
 *
 * Allt körs lokalt i klienten – ingen extra request.
 */

import { jobSearchSynonyms } from '@/lib/smartSearch';
import { findOccupationAliases } from '@/lib/occupationAliases';

// ─────────────────────────────────────────────────────────────────
// Normalisering: ta bort diakriter + svenska bokstäver → ASCII.
// Gör "Örebro" och "orebro" jämförbara.
// ─────────────────────────────────────────────────────────────────
export const normalizeText = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e');

// ─────────────────────────────────────────────────────────────────
// Levenshtein-avstånd (kapas vid maxDistance för snabbhet).
// ─────────────────────────────────────────────────────────────────
const levenshtein = (a: string, b: string, maxDistance = 2): number => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

// ─────────────────────────────────────────────────────────────────
// Bygg en synonym-index av jobSearchSynonyms (normaliserat).
// term → set av relaterade termer.
// ─────────────────────────────────────────────────────────────────
const SYNONYM_INDEX: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const [key, list] of Object.entries(jobSearchSynonyms)) {
    const normKey = normalizeText(key);
    const allTerms = [normKey, ...list.map((t) => normalizeText(t))].filter(
      (t) => t && !/^\d+$/.test(t),
    );
    const bucket = new Set(allTerms);
    for (const term of allTerms) {
      const existing = map.get(term);
      if (existing) {
        bucket.forEach((t) => existing.add(t));
      } else {
        map.set(term, new Set(bucket));
      }
    }
  }
  return map;
})();

/** Returnerar query + alla synonymer (normaliserade). */
const expandWithSynonyms = (token: string): string[] => {
  const direct = SYNONYM_INDEX.get(token);
  if (direct) return Array.from(direct);
  // Prefix-träff i nyckeln (t.ex. "rek" → "rekryterare"-gruppen)
  if (token.length >= 3) {
    for (const [key, bucket] of SYNONYM_INDEX) {
      if (key.startsWith(token)) return Array.from(bucket);
    }
  }
  return [token];
};

// ─────────────────────────────────────────────────────────────────
// Matchar en enskild sök-term mot en haystack-sträng.
// Returnerar score 0–100 (0 = ingen träff).
// ─────────────────────────────────────────────────────────────────
const matchSingleTerm = (term: string, haystack: string): number => {
  if (!term) return 0;
  if (haystack.includes(term)) {
    const words = haystack.split(/[\s,\-/]+/);
    if (words.some((w) => w === term)) return 100;
    if (words.some((w) => w.startsWith(term))) return 90;
    return 80;
  }

  // Fuzzy-match: typo-tolerans på ord-nivå
  if (term.length >= 4) {
    const words = haystack.split(/[\s,\-/]+/).filter((w) => w.length >= 3);
    const maxDist = term.length >= 7 ? 2 : 1;
    let best = 0;
    for (const w of words) {
      if (Math.abs(w.length - term.length) > maxDist) continue;
      const d = levenshtein(w, term, maxDist);
      if (d <= maxDist) {
        const s = 60 - d * 15;
        if (s > best) best = s;
      }
    }
    if (best > 0) return best;
  }

  return 0;
};

// För ett enskilt sökord — bygg listan av alternativ som räknas som träff.
// Alternativen är: själva ordet, dess synonymer (smartSearch),
// och canonical-yrken från aliassystemet.
const tokenAlternatives = (token: string): string[] => {
  const out = new Set<string>([token]);
  for (const syn of expandWithSynonyms(token)) out.add(syn);
  for (const canonical of findOccupationAliases(token)) {
    out.add(normalizeText(canonical));
  }
  return Array.from(out).filter((t) => t.length >= 2);
};

const matchToken = (token: string, haystack: string): number => {
  const alternatives = tokenAlternatives(token);
  let best = 0;
  for (const alt of alternatives) {
    const s = matchSingleTerm(alt, haystack);
    if (s > best) best = s;
    if (best >= 100) return best;
  }
  return best;
};

/**
 * Smart matcher mot en samling sökbara fält.
 *
 * @param query  Vad användaren skrev (t.ex. "kock stockholm")
 * @param fields Sökbara textfält för dokumentet (titel, kategori, synonymer ...)
 * @returns score: 0 = ingen träff, högre = bättre träff
 */
export const smartMatchScore = (query: string, fields: string[]): number => {
  const q = normalizeText(query.trim());
  if (!q) return 1; // Tomt query = visa alla (men score 1 så ordning bevaras)

  const tokens = q.split(/\s+/).filter((t) => t.length > 0);
  if (!tokens.length) return 1;

  const haystack = fields.map((f) => normalizeText(f || '')).join('  ');

  let total = 0;
  for (const token of tokens) {
    const s = matchToken(token, haystack);
    if (s === 0) return 0; // AND-logik: alla tokens måste matcha
    total += s;
  }
  return total / tokens.length;
};


/** Bekvämlighet: ren boolean-filter. */
export const smartMatches = (query: string, fields: string[]): boolean =>
  smartMatchScore(query, fields) > 0;


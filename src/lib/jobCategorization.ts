import { OCCUPATION_CATEGORIES } from '@/lib/occupations';

const normalizeForCategory = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e');

const includesMeaningfulTerm = (haystack: string, needle: string): boolean => {
  const term = needle.trim();
  return term.length >= 3 && haystack.includes(term);
};

// Utility function to automatically categorize jobs based on title, description and occupation
export const categorizeJob = (title: string, description: string, occupation?: string): string => {
  const normalizedTitle = normalizeForCategory(title || '');
  const normalizedDescription = normalizeForCategory(description || '');
  const normalizedOccupation = normalizeForCategory(occupation || '');
  const combinedText = `${normalizedTitle} ${normalizedDescription} ${normalizedOccupation}`.trim();

  let bestMatch: { category: string; score: number } | null = null;

  for (const category of OCCUPATION_CATEGORIES) {
    let score = 0;

    for (const subcategory of category.subcategories || []) {
      const sub = normalizeForCategory(subcategory);
      if (!sub) continue;

      if (normalizedOccupation && normalizedOccupation === sub) {
        score = Math.max(score, 250);
      } else if (
        normalizedOccupation &&
        (includesMeaningfulTerm(normalizedOccupation, sub) || includesMeaningfulTerm(sub, normalizedOccupation))
      ) {
        score = Math.max(score, 180);
      } else if (includesMeaningfulTerm(normalizedTitle, sub) || includesMeaningfulTerm(sub, normalizedTitle)) {
        score = Math.max(score, 120);
      } else if (sub.length >= 5 && combinedText.includes(sub)) {
        score = Math.max(score, 70);
      }
    }

    for (const keyword of category.keywords || []) {
      const keywordNorm = normalizeForCategory(keyword);
      if (!keywordNorm || keywordNorm.length < 3) continue;

      if (normalizedOccupation === keywordNorm || normalizedTitle === keywordNorm) {
        score = Math.max(score, 140);
      } else if (includesMeaningfulTerm(normalizedOccupation, keywordNorm)) {
        score = Math.max(score, 110);
      } else if (includesMeaningfulTerm(normalizedTitle, keywordNorm)) {
        score = Math.max(score, 90);
      } else if (combinedText.includes(keywordNorm)) {
        score = Math.max(score, 45);
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { category: category.value, score };
    }
  }

  return bestMatch && bestMatch.score >= 45 ? bestMatch.category : '';
};
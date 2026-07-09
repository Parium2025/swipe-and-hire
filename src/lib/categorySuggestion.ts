import { OCCUPATION_CATEGORIES, type OccupationCategory } from './occupations';

/**
 * Smart mapping från fritextsök → yrkesområde.
 *
 * Ger den bästa matchande OCCUPATION_CATEGORY för en sökfras genom att jämföra
 * mot kategorins label, keywords och subcategories. Returnerar null om ingen
 * rimlig träff hittas (för korta queries eller inga matchningar).
 *
 * Används för att visa "💡 Filtrera på Försäljning"-förslag under sökrutan så
 * användaren kan koppla ihop toppsök med Yrkesområde-filtret i ett klick.
 */
export const suggestCategoryFromSearch = (
  searchQuery: string,
): OccupationCategory | null => {
  const q = searchQuery.trim().toLowerCase();
  if (q.length < 3) return null;

  let best: { category: OccupationCategory; score: number } | null = null;

  for (const category of OCCUPATION_CATEGORIES) {
    let score = 0;

    // Exact keyword match — starkaste signalen
    for (const keyword of category.keywords || []) {
      const k = keyword.toLowerCase();
      if (k === q) score = Math.max(score, 100);
      else if (q.includes(k) || k.includes(q)) score = Math.max(score, 60);
    }

    // Subcategory match — starkt signal (specifik yrkestitel)
    for (const sub of category.subcategories || []) {
      const s = sub.toLowerCase();
      if (s === q) score = Math.max(score, 90);
      else if (s.startsWith(q)) score = Math.max(score, 70);
      else if (s.includes(q)) score = Math.max(score, 50);
    }

    // Label match — svagare (breda kategorinamn)
    const label = category.label.toLowerCase();
    if (label.includes(q)) score = Math.max(score, 40);

    if (score > 0 && (!best || score > best.score)) {
      best = { category, score };
    }
  }

  // Kräv rimlig träffsäkerhet — undvik svaga false positives
  if (!best || best.score < 50) return null;
  return best.category;
};

/**
 * Central mappning mellan `saved_searches`-rader och `SearchCriteria`.
 *
 * Syfte: All logik för vilka fält som ingår i en sparad sökning bor på ETT ställe.
 * Om ett nytt filter läggs till framöver (t.ex. `remote_only`) räcker det att
 * uppdatera `SearchCriteria`-typen + dessa två funktioner — inte tre olika filer.
 *
 * Beteendet är bit-för-bit identiskt med den tidigare, inlinade mappningen.
 */
import type { SavedSearch, SearchCriteria } from '@/hooks/useSavedSearches';

/**
 * Konverterar en sparad sökning (DB-rad) till kriterier som kan appliceras
 * på söksidan. Null → undefined, tomma arrays → undefined (samma semantik
 * som den ursprungliga inlinade koden i SavedSearchesDropdown).
 */
export const savedSearchToCriteria = (search: SavedSearch): SearchCriteria => ({
  search_query: search.search_query || undefined,
  city: search.city || undefined,
  county: search.county || undefined,
  employment_types: search.employment_types || undefined,
  category: search.category || undefined,
  subcategories: search.subcategories || undefined,
  time_filter: search.time_filter || undefined,
  sort_by: search.sort_by || undefined,
  salary_min: search.salary_min || undefined,
  salary_max: search.salary_max || undefined,
});

/**
 * Kriterie-fält som mappas till DB-kolumner vid INSERT/UPDATE.
 * Tomma strängar och tomma arrays normaliseras till `null` för att
 * hålla databasen ren (samma semantik som tidigare inlinad kod).
 */
export type SavedSearchCriteriaColumns = {
  search_query: string | null;
  city: string | null;
  county: string | null;
  employment_types: string[] | null;
  category: string | null;
  subcategories: string[] | null;
  time_filter: string | null;
  sort_by: string | null;
  salary_min: number | null;
  salary_max: number | null;
};

/**
 * Konverterar `SearchCriteria` till kolumnvärden lämpliga för INSERT/UPDATE
 * på `saved_searches`. `user_id` och `name` läggs till av anroparen.
 */
export const criteriaToSavedSearchColumns = (
  criteria: SearchCriteria,
): SavedSearchCriteriaColumns => ({
  search_query: criteria.search_query || null,
  city: criteria.city || null,
  county: criteria.county || null,
  employment_types: criteria.employment_types?.length ? criteria.employment_types : null,
  category: criteria.category || null,
  subcategories: criteria.subcategories?.length ? criteria.subcategories : null,
  time_filter: criteria.time_filter || null,
  sort_by: criteria.sort_by || null,
  salary_min: criteria.salary_min || null,
  salary_max: criteria.salary_max || null,
});

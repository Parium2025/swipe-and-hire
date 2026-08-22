/**
 * Databasen returnerar max 1000 rader per anrop. Utan paginering trunkeras
 * resultatet TYST — inget fel kastas, raderna försvinner bara. Den här
 * hjälparen loopar igenom sidorna tills allt är hämtat.
 *
 * Använd den för varje query som teoretiskt kan passera 1000 rader.
 * Kräver en stabil `.order(...)` i queryn så att sidorna inte överlappar.
 */

export const PAGE_ROWS = 1000;

/** Hård spärr så en trasig query aldrig kan loopa i evighet. */
const MAX_ROWS = 200_000;

export async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>,
  maxRows: number = MAX_ROWS,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_ROWS) {
    const { data, error } = await build(from, from + PAGE_ROWS - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) break;
  }
  return out;
}

/** Delar upp en lista i bitar — används för `in()`-filter så URL:en inte blir för lång. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

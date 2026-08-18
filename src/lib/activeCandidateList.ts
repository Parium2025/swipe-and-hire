/**
 * Aktiv kandidatlista — delad sanning mellan UI och bakgrundssynk.
 *
 * Bakgrundssynken (useCandidateBackgroundSync / useEmployerBackgroundSync)
 * skriver till React Query-nyckeln innan sidan monterats. Därför måste
 * list-id:t gå att läsa synkront, utan nätverk. Vi cachar därför både valt
 * list-id och själva listorna i localStorage.
 */

const ACTIVE_KEY = (userId: string) => `active_candidate_list_${userId}`;
const LISTS_KEY = (userId: string) => `candidate_lists_cache_${userId}`;

export interface CachedCandidateList {
  id: string;
  name: string;
  order_index: number;
  is_default: boolean;
}

export function readCachedCandidateLists(userId: string | undefined | null): CachedCandidateList[] | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LISTS_KEY(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string');
  } catch {
    return null;
  }
}

export function writeCachedCandidateLists(userId: string | undefined | null, lists: CachedCandidateList[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(LISTS_KEY(userId), JSON.stringify(lists));
  } catch {
    /* storage full — cachen är bara en genväg */
  }
}

/**
 * Synkront läsbart id för den lista användaren senast tittade på.
 * Faller tillbaka på standardlistan i cachen, annars null (= alla listor).
 */
export function getActiveCandidateListId(userId: string | undefined | null): string | null {
  if (!userId || typeof window === 'undefined') return null;
  const lists = readCachedCandidateLists(userId);
  try {
    const stored = localStorage.getItem(ACTIVE_KEY(userId));
    if (stored) {
      if (!lists) return stored;
      if (lists.some((l) => l.id === stored)) return stored;
    }
  } catch {
    /* ignore */
  }
  return lists?.find((l) => l.is_default)?.id ?? lists?.[0]?.id ?? null;
}

export function setActiveCandidateListId(userId: string | undefined | null, listId: string | null): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    if (listId) localStorage.setItem(ACTIVE_KEY(userId), listId);
    else localStorage.removeItem(ACTIVE_KEY(userId));
  } catch {
    /* ignore */
  }
}

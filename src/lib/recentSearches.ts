import { useCallback, useEffect, useState } from 'react';

const MAX_RECENT = 6;

/**
 * Lagrar senast sökta termer per nyckel i localStorage. Helt enhetslokalt —
 * ingen databas, inga GDPR-implikationer. Defensiv parsing (skadad data
 * raderas tyst och faller tillbaka till tom lista).
 */
export function useRecentSearches(storageKey: string) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setItems(parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX_RECENT));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }, [storageKey]);

  const push = useCallback((term: string) => {
    const t = term.trim();
    if (!t || t.length < 2) return;
    setItems((prev) => {
      const norm = t.toLocaleLowerCase('sv');
      const next = [t, ...prev.filter((x) => x.toLocaleLowerCase('sv') !== norm)].slice(0, MAX_RECENT);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  const clear = useCallback(() => {
    setItems([]);
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  return { items, push, clear };
}

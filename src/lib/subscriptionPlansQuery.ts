import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Delad hämtning + cache för prenumerationsplaner.
 *
 * Planer ändras extremt sällan. För att /valj-plan aldrig ska visa skelett —
 * inte ens vid kallstart (första besöket i en ny session/flik) — gör vi tre saker:
 *  1. react-query cache i minnet (30 min färskhet)
 *  2. en snapshot i localStorage som används som initialData vid kallstart
 *  3. prefetch i bakgrunden från /home så datan finns innan användaren klickar
 */

export const SUBSCRIPTION_PLANS_KEY = ['subscription-plans', 'active'] as const;

const SNAPSHOT_KEY = 'parium:subscription-plans:v1';
const SNAPSHOT_MAX_AGE = 24 * 60 * 60 * 1000; // 1 dygn

export type SubscriptionPlanRow = Record<string, unknown>;

export async function fetchSubscriptionPlans<T = SubscriptionPlanRow>(): Promise<T[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as T[];
  writePlansSnapshot(rows);
  return rows;
}

export function readPlansSnapshot<T = SubscriptionPlanRow>(): T[] | undefined {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { at?: number; rows?: unknown };
    if (!parsed || typeof parsed.at !== 'number') return undefined;
    if (Date.now() - parsed.at > SNAPSHOT_MAX_AGE) return undefined;
    // Obligatorisk validering av cache-data
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return undefined;
    if (!parsed.rows.every((r) => r && typeof r === 'object')) return undefined;
    return parsed.rows as T[];
  } catch {
    return undefined;
  }
}

function writePlansSnapshot(rows: unknown[]) {
  try {
    if (!Array.isArray(rows) || rows.length === 0) return;
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ at: Date.now(), rows }));
  } catch {
    /* storage kan vara full/blockerad — cache är best effort */
  }
}

/** Förhämtar planerna i bakgrunden (idle) så att /valj-plan renderas direkt. */
export function prefetchSubscriptionPlans(queryClient: QueryClient) {
  const run = () => {
    queryClient
      .prefetchQuery({
        queryKey: SUBSCRIPTION_PLANS_KEY,
        queryFn: () => fetchSubscriptionPlans(),
        staleTime: 30 * 60 * 1000,
      })
      .catch(() => {
        /* tyst — prefetch får aldrig störa sidan */
      });
  };

  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 600);
  }
}

import { useQueryClient } from '@tanstack/react-query';
import { readCachedCount } from '@/lib/skeletonCounts';

/**
 * Delad logik för "levande" skelett-antal.
 *
 * Skelettet ska aldrig gissa hur många kort/rader som kommer renderas.
 * Ordningen är:
 *   1. Läs faktiskt antal ur React Query-cachen (varm navigering).
 *   2. Faller tillbaka på senast cachade antal i localStorage (kallstart).
 *   3. Clampas alltid till hur många placeholders som får plats i vyn.
 *
 * Samma mönster som arbetsgivarsidans EmployerPageSkeleton.
 */

/** Antal kortplatser som realistiskt syns i första vyn (kolumner × rader). */
export function viewportCardCap(): number {
  if (typeof window === 'undefined') return 6;
  const w = window.innerWidth;
  const cols = w >= 1024 ? 3 : w >= 640 ? 2 : 1;
  return cols === 1 ? 3 : cols * 2;
}

/** Antal listrader (chatt, notiser) som får plats ovanför vikningen. */
export function viewportRowCap(rowHeight = 76): number {
  if (typeof window === 'undefined') return 7;
  const usable = Math.max(240, window.innerHeight - 220);
  return Math.max(3, Math.min(12, Math.round(usable / rowHeight)));
}

function countCachedData(data: unknown, filter?: (item: any) => boolean): number | null {
  const pages = (data as any)?.pages;
  if (Array.isArray(pages)) {
    return pages.reduce((acc: number, p: any) => {
      const arr = Array.isArray(p) ? p : Array.isArray(p?.jobs) ? p.jobs : Array.isArray(p?.data) ? p.data : [];
      return acc + (filter ? arr.filter(filter).length : arr.length);
    }, 0);
  }
  if (Array.isArray(data)) return filter ? data.filter(filter).length : data.length;
  return null;
}

export interface LiveSkeletonCountOptions {
  /** React Query-nycklar (första segmentet räcker) att läsa antal ifrån. */
  queryKeys: string[];
  /** localStorage-nyckel med senast kända antal. */
  fallbackKey: string;
  /** Valfritt filter, t.ex. aktiva vs utgångna ansökningar. */
  filter?: (item: any) => boolean;
  /** Tak för antal placeholders. Default: vad som får plats i vyn. */
  cap?: number;
}

export function useLiveSkeletonCount({
  queryKeys,
  fallbackKey,
  filter,
  cap,
}: LiveSkeletonCountOptions): number {
  const qc = useQueryClient();
  const limit = cap ?? viewportCardCap();

  for (const key of queryKeys) {
    const entries = qc.getQueriesData<any>({ queryKey: [key] });
    for (const [, data] of entries) {
      const n = countCachedData(data, filter);
      if (n !== null) return Math.min(limit, n);
    }
  }

  return Math.min(limit, readCachedCount(fallbackKey, Math.min(limit, 3), 18));
}

/**
 * RED → GREEN: livscykel- och cache-korrekthet i useJobSeekerBackgroundSync.
 *
 *  1. Schemalagda idle-/timeout-callbacks ägs och avbryts. Efter unmount får en
 *     köad requestIdleCallback (eller Safari-fallbackens setTimeout) INTE göra
 *     en enda jobb-/väder-read.
 *  2. Ägarbytet måste synas synkront vid render: i fönstret mellan render och
 *     passiv effekt får A:s callback inte längre räknas som ägare.
 *  3. En inaktuell A-körning får inte uppdatera senaste synk-tidsstämpeln.
 *  4. Färsk storage får inte skriva över nyare data som redan finns i
 *     React Query-nyckeln ['available-jobs'].
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  reads: [] as string[],
  user: { id: 'js-1' } as { id: string } | null,
  role: { role: 'job_seeker', user_id: 'js-1' } as { role: string; user_id?: string } | null,
  weather: { timestamp: 0 } as { timestamp: number } | null,
  weatherCalls: 0,
  syncUpdates: 0,
  /** Manuellt körda idle-callbacks. */
  idleQueue: [] as Array<() => void>,
  cancelledIdle: [] as number[],
  jobRows: [{ id: 'job-net', title: 'Från nätet' }] as Array<Record<string, unknown>>,
  /** Kör köade idle-callbacks mitt i B:s renderfas (före passiva effekter). */
  runQueuedDuringRenderFor: null as string | null,
  /** ownerId för varje skrivning till annons-cachen. */
  cacheWrites: [] as Array<unknown>,
}));

vi.mock('@/integrations/supabase/client', () => {
  const makeQuery = () => {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      order: () => q,
      limit: async () => ({ data: h.jobRows, error: null }),
      then: (onF?: ((v: unknown) => unknown) | null) =>
        Promise.resolve({ data: [], error: null }).then(onF ?? undefined),
    };
    return q;
  };
  return {
    supabase: {
      removeChannel: vi.fn(),
      from: (table: string) => {
        h.reads.push(table);
        return makeQuery();
      },
    },
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: h.user, userRole: h.role }),
}));

vi.mock('@/hooks/useWeather', () => ({
  preloadWeatherLocation: vi.fn(async () => {
    h.weatherCalls += 1;
  }),
}));
vi.mock('@/lib/weatherApi', () => ({
  getCachedWeather: () => h.weather,
}));
vi.mock('@/lib/draftUtils', () => ({
  updateLastSyncTime: () => {
    h.syncUpdates += 1;
  },
}));

import { useJobSeekerBackgroundSync } from '@/hooks/useJobSeekerBackgroundSync';

const CACHE_KEY = 'job_seeker_available_jobs_';

vi.mock('@/lib/safeStorage', () => ({
  safeSetItem: (key: string, value: string) => {
    if (key === 'job_seeker_available_jobs_') {
      try {
        h.cacheWrites.push(JSON.parse(value).ownerId);
      } catch {
        h.cacheWrites.push(null);
      }
    }
    localStorage.setItem(key, value);
    return true;
  },
}));

function Probe() {
  useJobSeekerBackgroundSync();
  if (h.runQueuedDuringRenderFor && h.user?.id === h.runQueuedDuringRenderFor) {
    h.runQueuedDuringRenderFor = null;
    const queued = [...h.idleQueue];
    h.idleQueue.length = 0;
    queued.forEach((run) => run());
  }
  return null;
}

let queryClient: QueryClient;

const renderProbe = () => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
  return {
    rerender: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      ),
    unmount: view.unmount,
  };
};

const settle = async (ms = 60) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

const jobReads = () => h.reads.filter((t) => t === 'job_postings').length;

/** Standard: idle-callbacks körs automatiskt (som i övriga sviter). */
const installAutoIdle = () => {
  let id = 0;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  Object.defineProperty(window, 'requestIdleCallback', {
    value: (cb: IdleRequestCallback) => {
      id += 1;
      const myId = id;
      timers.set(
        myId,
        setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 0),
      );
      return myId;
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'cancelIdleCallback', {
    value: (handle: number) => {
      h.cancelledIdle.push(handle);
      const t = timers.get(handle);
      if (t) clearTimeout(t);
    },
    writable: true,
    configurable: true,
  });
};

/** Idle-callbacks köas manuellt så att vi kan köra dem EFTER unmount. */
const installManualIdle = () => {
  let id = 0;
  Object.defineProperty(window, 'requestIdleCallback', {
    value: (cb: IdleRequestCallback) => {
      id += 1;
      const myId = id;
      h.idleQueue.push(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline));
      return myId;
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'cancelIdleCallback', {
    value: (handle: number) => {
      h.cancelledIdle.push(handle);
      h.idleQueue.length = 0;
    },
    writable: true,
    configurable: true,
  });
};

describe('useJobSeekerBackgroundSync — ägda schemaläggningar och cache-företräde', () => {
  beforeEach(() => {
    localStorage.clear();
    h.reads.length = 0;
    h.idleQueue.length = 0;
    h.cancelledIdle.length = 0;
    h.user = { id: 'js-1' };
    h.role = { role: 'job_seeker', user_id: 'js-1' };
    h.weather = { timestamp: Date.now() - 60 * 60 * 1000 };
    h.weatherCalls = 0;
    h.syncUpdates = 0;
    h.jobRows = [{ id: 'job-net', title: 'Från nätet' }];
    h.runQueuedDuringRenderFor = null;
    h.cacheWrites.length = 0;
    installAutoIdle();
  });

  afterEach(() => cleanup());

  it('köad idle-callback efter unmount ger noll jobb- och väder-reads', async () => {
    installManualIdle();
    const { unmount } = renderProbe();
    await settle(20);

    expect(h.idleQueue.length).toBeGreaterThan(0);

    unmount();

    await act(async () => {
      h.idleQueue.forEach((run) => run());
      await new Promise((r) => setTimeout(r, 120));
    });

    expect(jobReads()).toBe(0);
    expect(h.weatherCalls).toBe(0);
    expect(h.cancelledIdle.length).toBeGreaterThan(0);
  });

  it('Safari-fallbackens timeout efter unmount ger noll reads', async () => {
    // Ingen requestIdleCallback => setTimeout-fallbacken används.
    Object.defineProperty(window, 'requestIdleCallback', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { unmount } = renderProbe();
    unmount();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(jobReads()).toBe(0);
    expect(h.weatherCalls).toBe(0);
  });

  it('A:s callback i render→effekt-fönstret vid A → B kör inte som A', async () => {
    installManualIdle();
    const { rerender } = renderProbe();
    await settle(20);

    // A:s warmup är schemalagd men inte körd. Kör den mitt i B:s renderfas —
    // alltså innan några passiva effekter hunnit köra efter kontobytet.
    h.user = { id: 'js-2' };
    h.role = { role: 'job_seeker', user_id: 'js-2' };
    h.runQueuedDuringRenderFor = 'js-2';
    await act(async () => {
      rerender();
    });
    await settle(80);

    // Ingen skrivning någonsin taggad med A får ske efter kontobytet, och A:s
    // callback får inte ens starta en read (ägaren syns synkront vid render).
    expect(h.cacheWrites).not.toContain('js-1');
    expect(h.reads.filter((t) => t === 'job_postings').length).toBe(0);
  });

  it('inaktuell körning uppdaterar inte senaste synk-tidsstämpeln', async () => {
    installManualIdle();
    const { unmount } = renderProbe();
    await settle(20);

    unmount();
    await act(async () => {
      h.idleQueue.forEach((run) => run());
      await new Promise((r) => setTimeout(r, 120));
    });

    expect(h.syncUpdates).toBe(0);
  });

  it('nyare data i React Query skrivs inte över av färsk storage', async () => {
    const fresher = [{ id: 'in-memory', title: 'Nyare i minnet' }];
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        items: [{ id: 'from-storage' }],
        timestamp: Date.now() - 60 * 1000,
        ownerId: 'js-1',
      }),
    );

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['available-jobs'], fresher);

    const view = render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
    await settle();
    view.unmount();

    expect(queryClient.getQueryData(['available-jobs'])).toBe(fresher);
    expect(jobReads()).toBe(0);
  });

  it('tom QueryClient hydreras fortfarande av ägar-matchad färsk storage', async () => {
    const items = [{ id: 'from-storage' }];
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ items, timestamp: Date.now(), ownerId: 'js-1' }),
    );

    renderProbe();
    await settle();

    expect(queryClient.getQueryData(['available-jobs'])).toEqual(items);
    expect(jobReads()).toBe(0);
  });
});

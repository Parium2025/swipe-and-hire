/**
 * RED → GREEN: korrekt warmup i useJobSeekerBackgroundSync.
 *
 *  1. En färsk `job_seeker_available_jobs_`-post ska faktiskt hydrera
 *     React Query-nyckeln ['available-jobs'] innan preloaden returnerar —
 *     annars är "färsk cache" bara ett sätt att visa tom lista utan nätverk.
 *     Trasig/fel-ägd data hydrerar inte (fail-closed).
 *  2. 2-sekundersdedupen måste vara ägarbunden och provider-lokal: A:s warmup
 *     får aldrig kväva B:s första warmup (eller B:s väderkontroll) vid A → B.
 *  3. En framtida väder-tidsstämpel är inte färsk.
 *  4. En explicit forcerad preload som kommer medan en preload redan pågår får
 *     inte tappas permanent — den koalesceras till EN uppföljning.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}
const makeDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const h = vi.hoisted(() => ({
  reads: [] as string[],
  user: { id: 'js-1' } as { id: string },
  role: { role: 'job_seeker', user_id: 'js-1' } as { role: string; user_id?: string },
  weather: { timestamp: 0 } as { timestamp: number } | null,
  weatherCalls: 0,
  /** När satt: job_postings-svaret väntar tills denna löses. */
  deferredJobs: null as Deferred<void> | null,
  jobRows: [{ id: 'job-net', title: 'Från nätet' }] as Array<Record<string, unknown>>,
}));

vi.mock('@/integrations/supabase/client', () => {
  const makeQuery = () => {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      order: () => q,
      limit: async () => {
        if (h.deferredJobs) await h.deferredJobs.promise;
        return { data: h.jobRows, error: null };
      },
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

import {
  useJobSeekerBackgroundSync,
  triggerJobSeekerBackgroundSync,
} from '@/hooks/useJobSeekerBackgroundSync';

const CACHE_KEY = 'job_seeker_available_jobs_';

function Probe() {
  useJobSeekerBackgroundSync();
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
  };
};

const settle = async (ms = 80) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

const jobReads = () => h.reads.filter((t) => t === 'job_postings').length;

describe('useJobSeekerBackgroundSync — hydrering, ägarbunden dedupe och koalescering', () => {
  beforeEach(() => {
    localStorage.clear();
    h.reads.length = 0;
    h.user = { id: 'js-1' };
    h.role = { role: 'job_seeker', user_id: 'js-1' };
    h.weather = { timestamp: Date.now() };
    h.weatherCalls = 0;
    h.deferredJobs = null;
    h.jobRows = [{ id: 'job-net', title: 'Från nätet' }];
    Object.defineProperty(window, 'requestIdleCallback', {
      value: (cb: IdleRequestCallback) => {
        setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 0);
        return 1;
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => cleanup());

  it('färsk cache hydrerar ["available-jobs"] utan en enda Supabase-read', async () => {
    const items = [{ id: 'cached-1', title: 'Cachad annons' }];
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ items, timestamp: Date.now(), ownerId: 'js-1' }),
    );

    renderProbe();
    await settle();

    expect(jobReads()).toBe(0);
    expect(queryClient.getQueryData(['available-jobs'])).toEqual(items);
  });

  it('fel ägare i cachen hydrerar inte (fail-closed)', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ items: [{ id: 'other' }], timestamp: Date.now(), ownerId: 'js-OTHER' }),
    );

    renderProbe();
    await settle();

    expect(queryClient.getQueryData(['available-jobs'])).toEqual([
      { id: 'job-net', title: 'Från nätet' },
    ]);
  });

  it('A → B inom 2 sekunder: B:s warmup och väderkontroll kvävs inte av A', async () => {
    h.weather = { timestamp: Date.now() - 60 * 60 * 1000 }; // gammalt väder
    const { rerender } = renderProbe();
    await settle();

    expect(jobReads()).toBe(1);
    expect(h.weatherCalls).toBe(1);

    // Kontobyte omedelbart (inom dedupe-fönstret på 2 s)
    h.user = { id: 'js-2' };
    h.role = { role: 'job_seeker', user_id: 'js-2' };
    await act(async () => {
      rerender();
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(jobReads()).toBe(2);
    expect(h.weatherCalls).toBe(2);
  });

  it('framtida väder-tidsstämpel räknas inte som färsk', async () => {
    h.weather = { timestamp: Date.now() + 60 * 60 * 1000 };
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ items: [], timestamp: Date.now(), ownerId: 'js-1' }),
    );

    renderProbe();
    await settle();

    expect(h.weatherCalls).toBe(1);
  });

  it('forcerad preload under pågående körning koalesceras till exakt en uppföljning', async () => {
    const deferred = makeDeferred<void>();
    h.deferredJobs = deferred;

    renderProbe();
    await settle(40); // preloaden är nu igång och väntar på nätverket

    await act(async () => {
      void triggerJobSeekerBackgroundSync();
      void triggerJobSeekerBackgroundSync();
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(jobReads()).toBe(1);

    h.deferredJobs = null;
    await act(async () => {
      deferred.resolve();
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(jobReads()).toBe(2);
  });

  it('överlappande idle/focus/klick/force ger ingen storm, och unmount stoppar uppföljningen', async () => {
    const deferred = makeDeferred<void>();
    h.deferredJobs = deferred;

    renderProbe();
    await settle(40);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new MouseEvent('click'));
      void triggerJobSeekerBackgroundSync();
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(jobReads()).toBe(1);

    cleanup();
    h.deferredJobs = null;
    await act(async () => {
      deferred.resolve();
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(jobReads()).toBe(1);
  });
});

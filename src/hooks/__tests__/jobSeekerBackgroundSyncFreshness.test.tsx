/**
 * RED → GREEN: skalningssäker warmup i useJobSeekerBackgroundSync.
 *
 * Tidigare kördes visibilitychange med force=true, vilket hämtade 100 annonser
 * varje gång tabben fick fokus. Vid 250 000 klienter blir det en herd mot
 * job_postings. Krav:
 *  - ägarbunden roll: en kvarhängande roll från ett annat konto ger noll reads
 *  - färsk available-jobs-cache (< 5 min) → noll reads vid visibility/interaktion
 *  - gammal/trasig cache → exakt EN single-flight read som uppdaterar
 *    localStorage och React Query
 *  - explicit global trigger (login/manuell) forcerar fortfarande
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  reads: [] as string[],
  role: { role: 'job_seeker', user_id: 'js-1' } as { role: string; user_id?: string },
}));

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: () => {
    const channel = { on: () => channel, subscribe: () => channel };
    return channel;
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const makeQuery = () => {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      order: () => q,
      limit: () => Promise.resolve({ data: [{ id: 'job-1', title: 'Ny annons' }], error: null }),
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
  useAuth: () => ({ user: { id: 'js-1' }, userRole: h.role }),
}));

vi.mock('@/hooks/useWeather', () => ({
  preloadWeatherLocation: vi.fn(async () => undefined),
}));
vi.mock('@/lib/weatherApi', () => ({
  getCachedWeather: () => ({ timestamp: Date.now() }),
}));

import {
  useJobSeekerBackgroundSync,
  triggerJobSeekerBackgroundSync,
} from '@/hooks/useJobSeekerBackgroundSync';

const CACHE_KEY = 'job_seeker_available_jobs_';


// Modulglobal 2s-dedupe i hooken delas mellan tester i samma fil. Vi flyttar
// klockan framåt mellan tester så varje test startar med ren dedupe.
const realDateNow = Date.now.bind(Date);
let nowOffset = 0;

function Probe() {
  useJobSeekerBackgroundSync();
  return null;
}

let queryClient: QueryClient;

const renderProbe = () => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
};

const settle = async (ms = 80) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

const fireVisibility = async () => {
  await act(async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 80));
  });
};

describe('useJobSeekerBackgroundSync — ägarskap och cache-färskhet', () => {
  beforeEach(() => {
    localStorage.clear();
    h.reads.length = 0;
    nowOffset += 60_000;
    vi.spyOn(Date, 'now').mockImplementation(() => realDateNow() + nowOffset);
    h.role = { role: 'job_seeker', user_id: 'js-1' };
    Object.defineProperty(window, 'requestIdleCallback', {
      value: (cb: IdleRequestCallback) => {
        setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 0);
        return 1;
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.mocked(Date.now).mockRestore?.();
    cleanup();
  });

  it('fail-closed: kvarhängande roll från annat konto ger noll reads', async () => {
    h.role = { role: 'job_seeker', user_id: 'js-OTHER' };
    renderProbe();
    await settle();
    await fireVisibility();

    expect(h.reads.filter((t) => t === 'job_postings')).toHaveLength(0);
  });

  it('färsk cache: flera visibility-events ger noll job_postings-reads', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ items: [{ id: 'cached' }], timestamp: Date.now() }),
    );
    renderProbe();
    await settle();
    await fireVisibility();
    await settle(2100);
    await fireVisibility();
    await act(async () => {
      document.dispatchEvent(new MouseEvent('click'));
      await new Promise((r) => setTimeout(r, 80));
    });

    expect(h.reads.filter((t) => t === 'job_postings')).toHaveLength(0);
  });

  it('gammal cache: exakt en read som uppdaterar localStorage och querydata', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ items: [{ id: 'old' }], timestamp: Date.now() - 10 * 60 * 1000 }),
    );
    renderProbe();
    await settle();
    await fireVisibility();

    expect(h.reads.filter((t) => t === 'job_postings')).toHaveLength(1);
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    expect(cached.items).toEqual([{ id: 'job-1', title: 'Ny annons' }]);
    expect(queryClient.getQueryData(['available-jobs'])).toEqual([
      { id: 'job-1', title: 'Ny annons' },
    ]);
  });

  it('trasig cache läses exception-safe och leder till exakt en read', async () => {
    localStorage.setItem(CACHE_KEY, '{ inte json');
    renderProbe();
    await settle();

    expect(h.reads.filter((t) => t === 'job_postings')).toHaveLength(1);
  });

  it('explicit global trigger forcerar hämtning även med färsk cache', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ items: [{ id: 'cached' }], timestamp: Date.now() }),
    );
    renderProbe();
    await settle();
    expect(h.reads.filter((t) => t === 'job_postings')).toHaveLength(0);

    await act(async () => {
      await triggerJobSeekerBackgroundSync();
      await new Promise((r) => setTimeout(r, 80));
    });

    expect(h.reads.filter((t) => t === 'job_postings')).toHaveLength(1);
  });

  it('äger fortsatt noll reads/lyssnare för saved_jobs, job_applications, interviews, meddelanden', async () => {
    renderProbe();
    await settle();
    await fireVisibility();

    for (const table of [
      'saved_jobs',
      'job_applications',
      'interviews',
      'conversation_messages',
      'conversations',
    ]) {
      expect(h.reads.filter((t) => t === table)).toHaveLength(0);
    }
  });
});

/**
 * RED → GREEN: dataägarskap för jobbsökarens Home-bakgrundssynk.
 *
 * useJobSeekerBackgroundSync får INTE längre äga saved_jobs, job_applications,
 * conversations/messages eller interviews. Kanoniska ägare:
 *  - AuthProvider  → användarfiltrerad saved_jobs/job_applications-realtime
 *  - ConversationsProvider/useConversations → meddelanden + parium_conversations_cache
 *  - useCandidateInterviews → intervjuer (realtime + canonical query cache)
 *
 * Kvar i background sync: available-jobs-warmup och stale-weather.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  registrations: [] as Array<{ table: string; filter: string; event: string }>,
  readTables: [] as string[],
}));

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (_name: string) => {
    const channel = {
      on: (_event: string, opts: Record<string, unknown>) => {
        h.registrations.push({
          table: String(opts?.table ?? ''),
          filter: String(opts?.filter ?? ''),
          event: String(opts?.event ?? ''),
        });
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const makeQuery = (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      in: () => q,
      order: () => q,
      range: () => Promise.resolve({ data: [], error: null }),
      limit: () => Promise.resolve({ data: [], error: null }),
      then: (
        onF?: ((v: { data: unknown[]; error: null }) => unknown) | null,
        onR?: ((r: unknown) => unknown) | null,
      ) => Promise.resolve({ data: [], error: null }).then(onF ?? undefined, onR ?? undefined),
    };
    void table;
    return q;
  };
  return {
    supabase: {
      removeChannel: vi.fn(),
      from: (table: string) => {
        h.readTables.push(table);
        return makeQuery(table);
      },
    },
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'js-1' },
    userRole: { role: 'job_seeker', user_id: 'js-1' },
  }),
}));

const preloadWeatherLocation = vi.fn(async () => undefined);
let cachedWeather: { timestamp: number } | null = null;
vi.mock('@/hooks/useWeather', () => ({
  preloadWeatherLocation: (...args: unknown[]) => preloadWeatherLocation(...(args as [])),
}));
vi.mock('@/lib/weatherApi', () => ({
  getCachedWeather: () => cachedWeather,
}));
const fetchAllPages = vi.fn(async () => []);
vi.mock('@/lib/fetchAllPages', () => ({
  fetchAllPages: (...args: unknown[]) => fetchAllPages(...(args as [])),
}));
const fetchCandidateInterviewsForUser = vi.fn(async () => []);
vi.mock('@/hooks/useInterviews', () => ({
  fetchCandidateInterviewsForUser: (...args: unknown[]) =>
    fetchCandidateInterviewsForUser(...(args as [])),
}));

import { useJobSeekerBackgroundSync } from '@/hooks/useJobSeekerBackgroundSync';


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

const settle = async (ms = 60) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

describe('useJobSeekerBackgroundSync — dataägarskap', () => {
  beforeEach(() => {
    localStorage.clear();
    h.registrations.length = 0;
    nowOffset += 60_000;
    vi.spyOn(Date, 'now').mockImplementation(() => realDateNow() + nowOffset);
    h.readTables.length = 0;
    cachedWeather = null;
    preloadWeatherLocation.mockClear();
    fetchAllPages.mockClear();
    fetchCandidateInterviewsForUser.mockClear();
    // requestIdleCallback ska köra callbacken direkt i testet.
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

  it('registrerar NOLL realtime för saved_jobs, job_applications, interviews och conversation_messages', async () => {
    renderProbe();
    await settle();

    for (const table of ['saved_jobs', 'job_applications', 'interviews', 'conversation_messages']) {
      expect(h.registrations.filter((r) => r.table === table)).toHaveLength(0);
    }
  });

  it('gör NOLL reads av ägda tabeller vid initial idle, första interaktion och tabbfokus', async () => {
    renderProbe();
    await settle();

    await act(async () => {
      document.dispatchEvent(new MouseEvent('click'));
      await new Promise((r) => setTimeout(r, 60));
    });

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 60));
    });

    for (const table of [
      'saved_jobs',
      'job_applications',
      'conversation_members',
      'conversations',
      'interviews',
    ]) {
      expect(h.readTables.filter((t) => t === table)).toHaveLength(0);
    }
    expect(fetchAllPages).not.toHaveBeenCalled();
    expect(fetchCandidateInterviewsForUser).not.toHaveBeenCalled();
  });

  it('skriver aldrig till främmande caches (conversations, messages, applications, interviews)', async () => {
    renderProbe();
    await settle();
    await act(async () => {
      document.dispatchEvent(new MouseEvent('click'));
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(localStorage.getItem('parium_conversations_cache')).toBeNull();
    const keys = Object.keys(localStorage);
    expect(keys.filter((k) => k.startsWith('job_seeker_messages_'))).toHaveLength(0);
    expect(keys.filter((k) => k.startsWith('job_seeker_applications_'))).toHaveLength(0);
    expect(keys.filter((k) => k.startsWith('job_seeker_saved_jobs_'))).toHaveLength(0);
    expect(keys.filter((k) => k.startsWith('job_seeker_interviews_'))).toHaveLength(0);

    expect(queryClient.getQueryData(['my-applications', 'js-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['applied-job-ids', 'js-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['candidate-interviews', 'js-1'])).toBeUndefined();
  });

  // Modulglobal 2s-throttle i hooken: tvingad focus-preload (force=true) kringgår
  // den så positiva kontroller blir deterministiska oavsett testordning.
  const forceFocusPreload = async () => {
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 80));
    });
  };

  it('positiv kontroll: available-jobs-warmup körs fortfarande', async () => {
    renderProbe();
    await settle();
    await forceFocusPreload();

    expect(h.readTables.filter((t) => t === 'job_postings').length).toBeGreaterThan(0);
  });

  it('positiv kontroll: väder hämtas bara när cachen är gammal', async () => {
    cachedWeather = { timestamp: Date.now() };
    renderProbe();
    await settle();
    await forceFocusPreload();
    expect(preloadWeatherLocation).not.toHaveBeenCalled();

    cleanup();
    cachedWeather = { timestamp: Date.now() - 60 * 60 * 1000 };
    renderProbe();
    await settle();
    await forceFocusPreload();
    expect(preloadWeatherLocation).toHaveBeenCalled();
  });
});

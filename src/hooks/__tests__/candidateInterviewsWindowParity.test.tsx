/**
 * RED-test: bakgrundsförvärmningen av kandidatintervjuer måste använda den
 * kanoniska hämtaren fetchCandidateInterviewsForUser (samma sex-timmars
 * "pågående"-fönster som useCandidateInterviews) i stället för en egen
 * supabase.from('interviews')-query.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const USER_ID = 'job-seeker-user-123';

interface MockChannel {
  name: string;
  on: () => MockChannel;
  subscribe: () => MockChannel;
}

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (name: string): MockChannel => {
    const channel: MockChannel = {
      name,
      on: () => channel,
      subscribe: () => channel,
    };
    return channel;
  },
}));

const fromSpy = vi.fn();

function makeChain() {
  const result = { data: [], error: null };
  const chain: Record<string, unknown> = {};
  for (const key of ['select', 'eq', 'gte', 'lte', 'in', 'is', 'order', 'limit', 'range', 'neq', 'or']) {
    chain[key] = vi.fn(() => chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    removeChannel: vi.fn(),
    from: (table: string) => {
      fromSpy(table);
      return makeChain();
    },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: USER_ID },
    userRole: { role: 'job_seeker' },
  }),
}));

// Narrowly mock unrelated preloads.
vi.mock('@/hooks/useWeather', () => ({
  preloadWeatherLocation: vi.fn(async () => undefined),
}));
vi.mock('@/lib/weatherApi', () => ({
  getCachedWeather: vi.fn(() => null),
}));
vi.mock('@/lib/fetchAllPages', () => ({
  fetchAllPages: vi.fn(async () => []),
}));

const canonicalInterviews = [{ id: 'interview-1' }];
vi.mock('@/hooks/useInterviews', () => ({
  fetchCandidateInterviewsForUser: vi.fn(async () => canonicalInterviews),
}));

import { fetchCandidateInterviewsForUser } from '@/hooks/useInterviews';
import { useJobSeekerBackgroundSync } from '@/hooks/useJobSeekerBackgroundSync';

function Probe() {
  useJobSeekerBackgroundSync();
  return null;
}

describe('background preload of candidate interviews uses the canonical fetcher', () => {
  beforeEach(() => {
    fromSpy.mockClear();
    vi.mocked(fetchCandidateInterviewsForUser).mockClear();
    localStorage.clear();
    // Kör idle-callbacks deterministiskt (synkront).
    Object.defineProperty(window, 'requestIdleCallback', {
      value: (cb: () => void) => {
        cb();
        return 1;
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      value: () => undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('anropar fetchCandidateInterviewsForUser och fyller ["candidate-interviews", userId]', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(fetchCandidateInterviewsForUser).toHaveBeenCalledWith(USER_ID);
    expect(queryClient.getQueryData(['candidate-interviews', USER_ID])).toEqual(canonicalInterviews);

    // Ingen egen interviews-query — annars kan tidsfönstret divergera.
    const interviewQueries = fromSpy.mock.calls.filter(([table]) => table === 'interviews');
    expect(interviewQueries).toHaveLength(0);
  });
});

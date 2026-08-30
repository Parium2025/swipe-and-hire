/**
 * RED-test: useJobSeekerBackgroundSync ska INTE registrera någon
 * conversation_messages-prenumeration — den globala ConversationsProvider/
 * useConversations är den kanoniska vägen för meddelande-realtime.
 *
 * Önskat beteende (GREEN): 0 st conversation_messages-registreringar,
 * medan användarfiltrerade saved_jobs / job_applications
 * fortfarande registreras och interviews ägs av useCandidateInterviews.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Registration {
  table?: string;
  filter?: string;
  event?: string;
}

interface MockChannel {
  name: string;
  on: (event: string, opts: Record<string, unknown>) => MockChannel;
  subscribe: () => MockChannel;
}

const registrations: Registration[] = [];
const removedChannels: string[] = [];

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (name: string): MockChannel => {
    const channel: MockChannel = {
      name,
      on: (_event: string, opts: Record<string, unknown>) => {
        registrations.push({
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

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    removeChannel: vi.fn((channel: MockChannel) => {
      removedChannels.push(channel?.name);
    }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'job-seeker-user-123' },
    userRole: { role: 'job_seeker' },
  }),
}));

// Hindra idle/background-preload från att köras så testet isolerar subscriptions.
vi.mock('@/hooks/useWeather', () => ({
  preloadWeatherLocation: vi.fn(async () => undefined),
}));
vi.mock('@/lib/weatherApi', () => ({
  getCachedWeather: vi.fn(() => null),
}));
vi.mock('@/lib/fetchAllPages', () => ({
  fetchAllPages: vi.fn(async () => []),
}));

import { useJobSeekerBackgroundSync } from '@/hooks/useJobSeekerBackgroundSync';

function Probe() {
  useJobSeekerBackgroundSync();
  return null;
}

describe('useJobSeekerBackgroundSync realtime fan-out', () => {
  beforeEach(() => {
    registrations.length = 0;
    removedChannels.length = 0;
    // requestIdleCallback används av schedulePreload — gör den till no-op.
    Object.defineProperty(window, 'requestIdleCallback', {
      value: () => 1,
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

  it('registrerar ZERO conversation_messages-prenumerationer men behåller saved_jobs och job_applications utan interviews', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );

    // Låt effekter/microtasks sätta upp subscriptions.
    await new Promise((r) => setTimeout(r, 50));

    const conversationMessageRegs = registrations.filter(
      (r) => r.table === 'conversation_messages',
    );
    const savedJobsRegs = registrations.filter((r) => r.table === 'saved_jobs');
    const applicationsRegs = registrations.filter(
      (r) => r.table === 'job_applications',
    );
    const interviewsRegs = registrations.filter((r) => r.table === 'interviews');

    // Kanonisk väg är ConversationsProvider/useConversations — ingen
    // conversation_messages-subscription får registreras här.
    expect(conversationMessageRegs).toHaveLength(0);

    // De användarfiltrerade kanalerna ska fortfarande finnas kvar.
    expect(savedJobsRegs).toHaveLength(1);
    expect(savedJobsRegs[0].filter).toBe('user_id=eq.job-seeker-user-123');
    expect(applicationsRegs).toHaveLength(1);
    expect(applicationsRegs[0].filter).toBe('applicant_id=eq.job-seeker-user-123');
    // Kanonisk realtime-ägare för intervjuer är useCandidateInterviews
    // (src/hooks/useInterviews.ts) — ingen intervju-subscription här.
    expect(interviewsRegs).toHaveLength(0);
  });

  it('registrerar ZERO profiles- och ZERO ofiltrerade job_postings INSERT-prenumerationer', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );

    await new Promise((r) => setTimeout(r, 50));

    const profilesRegs = registrations.filter((r) => r.table === 'profiles');
    const unfilteredJobPostingInserts = registrations.filter(
      (r) => r.table === 'job_postings' && r.event === 'INSERT' && !r.filter,
    );

    // Profiler uppdateras via kanoniska job_postings-prenumerationer och
    // DB-triggers — ingen direkt profiles-subscription ska finnas här.
    expect(profilesRegs).toHaveLength(0);

    // Home får inte bära någon global, ofiltrerad new-job-listener:
    // read-amplification per jobbsökare vid varje ny annons.
    expect(unfilteredJobPostingInserts).toHaveLength(0);
  });
});

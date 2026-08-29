/**
 * RED-test: useJobSeekerBackgroundSync ska INTE registrera någon
 * conversation_messages-prenumeration — den globala ConversationsProvider/
 * useConversations är den kanoniska vägen för meddelande-realtime.
 *
 * Önskat beteende (GREEN): 0 st conversation_messages-registreringar,
 * medan användarfiltrerade saved_jobs / job_applications / interviews
 * fortfarande registreras.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const registrations: Array<{ table?: string; filter?: string }> = [];
const removedChannels: string[] = [];

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (name: string) => {
    const channel: any = {
      name,
      on: (_event: string, opts: any) => {
        registrations.push({ table: opts?.table, filter: opts?.filter });
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    removeChannel: vi.fn((channel: any) => {
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
    (window as any).requestIdleCallback = () => 1;
    (window as any).cancelIdleCallback = () => undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registrerar ZERO conversation_messages-prenumerationer men behåller saved_jobs, job_applications och interviews', async () => {
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
    expect(interviewsRegs).toHaveLength(1);
    expect(interviewsRegs[0].filter).toBe('applicant_id=eq.job-seeker-user-123');
  });
});

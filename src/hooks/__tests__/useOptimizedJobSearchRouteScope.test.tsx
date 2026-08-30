/**
 * RED-test: useOptimizedJobSearch får inte hålla en global, ofiltrerad
 * job_postings INSERT-lyssnare aktiv när Search är dold (t.ex. när användaren
 * är tillbaka på Home men KeepAlive fortfarande håller Search monterad).
 *
 * Önskat beteende (GREEN):
 * - realtimeEnabled=false → noll job_postings-kanaler och ingen refresh
 * - realtimeEnabled=true  → nuvarande synliga Search-lyssnare finns kvar
 * - återaktivering → högst EN kontrollerad refresh för att hämta ikapp
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Registration {
  channel: string;
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
          channel: name,
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
    rpc: vi.fn(async () => ({ data: [], error: null })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'job-seeker-user-123' }, userRole: { role: 'job_seeker' } }),
}));

import { useOptimizedJobSearch } from '@/hooks/useOptimizedJobSearch';

function Probe({ realtimeEnabled }: { realtimeEnabled: boolean }) {
  useOptimizedJobSearch({
    searchQuery: '',
    city: '',
    employmentTypes: [],
    category: '',
    subcategories: [],
    enabled: false,
    realtimeEnabled,
  });
  return null;
}

function jobPostingChannels() {
  return registrations.filter((r) => r.table === 'job_postings');
}

describe('useOptimizedJobSearch route-scoped realtime', () => {
  beforeEach(() => {
    registrations.length = 0;
    removedChannels.length = 0;
  });

  it('skapar noll job_postings-kanaler när realtime är avstängd (dold route)', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <Probe realtimeEnabled={false} />
      </QueryClientProvider>,
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(jobPostingChannels()).toHaveLength(0);
    const searchInvalidations = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify(call[0]).includes('optimized-job-search'),
    );
    expect(searchInvalidations).toHaveLength(0);
  });

  it('behåller den synliga Search-lyssnaren när realtime är på', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <Probe realtimeEnabled />
      </QueryClientProvider>,
    );

    await new Promise((r) => setTimeout(r, 50));

    const inserts = jobPostingChannels().filter((r) => r.event === 'INSERT');
    expect(inserts).toHaveLength(1);
  });

  it('avregistrerar vid döljning och gör högst en refresh vid återaktivering', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <Probe realtimeEnabled />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 20));

    rerender(
      <QueryClientProvider client={queryClient}>
        <Probe realtimeEnabled={false} />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(removedChannels).toContain('optimized-search-new-jobs');
    const afterHide = jobPostingChannels().length;

    rerender(
      <QueryClientProvider client={queryClient}>
        <Probe realtimeEnabled />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 20));

    // Exakt en ny registrering (återanslutning), ingen poll-loop.
    expect(jobPostingChannels().length).toBe(afterHide + 1);

    const searchInvalidations = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify(call[0]).includes('optimized-job-search'),
    );
    expect(searchInvalidations.length).toBeLessThanOrEqual(1);
  });
});

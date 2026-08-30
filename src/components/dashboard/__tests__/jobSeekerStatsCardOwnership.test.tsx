/**
 * RED → GREEN: JobSeekerStatsCard äger inte längre saved/app-realtime och
 * gör inget dashboard-RPC när kortet är inaktivt (dold Home under KeepAlive).
 * AuthProvider är enda globala ägaren av de användarfiltrerade lyssnarna.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  registrations: [] as Array<{ table: string; filter: string }>,
  statsCalls: [] as string[],
  carouselProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/realtimeChannel', () => ({
  createRealtimeChannel: (_name: string) => {
    const channel = {
      on: (_e: string, opts: Record<string, unknown>) => {
        h.registrations.push({
          table: String(opts?.table ?? ''),
          filter: String(opts?.filter ?? ''),
        });
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { removeChannel: vi.fn(), from: () => ({}) },
}));

let currentUserId = 'js-1';
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: currentUserId } }),
}));

vi.mock('@/contexts/ConversationsContext', () => ({
  useConversationsContext: () => ({ totalUnreadCount: 3 }),
}));

vi.mock('@/hooks/useProfileViewStats', () => ({
  useProfileViewStats: () => ({ stats: { unique_viewers_30d: 7 }, isSuccess: true }),
}));

vi.mock('@/lib/jobseekerDashboardStats', () => ({
  fetchJobseekerDashboardStats: async (userId: string) => {
    h.statsCalls.push(userId);
    return { applications: 4, saved_jobs: 5, unread_messages: 2 };
  },
}));

vi.mock('../StatsCarousel', () => ({
  StatsCarousel: (props: Record<string, unknown>) => {
    h.carouselProps.push(props);
    return <div data-testid="stats-carousel" />;
  },
}));

import { JobSeekerStatsCard } from '../JobSeekerStatsCard';

const renderCard = (isActive: boolean) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <JobSeekerStatsCard isPaused={false} setIsPaused={() => {}} isActive={isActive} />
    </QueryClientProvider>,
  );
  const rerenderActive = (next: boolean) =>
    utils.rerender(
      <QueryClientProvider client={client}>
        <JobSeekerStatsCard isPaused={false} setIsPaused={() => {}} isActive={next} />
      </QueryClientProvider>,
    );
  return { ...utils, rerenderActive };
};

const settle = async (ms = 40) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

describe('JobSeekerStatsCard — ägarskap och aktivitetsgating', () => {
  beforeEach(() => {
    localStorage.clear();
    currentUserId = 'js-1';
    h.registrations.length = 0;
    h.statsCalls.length = 0;
    h.carouselProps.length = 0;
  });

  afterEach(() => cleanup());

  it('registrerar NOLL saved_jobs- och job_applications-lyssnare', async () => {
    renderCard(true);
    await settle();
    expect(h.registrations.filter((r) => r.table === 'saved_jobs')).toHaveLength(0);
    expect(h.registrations.filter((r) => r.table === 'job_applications')).toHaveLength(0);
  });

  it('isActive=false: ingen dashboard-RPC och ingen reaktion på visibility', async () => {
    renderCard(false);
    await settle();
    expect(h.statsCalls).toHaveLength(0);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(h.statsCalls).toHaveLength(0);
  });

  it('false → true: hämtar exakt aktuell användares data en gång', async () => {
    const { rerenderActive } = renderCard(false);
    await settle();
    expect(h.statsCalls).toHaveLength(0);

    rerenderActive(true);
    await waitFor(() => expect(h.statsCalls).toHaveLength(1));
    expect(h.statsCalls[0]).toBe('js-1');
  });

  it('aktiv komponent behåller värden och props till karusellen', async () => {
    renderCard(true);
    await waitFor(() => expect(h.statsCalls).toHaveLength(1));
    await settle();

    const last = h.carouselProps[h.carouselProps.length - 1];
    expect(last.isActive).toBe(true);
    expect(last.isPaused).toBe(false);
    const stats = last.stats as Array<{ label: string; value: number }>;
    expect(stats.map((s) => s.label)).toEqual([
      'Skickade ansökningar',
      'Bokade intervjuer',
      'Profilvisningar',
      'Sparade jobb',
      'Meddelanden',
    ]);
    expect(stats[0].value).toBe(4);
    expect(stats[2].value).toBe(7);
    expect(stats[3].value).toBe(5);
    expect(stats[4].value).toBe(3);
  });
});

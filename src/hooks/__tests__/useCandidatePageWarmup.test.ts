import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const calls: { details: boolean[]; media: boolean[]; cv: number[] } = {
  details: [],
  media: [],
  cv: [],
};

vi.mock('@/hooks/useCandidateRowDetailsWarmup', () => ({
  useCandidateRowDetailsWarmup: (_rows: unknown, enabled: boolean) => {
    calls.details.push(enabled);
  },
}));
vi.mock('@/hooks/useCandidateRowMediaWarmup', () => ({
  useCandidateRowMediaWarmup: (_rows: unknown, enabled: boolean) => {
    calls.media.push(enabled);
  },
}));
vi.mock('@/hooks/useCvSummaryPreloader', () => ({
  useCvSummaryPreloader: (rows: unknown[]) => {
    calls.cv.push(rows.length);
  },
}));

import { useCandidatePageWarmup } from '@/hooks/useCandidatePageWarmup';

const last = <T,>(arr: T[]): T | undefined => arr[arr.length - 1];

const rows = [
  { id: 'a1', applicant_id: 'u1', job_id: 'j1', cv_url: 'cv1.pdf', profile_image_url: 'p1.jpg' },
  { id: 'a2', applicant_id: 'u2', job_id: 'j1', cv_url: null, profile_image_url: null },
];

describe('useCandidatePageWarmup', () => {
  beforeEach(() => {
    calls.details = [];
    calls.media = [];
    calls.cv = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('kör text före media före CV-sammanfattningar', () => {
    renderHook(() => useCandidatePageWarmup(rows));

    // Steg 1: text på, media av, inga CV-rader
    expect(last(calls.details)).toBe(true);
    expect(last(calls.media)).toBe(false);
    expect(last(calls.cv)).toBe(0);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(last(calls.media)).toBe(true);
    expect(last(calls.cv)).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(last(calls.cv)).toBe(2);
  });

  it('gör ingenting när pipelinen är avstängd', () => {
    renderHook(() => useCandidatePageWarmup(rows, { enabled: false }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(calls.details.every((v) => v === false)).toBe(true);
    expect(calls.media.every((v) => v === false)).toBe(true);
    expect(last(calls.cv)).toBe(0);
  });

  it('hoppar över AI-steget när cvSummaries är av', () => {
    renderHook(() => useCandidatePageWarmup(rows, { cvSummaries: false }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(last(calls.media)).toBe(true);
    expect(last(calls.cv)).toBe(0);
  });
});

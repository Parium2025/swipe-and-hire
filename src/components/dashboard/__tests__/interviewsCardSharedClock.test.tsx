/**
 * RED: Intervjukortet ska återanvända grid:ets delade klocka (now-prop) i
 * stället för att skapa ett eget minutintervall.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { JobSeekerInterviewsCard } from '@/components/dashboard/JobSeekerInterviewsCard';

describe('JobSeekerInterviewsCard delad klocka', () => {
  let intervalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    intervalSpy = vi.spyOn(globalThis, 'setInterval');
  });

  afterEach(() => {
    intervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('skapar inget eget minutintervall när now skickas in', () => {
    render(
      <MemoryRouter>
        <JobSeekerInterviewsCard
          interviews={[
            {
              id: 'i1',
              scheduled_at: new Date(Date.now() + 3600_000).toISOString(),
              duration_minutes: 30,
              location_type: 'phone',
              job_title: 'Utvecklare',
              company_name: 'Parium',
            } as never,
          ]}
          isLoading={false}
          now={Date.now()}
        />
      </MemoryRouter>,
    );

    vi.advanceTimersByTime(3 * 60_000);

    const minuteIntervals = intervalSpy.mock.calls.filter((call) => Number(call[1]) === 60_000);
    expect(minuteIntervals).toHaveLength(0);
  });
});

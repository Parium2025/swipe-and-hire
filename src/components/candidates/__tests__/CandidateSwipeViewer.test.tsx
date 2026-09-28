import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateSwipeViewer } from '../CandidateSwipeViewer';
import type { ApplicationData } from '@/hooks/useApplicationsData';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 100 })),
    getTotalSize: () => count * 100,
    scrollToIndex: vi.fn(),
    measure: vi.fn(),
  }),
}));
vi.mock('@/hooks/useMediaPreloader', () => ({ useMediaPreloader: vi.fn() }));
vi.mock('@/lib/viewedApplicationsSession', () => ({ markViewedInSession: vi.fn() }));
vi.mock('../CandidateSlide', () => ({
  CandidateSlide: ({ application, onSkip }: { application: ApplicationData; onSkip: () => void }) => (
    <button onClick={onSkip}>Hoppa över {application.first_name}</button>
  ),
}));
vi.mock('../CandidateSlideActions', () => ({
  CandidateSlideActions: () => <div>Åtgärder</div>,
}));

const application: ApplicationData = {
  id: 'application-1',
  job_id: 'job-1',
  applicant_id: 'candidate-1',
  first_name: 'Anna',
  last_name: 'Andersson',
  email: null,
  phone: null,
  location: 'Stockholm',
  bio: null,
  cv_url: null,
  age: 31,
  employment_status: null,
  work_schedule: null,
  availability: null,
  status: 'pending',
  applied_at: '2026-09-19T12:00:00Z',
  updated_at: '2026-09-19T12:00:00Z',
  custom_answers: null,
  profile_image_url: null,
  video_url: null,
  cover_image_url: null,
  is_profile_video: false,
};

describe('CandidateSwipeViewer', () => {
  afterEach(() => vi.useRealTimers());

  it('behåller den enda kandidaten i stället för att lämna en tom vy', () => {
    vi.useFakeTimers();
    render(
      <CandidateSwipeViewer
        applications={[application]}
        initialIndex={0}
        open
        onClose={vi.fn()}
        onOpenFullProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hoppa över Anna' }));
    act(() => vi.runAllTimers());

    expect(screen.getByRole('button', { name: 'Hoppa över Anna' })).toBeTruthy();
    expect(screen.queryByText('Inga fler kandidater just nu')).toBeNull();
  });
});
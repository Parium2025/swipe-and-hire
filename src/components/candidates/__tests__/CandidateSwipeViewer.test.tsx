import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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
const markServer = vi.fn((_id: string) => Promise.resolve());
vi.mock('@/lib/viewedApplicationsSession', () => ({ markViewedInSession: vi.fn(), wasViewedInSession: vi.fn(() => false) }));
vi.mock('@/lib/applicationViews', () => ({ markApplicationViewedForMe: (id: string) => markServer(id) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('../CandidateSlide', () => ({
  CandidateSlide: ({ application, onSwipeLeft }: { application: ApplicationData; onSwipeLeft: () => void }) => (
    <button onClick={onSwipeLeft}>Hoppa över {application.first_name}</button>
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
  it('sparar visningen på servern så att annonsens "nya"-räknare sjunker live', () => {
    markServer.mockClear();
    render(
      <MemoryRouter>
        <CandidateSwipeViewer
          applications={[{ id: 'app-x', applicant_id: 'u-x' } as unknown as ApplicationData]}
          initialIndex={0}
          open
          onClose={() => undefined}
          onOpenFullProfile={() => undefined}
          getDisplayRating={() => 0}
        />
      </MemoryRouter>,
    );
    expect(markServer).toHaveBeenCalledWith('app-x');
  });

  afterEach(() => vi.useRealTimers());

  it('sista kandidaten ger "Inga fler kandidater", 0/0 och fungerande Ångra', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <CandidateSwipeViewer
          applications={[application]}
          initialIndex={0}
          open
          onClose={vi.fn()}
          onOpenFullProfile={vi.fn()}
          getDisplayRating={() => 0}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hoppa över Anna' }));
    act(() => vi.runAllTimers());

    expect(screen.queryByRole('button', { name: 'Hoppa över Anna' })).toBeNull();
    expect(screen.getByText('Inga fler kandidater just nu')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ångra senaste nekandet' }));
    act(() => vi.runAllTimers());

    expect(screen.getByRole('button', { name: 'Hoppa över Anna' })).toBeTruthy();
    expect(screen.queryByText('Inga fler kandidater just nu')).toBeNull();
  });

  it('nekad sista av två flyttar scrollen till kvarvarande kandidat (ingen tom yta)', () => {
    vi.useFakeTimers();
    const second = { ...application, id: 'application-2', first_name: 'Bo' };
    const { container } = render(
      <MemoryRouter>
        <CandidateSwipeViewer
          applications={[application, second]}
          initialIndex={1}
          open
          onClose={vi.fn()}
          onOpenFullProfile={vi.fn()}
          getDisplayRating={() => 0}
        />
      </MemoryRouter>,
    );
    const scroller = document.body.querySelector('.overflow-y-auto') as HTMLDivElement;
    scroller.scrollTop = 800;
    fireEvent.click(screen.getByRole('button', { name: 'Hoppa över Bo' }));
    act(() => vi.runAllTimers());
    expect(scroller.scrollTop).toBe(0);
    expect(screen.getByRole('button', { name: 'Hoppa över Anna' })).toBeTruthy();
    expect(container).toBeTruthy();
  });
});

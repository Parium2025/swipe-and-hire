import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateSlide } from '../CandidateSlide';
import type { ApplicationData } from '@/hooks/useApplicationsData';

vi.mock('@/hooks/useMediaUrl', () => ({ useMediaUrl: (url: string | null) => url }));
vi.mock('@/hooks/useCandidateSummary', () => ({ useCandidateSummary: vi.fn() }));
vi.mock('@/hooks/useCandidateNotes', () => ({
  useCandidateNotes: () => ({ fetchNotes: vi.fn() }),
}));
vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn() }));
vi.mock('../CandidateCardFace', () => ({
  CandidateCardFace: ({ fullBleed }: { fullBleed?: boolean }) => (
    <div data-testid="candidate-media" data-full-bleed={String(Boolean(fullBleed))}>Kandidatmedia</div>
  ),
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
  status: null,
  applied_at: '2026-09-19T12:00:00Z',
  updated_at: '2026-09-19T12:00:00Z',
  custom_answers: null,
  profile_image_url: 'https://example.com/profile.jpg',
  video_url: null,
  cover_image_url: null,
  is_profile_video: false,
};

const touch = (clientX: number, clientY: number) => ({ clientX, clientY });

describe('CandidateSlide employer swipe', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('byter aldrig kandidat av ett drag i sidled', () => {
    vi.useFakeTimers();
    const onSkip = vi.fn();
    const { container } = render(
      <CandidateSlide
        application={application}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={vi.fn()}
        onSkip={onSkip}
      />,
    );
    const card = container.querySelector('[data-candidate-swipe-card]');
    expect(card).not.toBeNull();

    fireEvent.touchStart(card as Element, { touches: [touch(340, 220)] });
    fireEvent.touchMove(card as Element, { touches: [touch(190, 224)] });
    fireEvent.touchEnd(card as Element, { changedTouches: [touch(190, 224)] });
    act(() => vi.advanceTimersByTime(250));

    expect(onSkip).not.toHaveBeenCalled();

    fireEvent.touchStart(card as Element, { touches: [touch(120, 220)] });
    fireEvent.touchMove(card as Element, { touches: [touch(320, 224)] });
    fireEvent.touchEnd(card as Element, { changedTouches: [touch(320, 224)] });
    act(() => vi.advanceTimersByTime(250));

    expect(onSkip).not.toHaveBeenCalled();
  });

  it('använder alltid helkortsläget och aldrig den runda profilvarianten', () => {
    const { getByTestId } = render(
      <CandidateSlide
        application={application}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(getByTestId('candidate-media').getAttribute('data-full-bleed')).toBe('true');
  });

  it('låter ett vertikalt drag fortsätta utan att byta kandidat', () => {
    vi.useFakeTimers();
    const onSkip = vi.fn();
    const { container } = render(
      <CandidateSlide
        application={application}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={vi.fn()}
        onSkip={onSkip}
      />,
    );
    const card = container.querySelector('[data-candidate-swipe-card]');

    fireEvent.touchStart(card as Element, { touches: [touch(250, 180)] });
    fireEvent.touchMove(card as Element, { touches: [touch(242, 330)] });
    fireEvent.touchEnd(card as Element, { changedTouches: [touch(242, 330)] });
    act(() => vi.advanceTimersByTime(300));

    expect(onSkip).not.toHaveBeenCalled();
  });

  it('stoppar iOS långtrycksmeny och bilddragning på kortet', () => {
    const { container } = render(
      <CandidateSlide
        application={application}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    const card = container.querySelector('[data-candidate-swipe-card]');
    expect(card).not.toBeNull();

    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    card?.dispatchEvent(contextMenu);
    card?.dispatchEvent(dragStart);

    expect(contextMenu.defaultPrevented).toBe(true);
    expect(dragStart.defaultPrevented).toBe(true);
  });
});
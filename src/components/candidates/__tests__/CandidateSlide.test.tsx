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
  CandidateCardFace: ({ fullBleed, profileImageUrl, coverImageUrl, videoUrl, hasVideo }: { fullBleed?: boolean; profileImageUrl?: string | null; coverImageUrl?: string | null; videoUrl?: string | null; hasVideo?: boolean }) => (
    <div
      data-testid="candidate-media"
      data-full-bleed={String(Boolean(fullBleed))}
      data-profile-image={profileImageUrl || ''}
      data-cover-image={coverImageUrl || ''}
      data-video={videoUrl || ''}
      data-has-video={String(Boolean(hasVideo))}
    >Kandidatmedia</div>
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

  it('hoppar över åt vänster och öppnar information åt höger', () => {
    vi.useFakeTimers();
    const onSkip = vi.fn();
    const onOpenFullProfile = vi.fn();
    const { container } = render(
      <CandidateSlide
        application={application}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={onOpenFullProfile}
        onSkip={onSkip}
      />,
    );
    const card = container.querySelector('[data-candidate-swipe-card]');
    expect(card).not.toBeNull();

    fireEvent.touchStart(card as Element, { touches: [touch(340, 220)] });
    fireEvent.touchMove(card as Element, { touches: [touch(190, 224)] });
    fireEvent.touchEnd(card as Element, { changedTouches: [touch(190, 224)] });
    act(() => vi.advanceTimersByTime(250));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onOpenFullProfile).not.toHaveBeenCalled();

    const secondRender = render(
      <CandidateSlide
        application={{ ...application, id: 'application-2' }}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={onOpenFullProfile}
        onSkip={onSkip}
      />,
    );
    const secondCard = secondRender.container.querySelector('[data-candidate-swipe-card]');
    fireEvent.touchStart(secondCard as Element, { touches: [touch(120, 220)] });
    fireEvent.touchMove(secondCard as Element, { touches: [touch(320, 224)] });
    fireEvent.touchEnd(secondCard as Element, { changedTouches: [touch(320, 224)] });
    act(() => vi.advanceTimersByTime(250));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onOpenFullProfile).toHaveBeenCalledTimes(1);
  });

  it('visar samma röda och gröna dragfeedback som jobbsökarens swipe-läge', () => {
    const { container, getByText } = render(
      <CandidateSlide
        application={application}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(getByText('Visa info')).toBeTruthy();
    expect(getByText('Hoppa över')).toBeTruthy();
    expect(container.querySelector('[data-candidate-swipe-card]')).not.toBeNull();
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

  it('skickar ansökans anpassade videoomslag till helkortet', () => {
    const { getByTestId } = render(
      <CandidateSlide
        application={{
          ...application,
          video_url: 'snapshot-video.mp4',
          cover_image_url: 'snapshot-cover.jpg',
          is_profile_video: true,
        }}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={vi.fn()}
      />,
    );

    expect(getByTestId('candidate-media').getAttribute('data-profile-image')).toBe('https://example.com/profile.jpg');
    expect(getByTestId('candidate-media').getAttribute('data-cover-image')).toBe('snapshot-cover.jpg');
    expect(getByTestId('candidate-media').getAttribute('data-video')).toBe('snapshot-video.mp4');
    expect(getByTestId('candidate-media').getAttribute('data-has-video')).toBe('true');
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

  it('är fullt interaktivt igen efter ångra-animationen', () => {
    vi.useFakeTimers();
    const onSkip = vi.fn();
    const onOpenFullProfile = vi.fn();
    const { container, rerender } = render(
      <CandidateSlide
        application={application}
        rating={0}
        isVisible
        isActive
        onOpenFullProfile={onOpenFullProfile}
        onSkip={onSkip}
      />,
    );
    const card = container.querySelector('[data-candidate-swipe-card]');

    fireEvent.touchStart(card as Element, { touches: [touch(340, 220)] });
    fireEvent.touchMove(card as Element, { touches: [touch(190, 224)] });
    fireEvent.touchEnd(card as Element, { changedTouches: [touch(190, 224)] });
    act(() => vi.advanceTimersByTime(250));
    expect(onSkip).toHaveBeenCalledTimes(1);

    rerender(
      <CandidateSlide
        application={application}
        rating={0}
        isVisible
        isActive
        isUndoEntry
        onOpenFullProfile={onOpenFullProfile}
        onSkip={onSkip}
      />,
    );

    fireEvent.touchStart(card as Element, { touches: [touch(120, 220)] });
    fireEvent.touchMove(card as Element, { touches: [touch(320, 224)] });
    fireEvent.touchEnd(card as Element, { changedTouches: [touch(320, 224)] });

    expect(onOpenFullProfile).toHaveBeenCalledTimes(1);
  });
});
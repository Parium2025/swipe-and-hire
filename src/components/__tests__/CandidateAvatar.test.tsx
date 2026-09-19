import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateAvatar } from '@/components/CandidateAvatar';

vi.mock('@/hooks/useMediaUrl', () => ({
  useMediaUrl: (path: string | null | undefined) => path || null,
}));

vi.mock('@/components/ProfileVideo', () => ({
  default: ({ coverImageUrl }: { coverImageUrl?: string }) => (
    <div data-testid="profile-video" data-cover-image={coverImageUrl || ''} />
  ),
}));

describe('CandidateAvatar media fallback', () => {
  afterEach(cleanup);

  it('visar covern när videoprofilens video tillfälligt saknas', () => {
    const { container } = render(
      <CandidateAvatar
        profileImageUrl={null}
        coverImageUrl="video-cover.jpg"
        videoUrl={null}
        isProfileVideo
        firstName="Josefine"
        lastName="Almqvist"
      />,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('video-cover.jpg');
  });

  it('prioriterar covern framför profilbilden för videoprofiler', () => {
    render(
      <CandidateAvatar
        profileImageUrl="profile.jpg"
        coverImageUrl="video-cover.jpg"
        videoUrl="video.mp4"
        isProfileVideo
        firstName="Josefine"
        lastName="Almqvist"
      />,
    );

    expect(screen.getByTestId('profile-video').getAttribute('data-cover-image')).toBe('video-cover.jpg');
  });
});
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateCardFace } from '../CandidateCardFace';

vi.mock('@/components/ProfileVideo', () => ({
  default: ({ coverImageUrl }: { coverImageUrl?: string }) => (
    <div data-testid="profile-video" data-cover-image={coverImageUrl || ''} />
  ),
}));

vi.mock('@/components/ProfileVideoCircle', () => ({
  default: ({ coverImageUrl }: { coverImageUrl?: string }) => (
    <div data-testid="profile-video-circle" data-cover-image={coverImageUrl || ''} />
  ),
}));

describe('CandidateCardFace media priority', () => {
  afterEach(cleanup);

  it('prioriterar kandidatens anpassade cover framför profilbilden för video i Swipe Mode', () => {
    const { getByTestId } = render(
      <CandidateCardFace
        firstName="Anna"
        lastName="Andersson"
        profileImageUrl="older-profile.jpg"
        coverImageUrl="adjusted-video-cover.jpg"
        videoUrl="profile-video.mp4"
        hasVideo
        fullBleed
      />,
    );

    expect(getByTestId('profile-video').getAttribute('data-cover-image')).toBe('adjusted-video-cover.jpg');
  });

  it('behåller profilbilden som första val när kandidaten inte har video', () => {
    const { container } = render(
      <CandidateCardFace
        firstName="Anna"
        lastName="Andersson"
        profileImageUrl="profile.jpg"
        coverImageUrl="cover.jpg"
        fullBleed
      />,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('profile.jpg');
  });
});
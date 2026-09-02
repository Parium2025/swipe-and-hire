import { describe, it, expect } from 'vitest';
import { resolveCandidateMedia } from '@/lib/candidateMedia';

/**
 * Arbetsgivaren ska bara se den profil som ansökan skickades med.
 * Kontots livemedia får aldrig läcka in i snapshot-eran.
 */
describe('resolveCandidateMedia', () => {
  const live = {
    profile_image_url: 'live-image.jpg',
    video_url: 'live-video.mp4',
    cover_image_url: 'live-cover.jpg',
    is_profile_video: true,
  };

  it('använder ansökans ögonblicksbild när den finns', () => {
    const result = resolveCandidateMedia(
      {
        applied_at: '2026-03-01T10:00:00Z',
        candidate_profile_label: 'Lager',
        profile_image_snapshot_url: 'snap-image.jpg',
        video_snapshot_url: 'snap-video.mp4',
        cover_image_snapshot_url: 'snap-cover.jpg',
      },
      live
    );
    expect(result).toEqual({
      profile_image_url: 'snap-image.jpg',
      video_url: 'snap-video.mp4',
      cover_image_url: 'snap-cover.jpg',
      is_profile_video: true,
    });
  });

  it('visar tomt när vald profil saknar media (livemedia läcker inte in)', () => {
    const result = resolveCandidateMedia(
      {
        applied_at: '2026-03-01T10:00:00Z',
        candidate_profile_label: 'Utan media',
        profile_image_snapshot_url: null,
        video_snapshot_url: null,
      },
      live
    );
    expect(result.profile_image_url).toBeNull();
    expect(result.video_url).toBeNull();
    expect(result.is_profile_video).toBe(false);
  });

  it('faller tillbaka på livemedia för ansökningar före snapshot-eran', () => {
    const result = resolveCandidateMedia(
      { applied_at: '2025-11-01T10:00:00Z' },
      live
    );
    expect(result).toEqual(live);
  });

  it('behandlar ansökningar efter 2026-02-05 som snapshot-era även utan etikett', () => {
    const result = resolveCandidateMedia({ applied_at: '2026-02-06T00:00:00Z' }, live);
    expect(result.profile_image_url).toBeNull();
    expect(result.video_url).toBeNull();
  });

  it('klarar saknad ansökan och saknat livemedia', () => {
    expect(resolveCandidateMedia(null, null)).toEqual({
      profile_image_url: null,
      video_url: null,
      cover_image_url: null,
      is_profile_video: null,
    });
  });
});

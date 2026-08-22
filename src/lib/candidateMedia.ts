/**
 * Media-upplösning för arbetsgivarvyer.
 *
 * Regel: arbetsgivaren ser ENBART den kandidatprofil som ansökan skickades med
 * (snapshot på job_applications). Valde jobbsökaren en profil utan bild/video
 * ska det vara tomt — då visas initialer. Kontots livemedia får aldrig läcka in.
 *
 * Undantag: ansökningar som skapades innan snapshot-kolumnerna fanns
 * (2026-02-05) saknar snapshot helt — där faller vi tillbaka på livemedia så att
 * historiska kandidater inte plötsligt tappar bild/video.
 */

const SNAPSHOT_ERA_START = Date.parse('2026-02-05T00:00:00Z');

export interface CandidateMedia {
  profile_image_url: string | null;
  video_url: string | null;
  is_profile_video: boolean | null;
}

export interface ApplicationSnapshotFields {
  applied_at?: string | null;
  created_at?: string | null;
  candidate_profile_label?: string | null;
  profile_image_snapshot_url?: string | null;
  video_snapshot_url?: string | null;
}

export function resolveCandidateMedia(
  app: ApplicationSnapshotFields | null | undefined,
  live: Partial<CandidateMedia> | null | undefined
): CandidateMedia {
  const image = app?.profile_image_snapshot_url ?? null;
  const video = app?.video_snapshot_url ?? null;

  const appliedAt = app?.applied_at || app?.created_at || null;
  const isSnapshotEra =
    Boolean(app?.candidate_profile_label) ||
    image !== null ||
    video !== null ||
    (appliedAt ? Date.parse(appliedAt) >= SNAPSHOT_ERA_START : false);

  if (isSnapshotEra) {
    return {
      profile_image_url: image,
      video_url: video,
      is_profile_video: video ? true : false,
    };
  }

  return {
    profile_image_url: live?.profile_image_url ?? null,
    video_url: live?.video_url ?? null,
    is_profile_video: live?.is_profile_video ?? null,
  };
}

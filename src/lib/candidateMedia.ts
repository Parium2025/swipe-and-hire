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

// Kolumnerna lades till i februari, men äldre klienter fortsatte skapa
// ansökningar utan snapshot-data långt därefter. Först när databastriggern
// infördes 2026-09-02 blev en helt tom snapshot ett tillförlitligt, avsiktligt
// läge. Före det datumet måste tomma snapshots falla tillbaka på livemedia.
const AUTHORITATIVE_EMPTY_SNAPSHOT_START = Date.parse('2026-09-02T08:17:57Z');

export interface CandidateMedia {
  profile_image_url: string | null;
  video_url: string | null;
  cover_image_url: string | null;
  is_profile_video: boolean | null;
}

export interface ApplicationSnapshotFields {
  applied_at?: string | null;
  created_at?: string | null;
  candidate_profile_label?: string | null;
  profile_image_snapshot_url?: string | null;
  video_snapshot_url?: string | null;
  cover_image_snapshot_url?: string | null;
}

export function resolveCandidateMedia(
  app: ApplicationSnapshotFields | null | undefined,
  live: Partial<CandidateMedia> | null | undefined
): CandidateMedia {
  const image = app?.profile_image_snapshot_url ?? null;
  const video = app?.video_snapshot_url ?? null;
  const cover = app?.cover_image_snapshot_url ?? null;

  const appliedAt = app?.applied_at || app?.created_at || null;
  const hasExplicitSnapshot =
    Boolean(app?.candidate_profile_label) ||
    image !== null ||
    video !== null ||
    cover !== null;
  const hasAuthoritativeEmptySnapshot = appliedAt
    ? Date.parse(appliedAt) >= AUTHORITATIVE_EMPTY_SNAPSHOT_START
    : false;

  if (hasExplicitSnapshot || hasAuthoritativeEmptySnapshot) {
    return {
      profile_image_url: image,
      video_url: video,
      cover_image_url: cover,
      is_profile_video: video ? true : false,
    };
  }

  return {
    profile_image_url: live?.profile_image_url ?? null,
    video_url: live?.video_url ?? null,
    cover_image_url: live?.cover_image_url ?? null,
    is_profile_video: live?.is_profile_video ?? null,
  };
}

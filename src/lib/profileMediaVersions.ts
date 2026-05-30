/**
 * Spårar kandidatens media-versioner (image_updated_at / video_updated_at) lokalt
 * och rensar signed-URL-cachen automatiskt när en version bumpas på servern.
 *
 * Detta gör att en arbetsgivare ser kandidatens NYA profilbild inom sekunder
 * (vid nästa data-refresh) utan att vi behöver bryta 24h-cachen för alla
 * andra kandidaters bilder.
 */
import { clearMediaUrlCache } from '@/hooks/useMediaUrl';

const STORAGE_KEY = 'parium_profile_media_versions_v1';

type VersionMap = Record<string, { image?: string | null; video?: string | null }>;

function readMap(): VersionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as VersionMap;
  } catch {
    return {};
  }
}

function writeMap(map: VersionMap) {
  try {
    // Trimma storleken – behåll max 2000 entries
    const keys = Object.keys(map);
    let trimmed: VersionMap = map;
    if (keys.length > 2000) {
      trimmed = {};
      keys.slice(-2000).forEach((k) => {
        trimmed[k] = map[k];
      });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota
  }
}

export interface MediaVersionRow {
  applicant_id: string;
  profile_image_url: string | null | undefined;
  video_url: string | null | undefined;
  image_updated_at?: string | null;
  video_updated_at?: string | null;
}

/**
 * Jämför inkommande versioner mot lokalt sparade. Om någon version skiljer sig
 * rensas just den mediets signed-URL- och blob-cache så att nästa render hämtar
 * den färska bilden. Sparar sedan nya versioner.
 */
export function syncProfileMediaVersions(rows: MediaVersionRow[]) {
  if (!rows || rows.length === 0) return;
  const map = readMap();
  let changed = false;

  for (const row of rows) {
    const prev = map[row.applicant_id] || {};
    const newImageV = row.image_updated_at ?? null;
    const newVideoV = row.video_updated_at ?? null;

    if (prev.image && newImageV && prev.image !== newImageV && row.profile_image_url) {
      clearMediaUrlCache(row.profile_image_url, 'profile-image');
    }
    if (prev.video && newVideoV && prev.video !== newVideoV && row.video_url) {
      clearMediaUrlCache(row.video_url, 'profile-video');
    }

    if (prev.image !== newImageV || prev.video !== newVideoV) {
      map[row.applicant_id] = { image: newImageV, video: newVideoV };
      changed = true;
    }
  }

  if (changed) writeMap(map);
}

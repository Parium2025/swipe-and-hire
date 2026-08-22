/**
 * Central källa för alla media-transformationer i kandidatflödet.
 *
 * Signed-URL-cachen nycklas på (path + mediaType + transform). Om en warmup
 * använder en annan transform än komponenten som renderar bilden blir cachen
 * värdelös och avataren hinner visa initialer innan bilden dyker upp.
 * Därför MÅSTE alla prefetchers och komponenter använda konstanterna här.
 */
import type { ImageTransformOptions } from '@/lib/mediaManager';

/** Storleken CandidateAvatar/topbar-avatarer renderar (40px CSS, 2x hanteras av Supabase). */
export const AVATAR_TRANSFORM: ImageTransformOptions = {
  width: 40,
  height: 40,
  resize: 'cover',
};

/** Större variant som används i profil-dialoger och kort. */
export const PROFILE_IMAGE_TRANSFORM: ImageTransformOptions = {
  width: 200,
  height: 200,
  resize: 'cover',
};

/**
 * Stora runda porträttet i kandidatprofilen (192px CSS → 2x = 384).
 * Egen konstant så prefetch och render delar cache-nyckel.
 */
export const PROFILE_DIALOG_TRANSFORM: ImageTransformOptions = {
  width: 400,
  height: 400,
  resize: 'cover',
};


/** Standard-livslängd på signerade URL:er (24h). */
export const MEDIA_URL_TTL = 86400;

/**
 * Chattavatarer renderas i 32/40/48 px. Vi använder EN gemensam 48px-variant
 * för alla storlekar så att prefetch och render delar cache-nyckel
 * (cachen nycklas på path + mediaType + transform).
 */
export const CHAT_AVATAR_TRANSFORM: ImageTransformOptions = {
  width: 48,
  height: 48,
  resize: 'cover',
};

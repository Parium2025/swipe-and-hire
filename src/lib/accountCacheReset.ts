/**
 * 🔒 Kontobunden cache-återställning.
 *
 * En SPA-session kan innehålla varm cache från föregående konto:
 * - sessionStorage `parium_*` (Home/nav-räknare, avatar/cover/video-URL:er)
 * - localStorage `job_seeker_interviews_*` (privata mötesplatser/länkar)
 * - localStorage `media_url_*` (signerade URL:er)
 * - modulminne/blob-cache i useMediaUrl
 *
 * Den här modulen är den ENDA synkrona vägen som varje manuell utloggning och
 * varje ägarbyte i auth ska använda.
 */
import { clearPrivateMediaCache } from '@/hooks/useMediaUrl';

export const ACCOUNT_CACHE_OWNER_KEY = 'parium_cache_owner';

/** sessionStorage-prefix som alltid är kontobundna. */
const SESSION_PREFIXES = ['parium_'];

/** localStorage-prefix med privat, kontobunden data. */
const LOCAL_PREFIXES = ['job_seeker_interviews_', 'media_url_'];

export function getAccountCacheOwner(): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(ACCOUNT_CACHE_OWNER_KEY);
  } catch {
    return null;
  }
}

/**
 * Rensar all kontobunden cache synkront. Sätter (eller rensar) ägaren.
 */
export function resetAccountScopedCaches(nextOwnerId: string | null = null): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage)
        .filter((key) => SESSION_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .forEach((key) => sessionStorage.removeItem(key));
    }
  } catch {
    // ignore storage errors
  }

  try {
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage)
        .filter((key) => LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .forEach((key) => localStorage.removeItem(key));
    }
  } catch {
    // ignore storage errors
  }

  try {
    clearPrivateMediaCache();
  } catch {
    // best effort
  }

  try {
    if (typeof sessionStorage !== 'undefined' && nextOwnerId) {
      sessionStorage.setItem(ACCOUNT_CACHE_OWNER_KEY, nextOwnerId);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Markerar `userId` som ägare av sessionens cache. Om en annan användare ägde
 * cachen rensas den först — varm cache behålls bara vid samma ägare.
 */
export function claimAccountCacheOwner(userId: string | null | undefined): void {
  if (!userId) return;
  const currentOwner = getAccountCacheOwner();
  if (currentOwner === userId) return;

  resetAccountScopedCaches(userId);
}

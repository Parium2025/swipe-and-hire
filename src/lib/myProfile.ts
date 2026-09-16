import { supabase } from '@/integrations/supabase/client';

/**
 * Delad hämtning av den inloggades egen profil (RPC `get_my_profile`).
 *
 * Bakgrund: profilen hämtas från ett dussintal ställen i appen och flera av dem
 * körs samtidigt direkt efter inloggning. Varje anrop blev tidigare en egen
 * databasfråga, vilket gav toppar i svarstid när många loggar in samtidigt.
 *
 * Den här modulen ändrar inte vad appen visar — den ser bara till att
 * samtidiga anrop delar på ETT svar, plus en mycket kort mikro-cache så att
 * anrop som sker inom samma sekund inte träffar databasen på nytt.
 */

type ProfileRpcResult = Awaited<ReturnType<typeof rawFetch>>;

const MICRO_CACHE_MS = 3000;

let inFlight: Promise<ProfileRpcResult> | null = null;
let cached: { at: number; result: ProfileRpcResult } | null = null;

function rawFetch() {
  return supabase.rpc('get_my_profile');
}

export function invalidateMyProfileCache() {
  cached = null;
  inFlight = null;
}

export function fetchMyProfile(options?: { force?: boolean }): Promise<ProfileRpcResult> {
  if (options?.force) {
    cached = null;
  } else if (cached && Date.now() - cached.at < MICRO_CACHE_MS) {
    return Promise.resolve(cached.result);
  }

  if (inFlight) return inFlight;

  inFlight = rawFetch()
    .then((result) => {
      // Cacha aldrig fel — nästa anrop ska få försöka på riktigt igen.
      cached = result.error ? null : { at: Date.now(), result };
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

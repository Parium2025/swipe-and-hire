import { safeSetItem, safeReadJsonCache } from '@/lib/safeStorage';

/**
 * Kallstartsminne för kandidatsiffror (listor och steg).
 *
 * Siffrorna hämtas från databasen, men utan detta minne visades tomma
 * badges den första sekunden efter en kallstart. Här ligger senast kända
 * värde kvar mellan sessioner precis som för sparade jobb och ansökningar.
 */
const PREFIX = 'parium_candidate_counts_v1_';

type Counts = Record<string, number>;

interface Envelope {
  counts: Counts;
  timestamp: number;
}

const isEnvelope = (parsed: unknown): parsed is Envelope => {
  if (!parsed || typeof parsed !== 'object') return false;
  const counts = (parsed as Envelope).counts;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return false;
  return Object.values(counts).every((v) => typeof v === 'number' && Number.isFinite(v));
};

const keyFor = (scope: string, userId: string) => `${PREFIX}${scope}_${userId}`;

export function readCandidateCounts(scope: string, userId: string | undefined): Counts | null {
  if (!userId) return null;
  const parsed = safeReadJsonCache<Envelope>(keyFor(scope, userId), isEnvelope);
  return parsed ? parsed.counts : null;
}

export function writeCandidateCounts(scope: string, userId: string | undefined, counts: Counts) {
  if (!userId) return;
  safeSetItem(keyFor(scope, userId), JSON.stringify({ counts, timestamp: Date.now() }));
}

/** Rensas vid utloggning så nästa konto aldrig ser föregående siffror. */
export function clearCandidateCountsCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  } catch { /* ignore */ }
}

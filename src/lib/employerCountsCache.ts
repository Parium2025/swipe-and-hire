/**
 * Persistent spegel av arbetsgivarens sidomeny-/dashboardsiffror.
 *
 * Siffrorna låg tidigare enbart i sessionStorage, vilket betyder att de
 * försvann vid varje ny flik/kallstart — då renderades menyn helt utan
 * siffror tills servern svarade. Här speglas samma värden i localStorage,
 * kontoskopat så att inga siffror kan läcka mellan konton på samma enhet.
 */

const MIRROR_PREFIX = 'parium_employer_counts_mirror_v1_';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface MirrorEntry {
  values: Record<string, number>;
  timestamp: number;
}

const mirrorKey = (userId: string) => `${MIRROR_PREFIX}${userId}`;

export function readEmployerCountsMirror(userId: string | null | undefined): Record<string, number> {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(mirrorKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MirrorEntry | null;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.timestamp !== 'number') return {};
    if (Date.now() - parsed.timestamp > MAX_AGE_MS) return {};
    const values = parsed.values;
    if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
    return values;
  } catch {
    return {};
  }
}

export function writeEmployerCountsMirrorEntry(
  userId: string | null | undefined,
  key: string,
  value: number,
): void {
  if (!userId || typeof window === 'undefined') return;
  if (!Number.isFinite(value)) return;
  try {
    const values = { ...readEmployerCountsMirror(userId), [key]: value };
    localStorage.setItem(
      mirrorKey(userId),
      JSON.stringify({ values, timestamp: Date.now() } satisfies MirrorEntry),
    );
  } catch {
    /* noop */
  }
}

export function clearEmployerCountsMirror(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      localStorage.removeItem(mirrorKey(userId));
      return;
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(MIRROR_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* noop */
  }
}

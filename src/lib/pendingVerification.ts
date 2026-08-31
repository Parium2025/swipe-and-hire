/**
 * Håller reda på om användaren har påbörjat en registrering men ännu inte
 * verifierat sin e-post. Används för att bara visa "Fick du inte
 * bekräftelsemejlet?" när det faktiskt är relevant.
 *
 * Flaggan sätts vid lyckad registrering eller vid inloggningsförsök som
 * misslyckas med email_not_confirmed, och rensas så fort någon lyckas
 * logga in (oavsett vilken e-postadress som används).
 */
const KEY = 'parium-pending-verification';
const VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PendingVerificationRecord = {
  version: typeof VERSION;
  email: string | null;
  expiresAt: number;
};

function removeStoredRecord() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignorera (privat läge etc.)
  }
}

function readStoredRecord(): PendingVerificationRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingVerificationRecord>;
    const valid =
      parsed.version === VERSION &&
      Number.isFinite(parsed.expiresAt) &&
      Number(parsed.expiresAt) > Date.now() &&
      (parsed.email === null || typeof parsed.email === 'string');

    if (!valid) {
      removeStoredRecord();
      return null;
    }

    return parsed as PendingVerificationRecord;
  } catch {
    // Äldre obegränsade strängvärden och trasig lagring ska aldrig leva vidare.
    removeStoredRecord();
    return null;
  }
}

export function markPendingVerification(email?: string) {
  try {
    const normalizedEmail = email?.trim().toLowerCase() || null;
    const record: PendingVerificationRecord = {
      version: VERSION,
      email: normalizedEmail,
      expiresAt: Date.now() + TTL_MS,
    };
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // ignorera (privat läge etc.)
  }
}

export function clearPendingVerification() {
  removeStoredRecord();
}

export function hasPendingVerification(): boolean {
  return readStoredRecord() !== null;
}

export function getPendingVerificationEmail(): string {
  return readStoredRecord()?.email || '';
}

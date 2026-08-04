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

export function markPendingVerification(email?: string) {
  try {
    localStorage.setItem(KEY, email?.trim() || '1');
  } catch {
    // ignorera (privat läge etc.)
  }
}

export function clearPendingVerification() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignorera
  }
}

export function hasPendingVerification(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function getPendingVerificationEmail(): string {
  try {
    const value = localStorage.getItem(KEY);
    return value && value !== '1' ? value : '';
  } catch {
    return '';
  }
}

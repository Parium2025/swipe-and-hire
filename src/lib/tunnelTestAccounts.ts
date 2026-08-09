/**
 * Testkonton som alltid ska köra välkomsttunneln på nytt vid varje inloggning.
 * onboarding_completed sparas INTE för dessa konton – i stället markeras tunneln
 * som klar i sessionStorage så att man kan använda appen resten av sessionen.
 * Vid nästa inloggning (ny session) visas tunneln igen.
 */
const TUNNEL_REPLAY_EMAILS: string[] = [];

/**
 * Testkonton som alltid ska landa på välkomstkortet vid varje inloggning.
 * Profilen sparas helt normalt (som vilken kandidat som helst) – enbart
 * välkomstkortet visas om och om igen.
 */
const WELCOME_CARD_REPLAY_EMAILS: string[] = [];

/**
 * Arbetsgivarkonton som alltid ska landa på arbetsgivarens välkomstkort
 * (guiden "Hjälp & tips") vid varje inloggning — används för testning.
 */
const EMPLOYER_WELCOME_CARD_REPLAY_EMAILS: string[] = ['gorgeandersson@gmail.com'];


export function isWelcomeCardReplayAccount(email?: string | null): boolean {
  if (!email) return false;
  return WELCOME_CARD_REPLAY_EMAILS.includes(email.trim().toLowerCase());
}

export function isEmployerWelcomeCardReplayAccount(email?: string | null): boolean {
  if (!email) return false;
  return EMPLOYER_WELCOME_CARD_REPLAY_EMAILS.includes(email.trim().toLowerCase());
}


const SESSION_KEY = 'tunnel_replay_done';

export function isTunnelReplayAccount(email?: string | null): boolean {
  if (!email) return false;
  return TUNNEL_REPLAY_EMAILS.includes(email.trim().toLowerCase());
}

export function hasCompletedTunnelThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTunnelCompletedThisSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignorera */
  }
}

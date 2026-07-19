/**
 * Event-baserat system för att visa auth-splash vid navigering till /auth.
 * 
 * Skalet visas i minst 4 sekunder för att ge tid för loggan att laddas
 * och avkodas helt innan den tonas ut.
 */

type SplashListener = (visible: boolean) => void;
type AuthSplashRole = 'job_seeker' | 'employer';

const listeners = new Set<SplashListener>();
let currentlyVisible = false;
let currentRole: AuthSplashRole | null = null;
const TRANSITION_GATE_ID = 'parium-auth-transition-gate';

const mountImmediateGate = () => {
  if (typeof document === 'undefined') return;
  try {
    if (document.getElementById(TRANSITION_GATE_ID)) return;
    const gate = document.createElement('div');
    gate.id = TRANSITION_GATE_ID;
    gate.setAttribute('aria-hidden', 'true');
    gate.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483646',
      'background:hsl(215, 100%, 12%)',
      'pointer-events:auto',
      'opacity:1',
      'transform:translateZ(0)',
    ].join(';');
    document.body.appendChild(gate);
  } catch {
    /* ignore */
  }
};

const removeImmediateGate = () => {
  if (typeof document === 'undefined') return;
  try {
    document.getElementById(TRANSITION_GATE_ID)?.remove();
  } catch {
    /* ignore */
  }
};

export const normalizeAuthSplashRole = (role?: string | null): AuthSplashRole | null => {
  if (role === 'employer') return 'employer';
  if (role === 'job_seeker') return 'job_seeker';
  return null;
};

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || null;

const hashEmailKey = (email: string) => {
  let hash = 5381;
  for (let i = 0; i < email.length; i += 1) {
    hash = ((hash << 5) + hash) ^ email.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const roleByEmailKey = (email: string) => `parium-role-by-email:${hashEmailKey(email)}`;

const getStoredSplashRole = (): AuthSplashRole | null => {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeAuthSplashRole(window.localStorage.getItem('parium-last-role'));
  } catch {
    return null;
  }
};

export const getCachedAuthRoleForEmail = (email?: string | null): AuthSplashRole | null => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || typeof window === 'undefined') return null;
  try {
    return normalizeAuthSplashRole(window.localStorage.getItem(roleByEmailKey(normalizedEmail)));
  } catch {
    return null;
  }
};

export const cacheAuthRoleForEmail = (email?: string | null, role?: string | null) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeAuthSplashRole(role);
  if (!normalizedEmail || !normalizedRole || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(roleByEmailKey(normalizedEmail), normalizedRole);
  } catch {
    /* ignore */
  }
};

const persistSplashRole = (role?: string | null) => {
  const normalized = normalizeAuthSplashRole(role);
  if (!normalized) {
    currentRole = currentRole ?? getStoredSplashRole();
    return;
  }

  currentRole = normalized;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('parium-last-role', normalized);
    window.dispatchEvent(new CustomEvent('parium-auth-splash-role', { detail: normalized }));
  } catch {
    /* ignore */
  }
};

export const authSplashEvents = {
  /**
   * Prenumerera på splash-synlighet
   */
  subscribe(listener: SplashListener): () => void {
    listeners.add(listener);
    // Ge direkt aktuell status
    listener(currentlyVisible);
    return () => listeners.delete(listener);
  },

  /**
   * Visa splash-skalet (anropas innan navigering till /auth)
   */
  show(role?: string | null) {
    persistSplashRole(role);
    if (currentlyVisible) return;
    // Täcker skärmen synkront i samma click-frame, innan React hinner committa
    // splash-komponenten. Det eliminerar mini-blixten vid login/logout.
    mountImmediateGate();
    currentlyVisible = true;
    listeners.forEach(l => l(true));
  },

  /**
   * Göm splash-skalet
   */
  hide() {
    if (!currentlyVisible) return;
    currentlyVisible = false;
    listeners.forEach(l => l(false));
    removeImmediateGate();
  },

  /**
   * När React-splashen har committat sin opaka overlay kan den synkrona
   * fallback-gaten tas bort utan visuell skillnad.
   */
  releaseGate() {
    removeImmediateGate();
  },

  /**
   * Kolla om splash visas just nu
   */
  isVisible(): boolean {
    return currentlyVisible;
  },

  /**
   * Stabil roll-snapshot för aktuell splash. Komponenten läser denna när
   * splashen startar och ändrar inte texten mitt i animationen.
   */
  getRole(): AuthSplashRole | null {
    return currentRole ?? getStoredSplashRole();
  }
};

// Exponera globalt för enkel debugging
if (typeof window !== 'undefined') {
  (window as any).__authSplash = authSplashEvents;
}

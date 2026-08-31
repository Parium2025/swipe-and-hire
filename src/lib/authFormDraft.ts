/**
 * Sparar registreringsformuläret i sessionStorage så att inget försvinner vid
 * oavsiktlig reload, flikbyte eller när webbläsaren återöppnas i samma session.
 *
 * Säkerhet:
 * - sessionStorage (inte localStorage) → försvinner när fliken stängs, nästa
 *   person på samma dator ser inget.
 * - Lösenord sparas ALDRIG.
 * - Rensas direkt vid lyckad registrering/inloggning.
 */

const KEY = 'parium_auth_draft_v1';
const VERSION = 2;
const TTL_MS = 24 * 60 * 60 * 1000;

export interface AuthDraft {
  role?: 'job_seeker' | 'employer';
  jobSeeker?: Record<string, string>;
  employer?: Record<string, string>;
  login?: Record<string, string>;
}

const SENSITIVE = new Set(['password', 'confirmPassword', 'phoneError']);

type StoredAuthDraft = {
  version: typeof VERSION;
  expiresAt: number;
  draft: AuthDraft;
};

const stripSensitive = (data?: Record<string, string>) => {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE.has(k)) continue;
    if (typeof v === 'string' && v.trim() !== '') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
};

export const loadAuthDraft = (): AuthDraft => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StoredAuthDraft>;
    const valid =
      parsed.version === VERSION &&
      Number.isFinite(parsed.expiresAt) &&
      Number(parsed.expiresAt) > Date.now() &&
      parsed.draft &&
      typeof parsed.draft === 'object';

    if (!valid) {
      sessionStorage.removeItem(KEY);
      return {};
    }

    return parsed.draft as AuthDraft;
  } catch {
    try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
    return {};
  }
};

export const saveAuthDraft = (draft: AuthDraft) => {
  try {
    const payload: AuthDraft = {
      role: draft.role,
      jobSeeker: stripSensitive(draft.jobSeeker),
      employer: stripSensitive(draft.employer),
      login: stripSensitive(draft.login),
    };
    if (!payload.role && !payload.jobSeeker && !payload.employer && !payload.login) {
      sessionStorage.removeItem(KEY);
      return;
    }
    const stored: StoredAuthDraft = {
      version: VERSION,
      expiresAt: Date.now() + TTL_MS,
      draft: payload,
    };
    sessionStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* ignorera quota-fel */
  }
};

export const clearAuthDraft = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
};

/** Slår ihop sparat utkast med initialt state (utkastet vinner för ifyllda fält). */
export const mergeDraft = <T extends Record<string, string>>(
  initial: T,
  saved?: Record<string, string>
): T => {
  if (!saved) return initial;
  const out = { ...initial };
  for (const key of Object.keys(initial) as (keyof T)[]) {
    const v = saved[key as string];
    if (typeof v === 'string' && v !== '' && !SENSITIVE.has(key as string)) {
      (out as Record<string, string>)[key as string] = v;
    }
  }
  return out;
};

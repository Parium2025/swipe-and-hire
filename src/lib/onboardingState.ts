import { supabase } from '@/integrations/supabase/client';

/**
 * ☁️ MOLNSYNKAD ONBOARDING-STATUS
 *
 * Två saker sparas per konto (inte per webbläsare):
 *  1. `tunnel_draft` – påbörjat välkomsttunnel-utkast, så att man kan byta
 *     enhet mitt i utan att börja om.
 *  2. `coach_state`  – vilka sidtips som setts och om guiden är avslutad,
 *     så att två personer som delar dator får varsin guide.
 *
 * localStorage används fortfarande som snabb cache (instant render, offline),
 * molnet är sanningen när det finns en nyare version där.
 */

export interface TunnelDraft {
  formData?: Record<string, unknown>;
  postalCode?: string;
  userLocation?: string;
  currentStep?: number;
  savedAt?: number;
}

export interface CoachState {
  /** Nyckel per sidtips, `true` = sett. */
  seen?: Record<string, boolean>;
  /** Hårdstopp – guiden avslutad. */
  disabled?: boolean;
  savedAt?: number;
}

interface OnboardingRow {
  tunnel_draft: TunnelDraft | null;
  coach_state: CoachState | null;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchRow(expectedUserId?: string): Promise<OnboardingRow | null> {
  const userId = expectedUserId ?? await currentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_onboarding_state')
    .select('tunnel_draft, coach_state')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as OnboardingRow) ?? null;
}

async function upsert(patch: Partial<OnboardingRow>, expectedUserId?: string): Promise<boolean> {
  const userId = expectedUserId ?? await currentUserId();
  if (!userId) return false;
  const { error } = await supabase
    .from('user_onboarding_state')
    .upsert({ user_id: userId, ...patch } as never, { onConflict: 'user_id' });
  return !error;
}

/* ── Tunnelutkast ─────────────────────────────────────────────── */

export async function loadTunnelDraft(expectedUserId?: string): Promise<TunnelDraft | null> {
  const row = await fetchRow(expectedUserId);
  return row?.tunnel_draft ?? null;
}

export async function saveTunnelDraft(draft: TunnelDraft, expectedUserId?: string): Promise<boolean> {
  return upsert({ tunnel_draft: draft }, expectedUserId);
}

export async function clearTunnelDraft(expectedUserId?: string): Promise<boolean> {
  return upsert({ tunnel_draft: null }, expectedUserId);
}

/* ── Sidtips ──────────────────────────────────────────────────── */

export async function loadCoachState(): Promise<CoachState | null> {
  const row = await fetchRow();
  return row?.coach_state ?? null;
}

export async function saveCoachState(state: CoachState): Promise<boolean> {
  return upsert({ coach_state: { ...state, savedAt: Date.now() } });
}

/* ── Introguiden ("Hjälp & tips") ─────────────────────────────── */

/**
 * Introguiden ska visas exakt en gång per KONTO — inte per webbläsare.
 * Därför lagras flaggan i molnet (coach_state.introTourDone) så att den
 * följer kontot oavsett vilken enhet tunneln slutfördes på.
 */
export async function isIntroTourDone(): Promise<boolean> {
  const row = await fetchRow();
  return Boolean((row?.coach_state as CoachState & { introTourDone?: boolean } | null)?.introTourDone);
}

export async function markIntroTourDone(): Promise<boolean> {
  const row = await fetchRow();
  const next = { ...(row?.coach_state ?? {}), introTourDone: true, savedAt: Date.now() };
  return upsert({ coach_state: next as CoachState });
}

/** Nollställ introflaggan (körs när välkomsttunneln startas om för kontot). */
export async function resetIntroTourDone(): Promise<boolean> {
  const row = await fetchRow();
  const next = { ...(row?.coach_state ?? {}), introTourDone: false, savedAt: Date.now() };
  return upsert({ coach_state: next as CoachState });
}


/* ── Hjälpare ─────────────────────────────────────────────────── */

/** Enkel debounce som alltid kör sista anropet. */
export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let timer: number | undefined;
  return (...args: Parameters<T>) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

// Inbjudan överlever utloggning, ny flik och mejlbekräftelse — auth-sidan
// skickar tillbaka hit så fort rätt konto är inloggat.
export const PENDING_TEAM_INVITE_KEY = "parium-pending-team-invite";
const PENDING_TTL_MS = 7 * 24 * 3_600_000;
export const rememberInvite = (path: string) => {
  try { localStorage.setItem(PENDING_TEAM_INVITE_KEY, JSON.stringify({ path, at: Date.now() })); } catch { /* ignore */ }
};
export const forgetInvite = () => {
  try { localStorage.removeItem(PENDING_TEAM_INVITE_KEY); } catch { /* ignore */ }
};
export const readPendingTeamInvite = (): string | null => {
  try {
    const raw = localStorage.getItem(PENDING_TEAM_INVITE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof parsed.path !== "string" || typeof parsed.at !== "number" || Date.now() - parsed.at > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_TEAM_INVITE_KEY);
      return null;
    }
    return parsed.path;
  } catch {
    return null;
  }
};


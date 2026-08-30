/**
 * Kontobundna rollkontroller (fail-closed).
 *
 * Ligger i ett eget modulskikt så att hookar som konsumerar `useAuth()` kan
 * använda samma regel utan att importera själva providern (och utan att
 * testernas useAuth-mockar behöver spegla hjälparna).
 */
export type OwnedRoleInput =
  | { user_id?: string; role?: string | null }
  | null
  | undefined;

const ownsRole = (
  currentUser: { id: string } | null | undefined,
  role: OwnedRoleInput,
  expected: string,
): boolean => {
  if (!currentUser?.id) return false;
  if (!role) return false;
  if (role.user_id !== currentUser.id) return false;
  return role.role === expected;
};

/**
 * Kräver inloggad användare, en roll som tillhör exakt samma användare och
 * den kanoniska arbetsgivarrollen.
 */
export const canRefreshEmployerStats = (
  currentUser: { id: string } | null | undefined,
  role: OwnedRoleInput,
): boolean => ownsRole(currentUser, role, 'employer');

/**
 * Kräver inloggad användare och en job_seeker-roll som bevisligen tillhör
 * exakt den användaren. En kvarhängande roll från konto A får aldrig aktivera
 * jobbsökarlyssnare eller warmup för konto B.
 */
export const isOwnedJobSeekerRole = (
  currentUser: { id: string } | null | undefined,
  role: OwnedRoleInput,
): boolean => ownsRole(currentUser, role, 'job_seeker');

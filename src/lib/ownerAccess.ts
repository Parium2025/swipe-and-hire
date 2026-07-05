/**
 * E-postadresser som räknas som ägare av Parium-plattformen.
 * Dessa användare får obegränsad åtkomst utan att behöva välja plan/betala.
 * Matchning görs case-insensitive.
 */
export const OWNER_EMAILS: string[] = [
  'pariumab@hotmail.com',
];

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.trim().toLowerCase());
}

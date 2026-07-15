/**
 * Normalized company-initials helper used everywhere a logo is missing.
 *
 * Rules (same for employer cards, job-seeker cards, swipe, nav, dialogs):
 *  - No name        → '?'
 *  - One word       → first + last letter (e.g. "Hoffstens" → "HS", "Apple" → "AE")
 *  - Two+ words     → first letter of first word + first letter of last word
 *                     (e.g. "Hoffstens Motor" → "HM", "Volvo Cars Group" → "VG")
 *
 * Keeping this in a single utility guarantees the same initials in the sidebar,
 * topnav, job cards, swipe mode, company dialogs and messaging avatars.
 */
export function getCompanyInitials(name?: string | null): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const w = words[0];
    return (w[0] + w[w.length - 1]).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

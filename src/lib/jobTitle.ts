/**
 * Jobbtitlar kan i praktiken innehålla klistrad annonstext på tusentals tecken.
 * Att rendera sådana strängar i listor, dropdowns och tooltips ger tunga
 * layoutberäkningar och märkbar lagg. Klipp därför alltid titeln innan den når UI.
 */
const MAX_TITLE_LENGTH = 120;

export function clampJobTitle(
  title: string | null | undefined,
  max: number = MAX_TITLE_LENGTH
): string {
  if (!title) return '';
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}…`;
}

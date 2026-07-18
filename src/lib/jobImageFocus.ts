/**
 * Shared helpers for job hero image focus / crop.
 *
 * Ett värde lagras som antingen legacy-nyckelord ('top' | 'center' | 'bottom')
 * eller sträng-procent ('0'–'100'). All logik för att tolka värdet finns HÄR
 * så att kort, positionerare och hero croppar identiskt.
 */

export type FocusValue = string | null | undefined;

/** Returnerar en procent 0–100 för object-position Y. */
export function parseFocusPercent(value: FocusValue): number {
  if (!value || value === 'center') return 50;
  if (value === 'top') return 20;
  if (value === 'bottom') return 80;
  const num = parseInt(value, 10);
  if (isNaN(num)) return 50;
  return Math.max(0, Math.min(100, num));
}

/** Returnerar en färdig `object-position`-sträng, t.ex. `"center 20%"`. */
export function toObjectPosition(value: FocusValue): string {
  return `center ${parseFocusPercent(value)}%`;
}

/**
 * Delat aspect-ratio-token för jobbmedia (kort / positionerare / hero).
 * Håll i sync med `--job-media-aspect` i `src/index.css`.
 */
export const JOB_MEDIA_ASPECT = '2 / 1';

/**
 * Local (device timezone) time formatting.
 *
 * Times that belong to the *person looking at the screen* — the header clock,
 * greetings, interview times — are rendered in that person's own timezone.
 * A recruiter in New York sees the interview at their local clock time, and a
 * candidate in Sweden sees the same instant at Swedish time.
 */

const partsOf = (date: Date | number): Date => (typeof date === 'number' ? new Date(date) : date);

/** Hour 0-23 in the device's timezone. */
export const getLocalHour = (date: Date | number = Date.now()): number => partsOf(date).getHours();

/** Stable index of the local calendar day — safe to subtract for day diffs. */
export const getLocalDayIndex = (date: Date | number = Date.now()): number => {
  const d = partsOf(date);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
};

/** Calendar-day difference in local time (0 = same day, 1 = tomorrow). */
export const localDayDiff = (from: Date | number, to: Date | number): number =>
  getLocalDayIndex(to) - getLocalDayIndex(from);

const timeFormatter = new Intl.DateTimeFormat('sv-SE', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const shortDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
});

const longDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "14:30" in the device's timezone. */
export const formatLocalTime = (date: Date | number = Date.now()): string =>
  timeFormatter.format(partsOf(date));

/** "24 aug." in the device's timezone. */
export const formatLocalShortDate = (date: Date | number = Date.now()): string =>
  shortDateFormatter.format(partsOf(date));

/** "Måndag 24 augusti" + "14:30" for the home header clock. */
export const formatLocalDateTime = (
  date: Date | number = Date.now(),
): { time: string; date: string } => {
  const d = partsOf(date);
  const raw = longDateFormatter.format(d);
  return { time: formatLocalTime(d), date: raw.charAt(0).toUpperCase() + raw.slice(1) };
};

/** Short timezone label, e.g. "CEST" or "EDT" — shown when abroad. */
export const getLocalTimeZoneLabel = (date: Date | number = Date.now()): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(
      partsOf(date),
    );
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
};

/** IANA timezone of the device, e.g. "Europe/Stockholm". */
export const getLocalTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Stockholm';
  } catch {
    return 'Europe/Stockholm';
  }
};

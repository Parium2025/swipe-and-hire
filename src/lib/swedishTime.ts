/**
 * All user-facing dates and times in Parium are rendered in Swedish time
 * (Europe/Stockholm), independent of the device's own timezone. A recruiter
 * travelling abroad must still see the same interview time as the candidate
 * in Sweden.
 */
export const SWEDISH_TIME_ZONE = 'Europe/Stockholm';

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

const partsFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SWEDISH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Calendar/clock parts of an instant as seen in Sweden. */
export const getSwedishParts = (date: Date | number = Date.now()): Parts => {
  const d = typeof date === 'number' ? new Date(date) : date;
  const out: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    // Intl can return 24 for midnight in some engines
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
  };
};

/** Hour 0-23 in Swedish time. */
export const getSwedishHour = (date: Date | number = Date.now()): number => getSwedishParts(date).hour;

/** Stable index of the Swedish calendar day — safe to subtract for day diffs. */
export const getSwedishDayIndex = (date: Date | number = Date.now()): number => {
  const { year, month, day } = getSwedishParts(date);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
};

/** Calendar-day difference in Swedish time (0 = same day, 1 = tomorrow). */
export const swedishDayDiff = (from: Date | number, to: Date | number): number =>
  getSwedishDayIndex(to) - getSwedishDayIndex(from);

const timeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SWEDISH_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const shortDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SWEDISH_TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

const longDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SWEDISH_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "14:30" in Swedish time. */
export const formatSwedishTime = (date: Date | number = Date.now()): string =>
  timeFormatter.format(typeof date === 'number' ? new Date(date) : date);

/** "24 aug." in Swedish time. */
export const formatSwedishShortDate = (date: Date | number = Date.now()): string =>
  shortDateFormatter.format(typeof date === 'number' ? new Date(date) : date);

/** "Måndag 24 augusti" + "14:30" for the home header clock. */
export const formatSwedishDateTime = (
  date: Date | number = Date.now(),
): { time: string; date: string } => {
  const d = typeof date === 'number' ? new Date(date) : date;
  const raw = longDateFormatter.format(d);
  return { time: formatSwedishTime(d), date: raw.charAt(0).toUpperCase() + raw.slice(1) };
};

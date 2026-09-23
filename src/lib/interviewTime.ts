import {
  formatLocalShortDate,
  formatLocalTime,
  localDayDiff,
  swedishTimeHint,
} from '@/lib/localTime';

/**
 * Intervjutider visas i användarens egen tidszon. Tidpunkten lagras alltid som
 * ett absolut ögonblick (UTC), så en rekryterare i New York och en kandidat i
 * Sverige ser samma möte — var och en på sin egen klocka.
 */
export const formatInterviewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const dayDiff = localDayDiff(Date.now(), date);
  if (dayDiff === 0) return 'Idag';
  if (dayDiff === 1) return 'Imorgon';
  return formatLocalShortDate(date);
};

export const formatInterviewTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return formatLocalTime(date);
};

/**
 * "08:00 (14:00 svensk tid)" när enheten står i en annan tidszon — annars
 * bara "14:00". Ingen manuell inställning behövs: enhetens tidszon avgör.
 */
export const formatInterviewTimeWithZone = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const local = formatLocalTime(date);
  const hint = swedishTimeHint(date);
  return hint ? `${local} (${hint})` : local;
};

/** Calendar-day difference in local time so "Imorgon" always means tomorrow. */
const calendarDayDiff = (from: Date, to: Date): number => localDayDiff(from, to);

/** Relative label. Recomputed on every minute tick by the cards. */
export const getTimeUntil = (scheduledAt: string, now: number = Date.now()): string => {
  const scheduled = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduled)) return '';
  const diffMs = scheduled - now;
  if (diffMs <= 0) return 'Pågår nu';

  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const dayDiff = calendarDayDiff(new Date(now), new Date(scheduled));

  if (diffMins < 1) return 'Strax';
  if (diffMins < 60) return `Om ${diffMins} min`;
  if (diffHours < 24 && dayDiff === 0) return `Om ${diffHours} tim`;
  if (dayDiff === 1) return 'Imorgon';
  if (dayDiff > 1 && dayDiff < 7) return `Om ${dayDiff} dagar`;
  return formatInterviewDate(scheduledAt);
};


export const isInterviewUrgent = (scheduledAt: string, now: number = Date.now()): boolean => {
  const scheduled = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduled)) return false;
  const diffMs = scheduled - now;
  return diffMs <= 24 * 3_600_000;
};

/** An interview stays visible until its scheduled end time has passed. */
export const isInterviewOver = (
  scheduledAt: string,
  durationMinutes: number | null | undefined,
  now: number = Date.now(),
): boolean => {
  const scheduled = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduled)) return false;
  const duration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;
  return now > scheduled + duration * 60_000;
};

/** Only real http(s) links may be opened — plain text like "Teams" must never navigate. */
export const getMeetingUrl = (details: string | null | undefined): string | null => {
  if (!details) return null;
  const trimmed = details.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

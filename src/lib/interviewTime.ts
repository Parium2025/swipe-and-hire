import { format, isToday, isTomorrow } from 'date-fns';
import { sv } from 'date-fns/locale';

export const formatInterviewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  if (isToday(date)) return 'Idag';
  if (isTomorrow(date)) return 'Imorgon';
  return format(date, 'd MMM', { locale: sv });
};

export const formatInterviewTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'HH:mm');
};

/** Calendar-day difference (not elapsed 24h blocks) so "Imorgon" always means tomorrow. */
const calendarDayDiff = (from: Date, to: Date): number => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
};

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

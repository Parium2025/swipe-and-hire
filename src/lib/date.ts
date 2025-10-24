import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

/**
 * Format a date to Swedish short format: "19 okt. 2025"
 */
export function formatDateShortSv(input: Date | string | number | null | undefined): string {
  if (!input) return '-';
  
  try {
    const date = new Date(input);
    if (isNaN(date.getTime())) return '-';
    
    return format(date, 'd MMM yyyy', { locale: sv });
  } catch {
    return '-';
  }
}

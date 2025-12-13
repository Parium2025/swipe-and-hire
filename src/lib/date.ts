import { format, differenceInDays, differenceInHours, differenceInMinutes, addDays } from 'date-fns';
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

/**
 * Get effective expiration date - either from expires_at or calculated from created_at + 14 days
 */
export function getEffectiveExpiresAt(createdAt: string, expiresAt?: string | null): Date {
  if (expiresAt) {
    return new Date(expiresAt);
  }
  // Default: 1 day from creation (temporary for testing, change to 14 for production)
  return addDays(new Date(createdAt), 1);
}

/**
 * Check if a job has expired
 */
export function isJobExpiredCheck(createdAt: string, expiresAt?: string | null): boolean {
  const effectiveExpiry = getEffectiveExpiresAt(createdAt, expiresAt);
  return effectiveExpiry < new Date();
}

/**
 * Get time remaining until expiration in human-readable Swedish format
 * Returns: "3 dagar, 14:30" or "14 timmar, 30 min" or "Utgången"
 */
export function getTimeRemaining(createdAt: string, expiresAt?: string | null): { text: string; isExpired: boolean } {
  const effectiveExpiry = getEffectiveExpiresAt(createdAt, expiresAt);
  const now = new Date();
  
  if (effectiveExpiry < now) {
    return { text: 'Utgången', isExpired: true };
  }
  
  const daysLeft = differenceInDays(effectiveExpiry, now);
  const hoursLeft = differenceInHours(effectiveExpiry, now) % 24;
  const minutesLeft = differenceInMinutes(effectiveExpiry, now) % 60;
  
  if (daysLeft > 0) {
    return { 
      text: `${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagar'} kvar`, 
      isExpired: false 
    };
  } else if (hoursLeft > 0) {
    return { 
      text: `${hoursLeft}h ${minutesLeft}min kvar`, 
      isExpired: false 
    };
  } else {
    return { 
      text: `${minutesLeft} min kvar`, 
      isExpired: false 
    };
  }
}

/**
 * Format expiration date with time: "27 dec. 2025, 10:14"
 */
export function formatExpirationDateTime(createdAt: string, expiresAt?: string | null): string {
  const effectiveExpiry = getEffectiveExpiresAt(createdAt, expiresAt);
  return format(effectiveExpiry, "d MMM yyyy, HH:mm", { locale: sv });
}

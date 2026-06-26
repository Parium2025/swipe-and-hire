/**
 * 🔁 OfflineQueueRunner — Global bakgrundsmount som flushar ALLA offline-köer.
 *
 * Mountas en gång globalt (i AppShell). När användaren är inloggad och
 * online så töms alla köer automatiskt, oavsett vilken sida användaren
 * befinner sig på. Inga UI-element renderas.
 *
 * KRITISKT: Utan denna globala mount synkades localStorage-köerna
 * (applications, messages, profile, saved jobs) endast medan respektive
 * feature-sida var öppen. Det innebar att en användare som ansökte
 * offline och sedan navigerade bort INTE fick sin ansökan skickad när
 * nätet kom tillbaka — förrän de återvände till en jobbsida.
 */

import { useAuth } from '@/hooks/useAuth';
import { useOfflineMediaQueue } from '@/hooks/useOfflineMediaQueue';
import { useOfflineJobQueue } from '@/hooks/useOfflineJobQueue';
import { useOfflineApplicationQueue } from '@/hooks/useOfflineApplicationQueue';
import { useOfflineMessageQueue } from '@/hooks/useOfflineMessageQueue';
import { useOfflineProfileQueue } from '@/hooks/useOfflineProfileQueue';
import { useOfflineSavedJobsQueue } from '@/hooks/useOfflineSavedJobsQueue';

export function OfflineQueueRunner() {
  const { user } = useAuth();
  const userId = user?.id;

  // IndexedDB-köer (binär/stor data)
  useOfflineMediaQueue(userId);
  useOfflineJobQueue(userId);

  // localStorage-köer (strukturerad data) — nu med global flush
  useOfflineApplicationQueue(userId);
  useOfflineMessageQueue(userId);
  useOfflineProfileQueue(userId);
  useOfflineSavedJobsQueue(userId);

  return null;
}

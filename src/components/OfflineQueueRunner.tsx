/**
 * 🔁 OfflineQueueRunner — Bakgrundsmount som flushar media- & job-köer.
 *
 * Mountas en gång globalt (i AppShell). När användaren är inloggad och
 * online så töms IndexedDB-köerna automatiskt. Inga UI-element renderas.
 */

import { useAuth } from '@/hooks/useAuth';
import { useOfflineMediaQueue } from '@/hooks/useOfflineMediaQueue';
import { useOfflineJobQueue } from '@/hooks/useOfflineJobQueue';

export function OfflineQueueRunner() {
  const { user } = useAuth();
  const userId = user?.id;
  // Hookarna lyssnar själva på online/offline-events och flushar
  useOfflineMediaQueue(userId);
  useOfflineJobQueue(userId);
  return null;
}

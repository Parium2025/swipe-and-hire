import { useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Jobbsökarmenyns siffror (Sök jobb, Sparade jobb, Mina ansökningar).
 * Senast serverbekräftade värden sparas per konto och visas direkt efter
 * omladdning; de ersätts tyst när servern bekräftat nya värden.
 */
export interface SeekerNavCounts {
  ready: boolean;
  totalJobs: number;
  savedJobs: number;
  myApplications: number;
}

const PREFIX = 'parium-seeker-nav-counts:v1:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function read(userId: string): Omit<SeekerNavCounts, 'ready'> | null {
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.ts !== 'number' || Date.now() - v.ts > MAX_AGE_MS) return null;
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    return { totalJobs: n(v.totalJobs), savedJobs: n(v.savedJobs), myApplications: n(v.myApplications) };
  } catch {
    return null;
  }
}

export function useSeekerNavCounts(): SeekerNavCounts {
  const { user, profile, seekerCountsReadyUserId, preloadedTotalJobs, preloadedSavedJobs, preloadedMyApplications } = useAuth();
  // Cachad profil är verifierad mot flikens konto och finns redan i första bilden.
  const userId = user?.id ?? (profile as { user_id?: string } | null)?.user_id ?? null;
  const live = !!userId && seekerCountsReadyUserId === userId;

  useEffect(() => {
    if (!live || !userId) return;
    try {
      localStorage.setItem(PREFIX + userId, JSON.stringify({
        ts: Date.now(), totalJobs: preloadedTotalJobs, savedJobs: preloadedSavedJobs, myApplications: preloadedMyApplications,
      }));
    } catch { /* lagring full */ }
  }, [live, userId, preloadedTotalJobs, preloadedSavedJobs, preloadedMyApplications]);

  return useMemo(() => {
    if (live) return { ready: true, totalJobs: preloadedTotalJobs, savedJobs: preloadedSavedJobs, myApplications: preloadedMyApplications };
    const stored = userId ? read(userId) : null;
    return stored ? { ready: true, ...stored } : { ready: false, totalJobs: 0, savedJobs: 0, myApplications: 0 };
  }, [live, userId, preloadedTotalJobs, preloadedSavedJobs, preloadedMyApplications]);
}

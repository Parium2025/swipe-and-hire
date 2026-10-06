import { useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Menyns siffror (Dashboard, Mina annonser, Kandidater, Mina kandidater).
 * Senast serverbekräftade värden sparas per konto och organisation och visas
 * direkt efter omladdning; de ersätts tyst när servern bekräftat nya värden.
 */
export interface EmployerNavCounts {
  ready: boolean;
  dashboard: number;
  myJobs: number;
  candidates: number;
  myCandidates: number;
}

const PREFIX = 'parium-nav-counts:v1:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function key(userId: string, orgId: string | null) {
  return `${PREFIX}${userId}:${orgId ?? 'none'}`;
}

function read(userId: string, orgId: string | null): Omit<EmployerNavCounts, 'ready'> | null {
  try {
    const raw = localStorage.getItem(key(userId, orgId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.ts !== 'number' || Date.now() - v.ts > MAX_AGE_MS) return null;
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    return { dashboard: n(v.dashboard), myJobs: n(v.myJobs), candidates: n(v.candidates), myCandidates: n(v.myCandidates) };
  } catch {
    return null;
  }
}

export function useEmployerNavCounts(): EmployerNavCounts {
  const {
    user, profile, employerCountsReadyUserId,
    preloadedEmployerDashboardJobs, preloadedEmployerMyJobs, preloadedEmployerCandidates, preloadedMyCandidates,
  } = useAuth();
  const userId = user?.id ?? null;
  const orgId = profile?.organization_id ?? null;
  const live = !!userId && employerCountsReadyUserId === userId;

  useEffect(() => {
    if (!live || !userId || !profile) return;
    try {
      localStorage.setItem(key(userId, orgId), JSON.stringify({
        ts: Date.now(),
        dashboard: preloadedEmployerDashboardJobs,
        myJobs: preloadedEmployerMyJobs,
        candidates: preloadedEmployerCandidates,
        myCandidates: preloadedMyCandidates,
      }));
    } catch { /* lagring full — siffrorna visas ändå live */ }
  }, [live, userId, orgId, profile, preloadedEmployerDashboardJobs, preloadedEmployerMyJobs, preloadedEmployerCandidates, preloadedMyCandidates]);

  return useMemo(() => {
    if (live) {
      return {
        ready: true,
        dashboard: preloadedEmployerDashboardJobs,
        myJobs: preloadedEmployerMyJobs,
        candidates: preloadedEmployerCandidates,
        myCandidates: preloadedMyCandidates,
      };
    }
    // Endast samma konto + organisation; profilen måste vara känd så att
    // organisationen inte kan förväxlas.
    const stored = userId && profile ? read(userId, orgId) : null;
    return stored ? { ready: true, ...stored } : { ready: false, dashboard: 0, myJobs: 0, candidates: 0, myCandidates: 0 };
  }, [live, userId, orgId, profile, preloadedEmployerDashboardJobs, preloadedEmployerMyJobs, preloadedEmployerCandidates, preloadedMyCandidates]);
}

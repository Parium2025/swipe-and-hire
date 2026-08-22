import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CandidateActivity, ActivityType } from '@/hooks/useCandidateActivities';

interface RowLike {
  applicant_id?: string | null;
}

/**
 * Förvärmer anteckningar och aktivitetslogg för ALLA rader på sidan i två
 * batchade queries — istället för en query per kandidat vid hover.
 *
 * Varför: hover-prefetchen missar helt touch-enheter, tangentbordsnavigering
 * (pil upp/ner i dialogen) och när man hoppar direkt till en ny sida. Då fick
 * fliken "Aktivitet"/"Anteckningar" en spinner. Nu ligger båda i React Query-
 * cachen innan dialogen ens öppnas.
 *
 * Ren cache-logik: inga UI-bieffekter, inga propsändringar.
 */
const MAX_ROWS = 60;

export function useCandidateRowDetailsWarmup(rows: RowLike[] | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const warmedRef = useRef<Set<string>>(new Set());

  const applicantIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of rows || []) {
      const id = row?.applicant_id?.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= MAX_ROWS) break;
    }
    return ids;
  }, [rows]);

  const idsKey = useMemo(() => [...applicantIds].sort().join('|'), [applicantIds]);

  useEffect(() => {
    if (!enabled || applicantIds.length === 0) return;

    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

    const pending = applicantIds.filter((id) => !warmedRef.current.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => warmedRef.current.add(id));

    let cancelled = false;

    const run = async () => {
      // 1) Anteckningar — en query för hela sidan
      try {
        const { data } = await supabase
          .from('candidate_notes')
          .select('*')
          .in('applicant_id', pending)
          .is('job_id', null);
        if (cancelled) return;

        const byApplicant = new Map<string, any[]>();
        for (const id of pending) byApplicant.set(id, []);
        for (const note of data || []) {
          byApplicant.get(note.applicant_id)?.push(note);
        }
        for (const [id, notes] of byApplicant) {
          queryClient.setQueryData(['candidate-notes', id], notes);
        }
      } catch { /* cache-warmup får aldrig störa UI */ }

      if (cancelled) return;

      // 2) Aktivitetslogg — en query + en profil-query för hela sidan
      try {
        const { data: activities } = await supabase
          .from('candidate_activities')
          .select('*')
          .in('applicant_id', pending)
          .order('created_at', { ascending: false })
          .limit(pending.length * 50);
        if (cancelled) return;

        const userIds = [...new Set((activities || []).map((a: any) => a.user_id))];
        let profileMap = new Map<string, any>();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, profile_image_url')
            .in('user_id', userIds);
          profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        }
        if (cancelled) return;

        const byApplicant = new Map<string, CandidateActivity[]>();
        for (const id of pending) byApplicant.set(id, []);
        for (const a of activities || []) {
          if (a.activity_type === 'stage_changed') continue;
          const list = byApplicant.get(a.applicant_id);
          if (!list || list.length >= 50) continue;
          list.push({
            ...a,
            activity_type: a.activity_type as ActivityType,
            user_first_name: profileMap.get(a.user_id)?.first_name || 'Okänd',
            user_last_name: profileMap.get(a.user_id)?.last_name || '',
            user_profile_image_url: profileMap.get(a.user_id)?.profile_image_url || null,
          } as CandidateActivity);
        }
        for (const [id, list] of byApplicant) {
          queryClient.setQueryData(['candidate-activities', id], list);
        }
      } catch { /* ignore */ }
    };

    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const ric = (globalThis as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof ric === 'function') {
      idleId = ric(() => void run(), { timeout: 800 });
    } else {
      timeoutId = window.setTimeout(() => void run(), 250);
    }

    return () => {
      cancelled = true;
      const w = globalThis as unknown as { cancelIdleCallback?: (id: number) => void };
      if (idleId !== undefined && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey, queryClient]);
}

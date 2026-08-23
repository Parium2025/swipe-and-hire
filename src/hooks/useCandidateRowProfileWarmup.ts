import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import {
  questionsCache,
  summaryCache,
  setPersistedCacheValue,
  QUESTIONS_STORAGE_KEY,
  SUMMARY_STORAGE_KEY,
} from '@/components/candidateProfile/candidateProfileCache';
import type { CandidateSummaryCacheValue } from '@/components/candidateProfile/candidateProfileCache';

interface RowLike {
  applicant_id?: string | null;
  job_id?: string | null;
  cv_url?: string | null;
}

/**
 * Förvärmer exakt det som annars visar spinner när dialogen öppnas:
 *   • Frågor (job_questions) — en query för alla jobb på sidan
 *   • AI-sammanfattning (candidate_summaries + profile_cv_summaries) — två batchade queries
 *   • Signerad CV-URL — så "Visa CV" är klickbar direkt
 *
 * Ren cache-logik. Skriver till samma cacher som CandidateProfileDialog läser
 * synkront vid mount, alltså syns datan utan nätverksanrop.
 */
const MAX_ROWS = 120;

function extractMeta(keyPoints: unknown) {
  const points = Array.isArray(keyPoints) ? keyPoints : [];
  const docPoint = points.find(
    (p: any) => typeof p?.text === 'string' && p.text.startsWith('Dokumenttyp:')
  ) as any;
  const documentType = typeof docPoint?.text === 'string'
    ? docPoint.text.replace('Dokumenttyp:', '').trim()
    : null;
  return {
    documentType,
    isValidCv: documentType ? documentType.toLowerCase() === 'cv' : undefined,
    sourceCvUrl: docPoint?.meta?.source_cv_url as string | undefined,
  };
}

const summaryKey = (applicantId: string, jobId: string | null, cvUrl: string | null) =>
  `${applicantId}_${jobId || 'no-job'}_${cvUrl || '__no-cv__'}`;

export function useCandidateRowProfileWarmup(rows: RowLike[] | undefined, enabled = true) {
  const warmedRef = useRef<Set<string>>(new Set());

  const items = useMemo(() => {
    const out: { applicant_id: string; job_id: string | null; cv_url: string | null }[] = [];
    const seen = new Set<string>();
    for (const row of rows || []) {
      const id = row?.applicant_id?.trim();
      if (!id) continue;
      const key = `${id}|${row.job_id || ''}|${row.cv_url || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ applicant_id: id, job_id: row.job_id ?? null, cv_url: row.cv_url ?? null });
      if (out.length >= MAX_ROWS) break;
    }
    return out;
  }, [rows]);

  const itemsKey = useMemo(
    () => items.map((i) => `${i.applicant_id}|${i.job_id}|${i.cv_url}`).sort().join('~'),
    [items]
  );

  useEffect(() => {
    if (!enabled || items.length === 0) return;

    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

    const pending = items.filter(
      (i) => !warmedRef.current.has(`${i.applicant_id}|${i.job_id}|${i.cv_url}`)
    );
    if (pending.length === 0) return;
    let cancelled = false;

    const run = async () => {
      // 1) Frågor — en query för alla jobb på sidan
      const jobIds = [...new Set(pending.map((i) => i.job_id).filter((j): j is string => !!j))]
        .filter((j) => !questionsCache.get(j));
      if (jobIds.length > 0) {
        try {
          const { data } = await supabase
            .from('job_questions')
            .select('id, job_id, question_text, order_index')
            .in('job_id', jobIds)
            .order('order_index', { ascending: true });
          if (cancelled) return;
          const byJob = new Map<string, Record<string, { text: string; order: number }>>();
          for (const q of data || []) {
            const map = byJob.get(q.job_id) || {};
            map[q.id] = { text: q.question_text, order: q.order_index };
            byJob.set(q.job_id, map);
          }
          for (const [jobId, map] of byJob) {
            if (Object.keys(map).length === 0) continue;
            questionsCache.set(jobId, map);
            setPersistedCacheValue(QUESTIONS_STORAGE_KEY, jobId, map);
          }
        } catch { /* warmup får aldrig störa UI */ }
      }

      if (cancelled) return;

      // 2) AI-sammanfattningar — jobbspecifika + proaktiva profilsammanfattningar
      const needSummary = pending.filter(
        (i) => !summaryCache.get(summaryKey(i.applicant_id, i.job_id, i.cv_url))
      );
      if (needSummary.length > 0) {
        const applicantIds = [...new Set(needSummary.map((i) => i.applicant_id))];
        const summaryJobIds = [...new Set(needSummary.map((i) => i.job_id).filter((j): j is string => !!j))];
        try {
          const [jobRes, profileRes] = await Promise.all([
            summaryJobIds.length > 0
              ? supabase
                  .from('candidate_summaries')
                  .select('applicant_id, job_id, summary_text, key_points')
                  .in('job_id', summaryJobIds)
                  .in('applicant_id', applicantIds)
              : Promise.resolve({ data: [] as any[] }),
            supabase
              .from('profile_cv_summaries')
              .select('user_id, summary_text, key_points, document_type, is_valid_cv, cv_url')
              .in('user_id', applicantIds),
          ]);
          if (cancelled) return;

          const jobMap = new Map<string, any>(
            ((jobRes as any).data || []).map((s: any) => [`${s.applicant_id}-${s.job_id}`, s])
          );
          const profileMap = new Map<string, any>(
            ((profileRes as any).data || []).map((s: any) => [s.user_id, s])
          );

          for (const item of needSummary) {
            const key = summaryKey(item.applicant_id, item.job_id, item.cv_url);
            let value: CandidateSummaryCacheValue | null = null;

            if (!item.cv_url) {
              value = {
                summary_text: 'Kandidaten har inte laddat upp något CV',
                key_points: null,
                document_type: null,
                is_valid_cv: false,
              };
            } else {
              const jobSummary = item.job_id
                ? jobMap.get(`${item.applicant_id}-${item.job_id}`)
                : null;
              if (jobSummary) {
                const meta = extractMeta(jobSummary.key_points);
                // Bara färska sammanfattningar cachas — annars ska dialogen
                // regenerera precis som tidigare.
                if (meta.sourceCvUrl === item.cv_url) {
                  value = {
                    summary_text: jobSummary.summary_text,
                    key_points: jobSummary.key_points || null,
                    document_type: meta.documentType,
                    is_valid_cv: typeof meta.isValidCv === 'boolean'
                      ? meta.isValidCv
                      : !String(jobSummary.summary_text || '').includes('Kan inte läsa av ett CV'),
                  };
                }
              }
              if (!value) {
                const profileSummary = profileMap.get(item.applicant_id);
                if (profileSummary && profileSummary.cv_url === item.cv_url) {
                  value = {
                    summary_text: profileSummary.summary_text || '',
                    key_points: profileSummary.key_points || [],
                    document_type: profileSummary.document_type,
                    is_valid_cv: profileSummary.is_valid_cv,
                  };
                }
              }
            }

            if (value) {
              summaryCache.set(key, value);
              setPersistedCacheValue(SUMMARY_STORAGE_KEY, key, value);
            }
          }
        } catch { /* ignore */ }
      }

      if (cancelled) return;

      // 3) Signera CV-URL:er i förväg (max 20 för att inte spamma storage)
      const cvPaths = [...new Set(pending.map((i) => i.cv_url).filter((c): c is string => !!c))].slice(0, 20);
      for (const path of cvPaths) {
        if (cancelled) return;
        await prefetchMediaUrl(path, 'cv').catch(() => {});
      }

      // Markera först när hela körningen är klar. Tidigare markerades raderna
      // före nätverksanropen; om effekten städades under inloggning/sidbyte
      // avbröts körningen men raderna betraktades ändå som förvärmda för alltid.
      if (!cancelled) {
        pending.forEach((i) => warmedRef.current.add(`${i.applicant_id}|${i.job_id}|${i.cv_url}`));
      }
    };

    // Textdata är liten och måste starta direkt. requestIdleCallback kunde på
    // iPad skjuta upp warmup tills efter att användaren redan öppnat profilen.
    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, itemsKey]);
}

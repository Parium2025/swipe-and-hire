import { useEffect, useMemo, useRef, useState } from 'react';
import { useCandidateRowMediaWarmup } from '@/hooks/useCandidateRowMediaWarmup';
import { useCandidateRowDetailsWarmup } from '@/hooks/useCandidateRowDetailsWarmup';
import { useCvSummaryPreloader } from '@/hooks/useCvSummaryPreloader';

/**
 * 🔥 EN (1) FÖRVÄRMNINGSPIPELINE FÖR EN KANDIDATSIDA
 *
 * Tidigare gissade fyra fristående hooks var för sig när och i vilken ordning
 * de skulle hämta data. Det gjorde att en flik ibland öppnades med spinner
 * (t.ex. anteckningar som bara förvärmdes vid hover) och att tunga
 * medienedladdningar kunde köa bort billig textdata.
 *
 * Den här hooken kör ETT deterministiskt schema för raderna som just nu visas:
 *
 *   Steg 1 (direkt)      Text: anteckningar + aktivitetslogg (2 batchade queries)
 *   Steg 2 (+250 ms)     Media: porträtt i dialogstorlek + profilvideor
 *   Steg 3 (+1200 ms)    AI: CV-sammanfattningar (dyrast, lägst prioritet)
 *
 * Samma pipeline används av /candidates och /my-candidates så att båda vyerna
 * beter sig identiskt. Ren cache-logik — noll UI-bieffekter.
 */

export interface CandidateWarmupRow {
  id?: string;
  applicant_id?: string | null;
  application_id?: string | null;
  job_id?: string | null;
  cv_url?: string | null;
  profile_image_url?: string | null;
  video_url?: string | null;
}

interface Options {
  enabled?: boolean;
  /** Stäng av AI-steget där sammanfattningar inte visas. */
  cvSummaries?: boolean;
}

const MEDIA_DELAY_MS = 250;
const CV_DELAY_MS = 1200;

export function useCandidatePageWarmup(
  rows: CandidateWarmupRow[] | undefined,
  { enabled = true, cvSummaries = true }: Options = {}
) {
  const hasRows = !!rows && rows.length > 0;
  const [stage, setStage] = useState(0);

  // Nyckel som ändras när sidans innehåll faktiskt byts (sidbyte/sortering),
  // så att schemat startas om från steg 1 vid varje ny sida.
  const pageKey = useMemo(
    () => (rows || []).map((r) => r.application_id || r.id || r.applicant_id || '').join('|'),
    [rows]
  );
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!enabled || !hasRows) return;
    if (pageKey === lastKeyRef.current) return;
    lastKeyRef.current = pageKey;

    setStage(1);
    const t1 = window.setTimeout(() => setStage(2), MEDIA_DELAY_MS);
    const t2 = window.setTimeout(() => setStage(3), CV_DELAY_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [enabled, hasRows, pageKey]);

  // Steg 1 — text
  useCandidateRowDetailsWarmup(rows as { applicant_id?: string | null }[] | undefined, enabled && stage >= 1);

  // Steg 2 — media
  useCandidateRowMediaWarmup(rows, enabled && stage >= 2);

  // Steg 3 — AI-sammanfattningar
  const cvRows = useMemo(() => {
    if (!enabled || !cvSummaries || stage < 3) return [];
    return (rows || [])
      .filter((r) => r.applicant_id)
      .map((r) => ({
        applicant_id: r.applicant_id as string,
        application_id: (r.application_id || r.id || '') as string,
        job_id: r.job_id ?? null,
        cv_url: r.cv_url ?? null,
      }));
  }, [rows, enabled, cvSummaries, stage]);

  useCvSummaryPreloader(cvRows);
}

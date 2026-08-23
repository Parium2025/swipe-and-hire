import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  summaryCache,
  setPersistedCacheValue,
  SUMMARY_STORAGE_KEY,
} from '@/components/candidateProfile/candidateProfileCache';
import type { CandidateSummaryCacheValue } from '@/components/candidateProfile/candidateProfileCache';

interface CandidateWithCv {
  applicant_id: string;
  application_id: string;
  job_id: string | null;
  cv_url: string | null;
}

/**
 * Hook som förladdar CV-sammanfattningar i bakgrunden.
 * Kör automatiskt AI-analys för kandidater som har CV men saknar sammanfattning.
 * 
 * Kontrollerar BÅDE profile_cv_summaries (proaktiv) OCH candidate_summaries (jobb-specifik)
 * för att undvika onödig regenerering av samma CV.
 */
export const useCvSummaryPreloader = (candidates: CandidateWithCv[]) => {
  const processedRef = useRef(new Set<string>());
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!candidates || candidates.length === 0) return;

    const preloadSummaries = async () => {
      // Filtrera kandidater som har CV och job_id
      const candidatesWithCv = candidates.filter(
        c => c.cv_url && c.job_id && !processedRef.current.has(c.application_id)
      );

      if (candidatesWithCv.length === 0 || isProcessingRef.current) return;

      isProcessingRef.current = true;

      try {
        const jobIds = [...new Set(candidatesWithCv.map(c => c.job_id).filter(Boolean))] as string[];
        const applicantIds = [...new Set(candidatesWithCv.map(c => c.applicant_id))];

        // 1. Hämta befintliga jobb-specifika sammanfattningar
        const { data: existingSummaries } = await supabase
          .from('candidate_summaries')
          .select('applicant_id, job_id, key_points')
          .in('job_id', jobIds)
          .in('applicant_id', applicantIds);

        const existingJobMap = new Map(
          (existingSummaries || []).map((s: any) => [`${s.applicant_id}-${s.job_id}`, s.key_points])
        );

        // 2. Hämta befintliga proaktiva profil-sammanfattningar
        const { data: profileSummaries } = await supabase
          .from('profile_cv_summaries')
          .select('user_id, cv_url, is_valid_cv')
          .in('user_id', applicantIds);

        const profileMap = new Map(
          (profileSummaries || []).map((s: any) => [s.user_id, s])
        );

        const extractSourceCvUrl = (keyPoints: any) => {
          if (!Array.isArray(keyPoints)) return undefined;
          const docPoint = keyPoints.find(
            (p: any) => typeof p?.text === 'string' && p.text.startsWith('Dokumenttyp:')
          );
          return docPoint?.meta?.source_cv_url as string | undefined;
        };

        // Filtrera bort kandidater som redan har en aktuell sammanfattning
        // (antingen jobb-specifik ELLER proaktiv profil-sammanfattning)
        const candidatesNeedingSummary = candidatesWithCv.filter((c) => {
          // Kolla jobb-specifik sammanfattning
          const jobKey = `${c.applicant_id}-${c.job_id}`;
          const existingKeyPoints = existingJobMap.get(jobKey);
          if (existingKeyPoints) {
            const sourceCvUrl = extractSourceCvUrl(existingKeyPoints);
            // Om sammanfattningen finns och matchar nuvarande CV → skippa
            if (sourceCvUrl && sourceCvUrl === c.cv_url) {
              processedRef.current.add(c.application_id);
              return false;
            }
          }

          // Kolla proaktiv profil-sammanfattning (profile_cv_summaries)
          const profileSummary = profileMap.get(c.applicant_id);
          if (profileSummary && profileSummary.cv_url === c.cv_url) {
            // Profil-sammanfattning finns och matchar → SKIPPA generering
            processedRef.current.add(c.application_id);
            return false;
          }

          // Ingen verifierat aktuell sammanfattning finns. Äldre jobbspecifika
          // rader utan source_cv_url får inte stoppa warmup: dialogen betraktar
          // dem som inaktuella och skulle annars börja generera först vid öppning.
          return true;
        });

        // Generera sammanfattningar i bakgrunden (max 3 samtidigt).
        // Circuit breaker: sluta direkt om gatewayen svarar 402/429, annars
        // bränner vi kvot på anrop som garanterat misslyckas.
        let gatewayBlocked = false;
        const batchSize = 3;
        for (let i = 0; i < candidatesNeedingSummary.length; i += batchSize) {
          if (gatewayBlocked) break;
          const batch = candidatesNeedingSummary.slice(i, i + batchSize);
          
          await Promise.allSettled(
            batch.map(async (candidate) => {
              try {
                const { data, error } = await supabase.functions.invoke('generate-cv-summary', {
                  body: {
                    applicant_id: candidate.applicant_id,
                    application_id: candidate.application_id,
                    job_id: candidate.job_id,
                  },
                });
                const status = (error as { context?: { status?: number } } | null)?.context?.status;
                const message = String((data as { error?: string } | null)?.error ?? error?.message ?? '');
                if (status === 402 || status === 429 || /rate limit|credit/i.test(message)) {
                  gatewayBlocked = true;
                  return;
                }
                if (!error && data?.summary) {
                  const cacheKey = `${candidate.applicant_id}_${candidate.job_id || 'no-job'}_${candidate.cv_url || '__no-cv__'}`;
                  const value: CandidateSummaryCacheValue = {
                    summary_text: data.summary.summary_text || '',
                    key_points: data.summary.key_points || null,
                    document_type: data.document_type || data.summary.document_type || null,
                    is_valid_cv: data.is_valid_cv,
                  };
                  summaryCache.set(cacheKey, value);
                  setPersistedCacheValue(SUMMARY_STORAGE_KEY, cacheKey, value);
                  processedRef.current.add(candidate.application_id);
                }
                console.log(`CV summary generated for ${candidate.application_id}`);
              } catch (error) {
                console.warn(`Failed to generate CV summary for ${candidate.application_id}:`, error);
              }
            })
          );

          // Kort paus mellan batchar
          if (i + batchSize < candidatesNeedingSummary.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (error) {
        console.error('Error preloading CV summaries:', error);
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Kör med en kort fördröjning för att inte blockera initial render
    const timeoutId = setTimeout(preloadSummaries, 1000);

    return () => clearTimeout(timeoutId);
  }, [candidates]);
};

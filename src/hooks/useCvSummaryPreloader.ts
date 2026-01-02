import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CandidateWithCv {
  applicant_id: string;
  application_id: string;
  job_id: string | null;
  cv_url: string | null;
}

/**
 * Hook som förladdar CV-sammanfattningar i bakgrunden.
 * Kör automatiskt AI-analys för kandidater som har CV men saknar sammanfattning.
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
        // Hämta befintliga sammanfattningar (inkl meta för att kunna upptäcka "stale" när kandidaten laddat upp nytt dokument)
        const jobIds = [...new Set(candidatesWithCv.map(c => c.job_id).filter(Boolean))] as string[];
        const applicantIds = [...new Set(candidatesWithCv.map(c => c.applicant_id))];

        const { data: existingSummaries } = await supabase
          .from('candidate_summaries')
          .select('applicant_id, job_id, key_points')
          .in('job_id', jobIds)
          .in('applicant_id', applicantIds);

        const existingMap = new Map(
          (existingSummaries || []).map((s: any) => [`${s.applicant_id}-${s.job_id}`, s.key_points])
        );

        const extractSourceCvUrl = (keyPoints: any) => {
          if (!Array.isArray(keyPoints)) return undefined;
          const docPoint = keyPoints.find(
            (p: any) => typeof p?.text === 'string' && p.text.startsWith('Dokumenttyp:')
          );
          return docPoint?.meta?.source_cv_url as string | undefined;
        };

        // Filtrera bort kandidater som redan har en aktuell sammanfattning
        const candidatesNeedingSummary = candidatesWithCv.filter((c) => {
          const key = `${c.applicant_id}-${c.job_id}`;
          const existingKeyPoints = existingMap.get(key);
          if (!existingKeyPoints) return true; // saknar helt

          const sourceCvUrl = extractSourceCvUrl(existingKeyPoints);
          if (!sourceCvUrl) return true; // äldre format utan meta => regenerera

          return sourceCvUrl !== c.cv_url; // nytt dokument uppladdat => regenerera
        });

        // Generera sammanfattningar i bakgrunden (max 3 samtidigt för att inte överbelasta)
        const batchSize = 3;
        for (let i = 0; i < candidatesNeedingSummary.length; i += batchSize) {
          const batch = candidatesNeedingSummary.slice(i, i + batchSize);
          
          await Promise.allSettled(
            batch.map(async (candidate) => {
              // Markera som behandlad för att undvika dubbletter
              processedRef.current.add(candidate.application_id);

              try {
                await supabase.functions.invoke('generate-cv-summary', {
                  body: {
                    applicant_id: candidate.applicant_id,
                    application_id: candidate.application_id,
                    job_id: candidate.job_id,
                  },
                });
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

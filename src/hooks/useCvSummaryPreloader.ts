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
        // Hämta befintliga sammanfattningar
        const jobIds = [...new Set(candidatesWithCv.map(c => c.job_id).filter(Boolean))] as string[];
        const applicantIds = [...new Set(candidatesWithCv.map(c => c.applicant_id))];

        const { data: existingSummaries } = await supabase
          .from('candidate_summaries')
          .select('applicant_id, job_id')
          .in('job_id', jobIds)
          .in('applicant_id', applicantIds);

        const existingSet = new Set(
          (existingSummaries || []).map(s => `${s.applicant_id}-${s.job_id}`)
        );

        // Filtrera bort kandidater som redan har sammanfattning
        const candidatesNeedingSummary = candidatesWithCv.filter(
          c => !existingSet.has(`${c.applicant_id}-${c.job_id}`)
        );

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

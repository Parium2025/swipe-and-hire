import { Sparkles, Loader2, FileText } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CandidateSummaryCacheValue } from './candidateProfileCache';

interface CandidateSummarySectionProps {
  aiSummary: CandidateSummaryCacheValue | null;
  loadingSummary: boolean;
  generatingSummary: boolean;
  hasCvUrl: boolean;
  signedCvUrl: string | null;
}

export const CandidateSummarySection = ({
  aiSummary,
  loadingSummary,
  generatingSummary,
  hasCvUrl,
  signedCvUrl,
}: CandidateSummarySectionProps) => {
  // Don't show section if explicitly not a valid CV
  if (aiSummary?.is_valid_cv === false) {
    // Show invalid document indicator only if file was uploaded
    if (hasCvUrl) {
      return (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-orange-400" />
            <span className="text-sm text-orange-300">
              Dokumentet är {aiSummary.document_type || 'inte ett CV'} – ingen sammanfattning tillgänglig
            </span>
          </div>
        </div>
      );
    }
    // No CV uploaded
    return (
      <div className="bg-white/10 border border-white/20 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-white" />
          <span className="text-sm text-white">
            Kandidaten har inte laddat upp något CV
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 border border-white/20 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Sammanfattning
          <span className="text-[9px] font-normal normal-case bg-white/20 px-1.5 py-0.5 rounded-full">
            Baserat på CV
          </span>
        </h3>
      </div>

      {loadingSummary || generatingSummary ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-white/50" />
          <span className="ml-2 text-sm text-white/50">Analyserar CV...</span>
        </div>
      ) : aiSummary ? (
        <div>
          {(() => {
            const displayPoints = (aiSummary.key_points || []).filter(
              (point: any) => typeof point?.text === 'string' && !point.text.startsWith('Dokumenttyp:')
            );

            if (displayPoints.length > 0) {
              return (
                <ul className="space-y-1 min-w-0 overflow-hidden">
                  {displayPoints.map((point: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-white min-w-0 overflow-hidden">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                          point.type === 'negative' ? 'bg-red-400' : 'bg-white'
                        }`}
                      />
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate min-w-0 flex-1 cursor-default">{point.text}</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={8} align="start" className="max-w-[280px] break-words whitespace-normal z-[999999]">
                            <p className="text-sm break-words whitespace-pre-wrap">{point.text}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm text-white leading-relaxed truncate min-w-0 cursor-default">
                      {aiSummary.summary_text}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6} className="max-w-[300px] break-words whitespace-normal">
                    <p className="text-sm break-words whitespace-pre-wrap">{aiSummary.summary_text}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })()}
        </div>
      ) : (
        <div className="text-center py-3">
          {signedCvUrl ? (
            <div className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-white/50" />
              <span className="ml-2 text-sm text-white/50">Laddar sammanfattning...</span>
            </div>
          ) : (
            <p className="text-sm text-white text-center">
              Kandidaten har inte laddat upp något CV
            </p>
          )}
        </div>
      )}
    </div>
  );
};

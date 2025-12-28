import { Check, X, AlertCircle } from 'lucide-react';
import { CandidateCriteriaResults } from '@/hooks/useCriteriaResults';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CriteriaResultsBadgesProps {
  results: CandidateCriteriaResults | undefined;
  maxDisplay?: number;
}

export function CriteriaResultsBadges({ results, maxDisplay = 3 }: CriteriaResultsBadgesProps) {
  if (!results || results.results.length === 0) {
    return null;
  }

  // Only show results if evaluation is completed
  if (results.status !== 'completed') {
    return null;
  }

  const displayResults = results.results.slice(0, maxDisplay);

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {displayResults.map((result) => (
        <CriterionBadge 
          key={result.id} 
          result={result.result}
          title={result.criterion_title || 'Kriterium'}
          reasoning={result.reasoning}
        />
      ))}
    </div>
  );
}

interface CriterionBadgeProps {
  result: 'match' | 'no_match' | 'no_data';
  title: string;
  reasoning?: string | null;
}

function CriterionBadge({ result, title, reasoning }: CriterionBadgeProps) {
  const config = {
    match: { 
      icon: Check, 
      iconColor: 'text-green-400', 
      bg: 'bg-green-500/20',
      border: 'ring-green-500/30',
    },
    no_match: { 
      icon: X, 
      iconColor: 'text-red-400', 
      bg: 'bg-red-500/20',
      border: 'ring-red-500/30',
    },
    no_data: { 
      icon: AlertCircle, 
      iconColor: 'text-yellow-400', 
      bg: 'bg-yellow-500/20',
      border: 'ring-yellow-500/30',
    },
  };

  const { icon: Icon, iconColor, bg, border } = config[result];

  const badge = (
    <div
      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] ${bg} ring-1 ring-inset ${border}`}
    >
      <Icon className={`h-2.5 w-2.5 ${iconColor} flex-shrink-0`} />
      <span className="text-white/80 truncate max-w-[50px]">{title}</span>
    </div>
  );

  if (reasoning) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="max-w-xs bg-card-parium border-white/20 text-white text-xs"
          >
            <p>{reasoning}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

// Compact version for very small spaces - just icons
interface CriteriaIconsProps {
  results: CandidateCriteriaResults | undefined;
}

export function CriteriaIcons({ results }: CriteriaIconsProps) {
  if (!results || results.results.length === 0 || results.status !== 'completed') {
    return null;
  }

  const matchCount = results.results.filter(r => r.result === 'match').length;
  const noMatchCount = results.results.filter(r => r.result === 'no_match').length;
  const noDataCount = results.results.filter(r => r.result === 'no_data').length;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {matchCount > 0 && (
              <div className="flex items-center gap-0.5 text-green-400">
                <Check className="h-2.5 w-2.5" />
                <span className="text-[9px]">{matchCount}</span>
              </div>
            )}
            {noMatchCount > 0 && (
              <div className="flex items-center gap-0.5 text-red-400">
                <X className="h-2.5 w-2.5" />
                <span className="text-[9px]">{noMatchCount}</span>
              </div>
            )}
            {noDataCount > 0 && (
              <div className="flex items-center gap-0.5 text-yellow-400">
                <AlertCircle className="h-2.5 w-2.5" />
                <span className="text-[9px]">{noDataCount}</span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-card-parium border-white/20 text-white text-xs"
        >
          <div className="space-y-1">
            {results.results.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {r.result === 'match' && <Check className="h-3 w-3 text-green-400" />}
                {r.result === 'no_match' && <X className="h-3 w-3 text-red-400" />}
                {r.result === 'no_data' && <AlertCircle className="h-3 w-3 text-yellow-400" />}
                <span>{r.criterion_title}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

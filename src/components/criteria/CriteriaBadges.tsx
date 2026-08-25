import { Check, X, AlertCircle, Sparkles } from 'lucide-react';

// Badge showing criterion title + result icon (used on candidate cards)
interface CriterionResultBadgeProps {
  result: 'match' | 'no_match' | 'no_data';
  title: string;
  reasoning?: string;
}

export function CriterionResultBadge({ result, title, reasoning }: CriterionResultBadgeProps) {
  const config = {
    match: {
      icon: Check,
      iconColor: 'text-green-400',
      ringColor: 'ring-green-500/50',
      bg: 'bg-green-500/10',
    },
    no_match: {
      icon: X,
      iconColor: 'text-red-400',
      ringColor: 'ring-red-500/50',
      bg: 'bg-red-500/10',
    },
    no_data: {
      icon: AlertCircle,
      iconColor: 'text-yellow-400',
      ringColor: 'ring-yellow-500/50',
      bg: 'bg-yellow-500/10',
    },
  };

  const { icon: Icon, iconColor, ringColor, bg } = config[result];

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${bg}`}
      title={reasoning}
    >
      <span className={`flex items-center justify-center h-3.5 w-3.5 rounded-full ring-1 ${ringColor} ${bg}`}>
        <Icon className={`h-2 w-2 ${iconColor}`} />
      </span>
      <span className="text-white/80 truncate max-w-[140px]" title={title}>{title}</span>
    </div>
  );
}

// Compact icon badge — no_data is rendered like no_match (binary display)
interface CriterionIconBadgeProps {
  result: 'match' | 'no_match' | 'no_data';
  title: string;
}

export function CriterionIconBadge({ result, title }: CriterionIconBadgeProps) {
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
      icon: X,
      iconColor: 'text-red-400',
      bg: 'bg-red-500/20',
      border: 'ring-red-500/30',
    },
  };

  const { icon: Icon, iconColor, bg, border } = config[result];

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${bg} ring-1 ring-inset ${border}`}>
      <Icon className={`h-3 w-3 ${iconColor} flex-shrink-0`} />
      <span className="text-white/80 truncate max-w-[140px]" title={title}>{title}</span>
    </span>
  );
}

// Aggregated "X/Y kriterier uppfyllda" pill — for quick candidate scanning
interface CriteriaSummaryPillProps {
  results: { result: 'match' | 'no_match' | 'no_data' }[];
  totalCriteria: number;
}

export function CriteriaSummaryPill({ results, totalCriteria }: CriteriaSummaryPillProps) {
  if (!totalCriteria || totalCriteria === 0 || results.length === 0) return null;
  const matches = results.filter(r => r.result === 'match').length;
  const pct = matches / totalCriteria;

  // Tone: green ≥75%, amber 40–74%, red <40%
  const tone =
    pct >= 0.75
      ? { bg: 'bg-green-500/20', ring: 'ring-green-500/40', text: 'text-green-300' }
      : pct >= 0.4
        ? { bg: 'bg-amber-500/20', ring: 'ring-amber-500/40', text: 'text-amber-300' }
        : { bg: 'bg-red-500/20', ring: 'ring-red-500/40', text: 'text-red-300' };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${tone.bg} ${tone.text} ring-1 ring-inset ${tone.ring}`}
      aria-label={`${matches} av ${totalCriteria} kriterier uppfyllda`}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {matches}/{totalCriteria}
    </span>
  );
}

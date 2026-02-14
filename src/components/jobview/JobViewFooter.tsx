import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Timer } from 'lucide-react';
import { getTimeRemaining } from '@/lib/date';

interface JobViewFooterProps {
  createdAt: string;
  expiresAt?: string;
}

export const JobViewFooter = memo(function JobViewFooter({ createdAt, expiresAt }: JobViewFooterProps) {
  const { text, isExpired } = getTimeRemaining(createdAt, expiresAt);

  return (
    <div data-job-footer className="flex items-center justify-center gap-3 py-2 text-xs">
      <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none">
        Publicerad: {new Date(createdAt).toLocaleDateString('sv-SE', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </Badge>
      {isExpired ? (
        <Badge variant="glass" className="text-[11px] px-2 py-0.5 bg-red-500/20 text-white border-red-500/30 leading-none">
          Utgången
        </Badge>
      ) : (
        <Badge variant="glass" className="text-[11px] px-2 py-0.5 border-white/15 leading-none">
          <Timer className="h-3 w-3 mr-1" />
          {text} kvar
        </Badge>
      )}
    </div>
  );
});

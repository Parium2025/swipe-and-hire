import { memo, type MouseEvent } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface RemovedApplicantsInfoProps {
  count?: number | null;
}

/**
 * Anonym räknare: visas ENDAST när minst en sökande i just den här annonsen
 * har raderat sitt konto. Siffran är klickbar och förklarar varför antalet
 * ansökningar kan ha minskat. Inga personuppgifter visas.
 */
export const RemovedApplicantsInfo = memo(({ count }: RemovedApplicantsInfoProps) => {
  if (!count || count <= 0) return null;

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="flex items-center justify-between gap-3" onClick={stop}>
      <span className="text-sm leading-snug text-white">Raderade konton:</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={stop}
            aria-label="Vad betyder raderade konton?"
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-1.5 -mr-1.5 text-sm font-medium leading-snug text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {count}
            <Info className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[260px] text-sm leading-relaxed"
          onClick={stop}
        >
          <p className="font-medium text-foreground">Raderade konton</p>
          <p className="mt-1.5 text-foreground/90">
            {count === 1 ? 'En sökande har' : `${count} sökande har`} raderat sitt konto, eller
            fått det automatiskt raderat efter lång inaktivitet. Ansökningarna togs bort helt –
            därför kan antalet ansökningar ha minskat.
          </p>
          <p className="mt-2 text-foreground/70">
            Siffran är helt anonym. Inga personuppgifter sparas.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
});

RemovedApplicantsInfo.displayName = 'RemovedApplicantsInfo';

import { memo, useState, type MouseEvent } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

/**
 * Kompakt variant: en liten info-ikon som kan placeras direkt bredvid
 * ansökningsräknaren i annonsens header. Samma anonyma information,
 * men synlig för alla kollegor som öppnar annonsen.
 */
export const RemovedApplicantsBadge = memo(({ count }: RemovedApplicantsInfoProps) => {
  const [open, setOpen] = useState(false);

  if (!count || count <= 0) return null;

  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-label="Varför har antalet ansökningar minskat?"
          className="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:hover:text-white"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="max-w-[270px] px-3 py-2 leading-relaxed"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-medium">Kandidat borttagen:</p>
        <p className="mt-1">
          {count === 1
            ? 'En kandidat har raderat sitt konto, eller fått det automatiskt raderat efter lång inaktivitet. En kandidat har tagits bort från den här annonsen.'
            : `${count} kandidater har raderat sina konton, eller fått dem automatiskt raderade efter lång inaktivitet. ${count} kandidater har tagits bort från den här annonsen.`}
        </p>

      </TooltipContent>
    </Tooltip>
  );
});



RemovedApplicantsBadge.displayName = 'RemovedApplicantsBadge';

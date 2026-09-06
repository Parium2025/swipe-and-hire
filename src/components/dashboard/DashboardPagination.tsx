import { memo, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Match wizard footer button styling (Tillbaka / Nästa in "Skapa annons")
const backButtonClasses =
  'rounded-full bg-white/[0.07] border border-white/20 text-white px-4 py-2 transition-colors duration-150 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 [&_svg]:text-white focus:outline-none focus:ring-0 focus-visible:ring-0';

const nextButtonClasses =
  'rounded-full bg-secondary hover:bg-secondary/90 md:hover:bg-secondary/90 text-white px-8 py-2 border border-white/10 shadow-sm transition-colors duration-150 [&_svg]:text-white focus:outline-none focus:ring-0 focus-visible:ring-0';

// Sifferknappar – ren text i vitt, ingen ruta, ingen hover-bakgrund.
// Aktiv sida markeras med en mjuk underline.
const pageNumberBaseClasses =
  'inline-flex h-9 min-w-9 items-center justify-center px-2 text-sm text-white bg-transparent border-0 rounded-none cursor-pointer transition-opacity duration-150 hover:!bg-transparent hover:!text-white focus:outline-none focus:ring-0 focus-visible:ring-0';

interface DashboardPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Compact mode shows only current page (used on mobile) */
  compact?: boolean;
}

export const DashboardPagination = memo(({ page, totalPages, onPageChange, compact = false }: DashboardPaginationProps) => {
  // Hoppa direkt till valfri sida — vid hundratals sidor är det enda rimliga
  // sättet att nå t.ex. sida 20 utan att klicka "Nästa" nitton gånger.
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState('');

  useEffect(() => {
    if (jumpOpen) setJumpValue(String(page));
  }, [jumpOpen, page]);

  if (totalPages <= 1) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    onPageChange(Math.max(1, page - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    onPageChange(Math.min(totalPages, page + 1));
  };

  const goTo = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    onPageChange(p);
  };

  const submitJump = () => {
    const parsed = Number.parseInt(jumpValue, 10);
    if (Number.isFinite(parsed)) {
      onPageChange(Math.min(totalPages, Math.max(1, parsed)));
    }
    setJumpOpen(false);
  };

  const PageNumber = ({ p }: { p: number }) => {
    const isActive = p === page;
    const numberButton = (
      <button
        type="button"
        onClick={isActive ? (e) => { e.preventDefault(); setJumpOpen(true); } : goTo(p)}
        aria-current={isActive ? 'page' : undefined}
        aria-label={isActive ? `Sida ${p} av ${totalPages}. Gå till sida` : `Gå till sida ${p}`}
        className={cn(
          pageNumberBaseClasses,
          isActive
            ? 'font-semibold relative after:content-[""] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-0 after:h-[2px] after:w-4 after:rounded-full after:bg-white'
            : 'opacity-70 hover:opacity-100'
        )}
      >
        {p}
      </button>
    );

    if (!isActive) return numberButton;

    return (
      <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
        <PopoverTrigger asChild>{numberButton}</PopoverTrigger>
        <PopoverContent
          align="center"
          sideOffset={8}
          className="w-auto border-white/20 p-3"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="text-xs text-white mb-2">Gå till sida (1–{totalPages})</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={totalPages}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitJump();
                }
              }}
              aria-label="Sidnummer"
              className="h-10 w-24 text-base bg-white/5 border-white/20 text-white"
            />
            <Button type="button" onClick={submitJump} className={cn(nextButtonClasses, 'px-5')}>
              Gå
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };


  const PrevBtn = (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrev}
      disabled={page === 1}
      aria-label="Föregående sida"
      className={cn(
        backButtonClasses,
        "shrink-0 whitespace-nowrap",
        page === 1 && "pointer-events-none opacity-50"
      )}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      <span>Föregående</span>
    </Button>
  );

  const NextBtn = (
    <Button
      type="button"
      onClick={handleNext}
      disabled={page === totalPages}
      aria-label="Nästa sida"
      className={cn(
        nextButtonClasses,
        "shrink-0 whitespace-nowrap",
        page === totalPages && "pointer-events-none opacity-50"
      )}
    >
      <span>Nästa</span>
      <ArrowRight className="h-4 w-4 ml-2" />
    </Button>
  );

  if (compact) {
    return (
      <Pagination className="mt-3">
        <PaginationContent>
          <PaginationItem>{PrevBtn}</PaginationItem>
          <PaginationItem><PageNumber p={page} /></PaginationItem>
          <PaginationItem>{NextBtn}</PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  }

  return (
    <Pagination className="mt-4">
      <PaginationContent>
        <PaginationItem>{PrevBtn}</PaginationItem>

        {page > 2 && (
          <>
            <PaginationItem><PageNumber p={1} /></PaginationItem>
            {page > 3 && <PaginationEllipsis className="text-white" />}
          </>
        )}

        {page > 1 && (
          <PaginationItem><PageNumber p={page - 1} /></PaginationItem>
        )}

        <PaginationItem><PageNumber p={page} /></PaginationItem>

        {page < totalPages && (
          <PaginationItem><PageNumber p={page + 1} /></PaginationItem>
        )}

        {page < totalPages - 1 && (
          <>
            {page < totalPages - 2 && <PaginationEllipsis className="text-white" />}
            <PaginationItem><PageNumber p={totalPages} /></PaginationItem>
          </>
        )}

        <PaginationItem>{NextBtn}</PaginationItem>
      </PaginationContent>
    </Pagination>
  );
});

DashboardPagination.displayName = 'DashboardPagination';

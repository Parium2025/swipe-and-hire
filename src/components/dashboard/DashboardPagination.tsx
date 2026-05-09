import { memo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Match wizard footer button styling (Tillbaka / Nästa in "Skapa annons")
const backButtonClasses =
  'rounded-full bg-white/5 backdrop-blur-sm border border-white/20 text-white px-4 py-2 transition-colors duration-150 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 [&_svg]:text-white focus:outline-none focus:ring-0 focus-visible:ring-0';

const nextButtonClasses =
  'rounded-full bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 transition-colors duration-150 focus:outline-none focus:ring-0 focus-visible:ring-0';

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

  const PageNumber = ({ p }: { p: number }) => {
    const isActive = p === page;
    return (
      <button
        type="button"
        onClick={goTo(p)}
        aria-current={isActive ? 'page' : undefined}
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

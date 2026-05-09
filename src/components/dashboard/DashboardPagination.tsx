import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";

interface DashboardPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Compact mode shows only current page (used on mobile) */
  compact?: boolean;
}

const navBtnBase =
  "inline-flex items-center gap-1 h-9 px-2.5 rounded-md text-sm text-white hover:bg-white/10 transition-colors";

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

  const PrevBtn = (
    <button
      type="button"
      onClick={handlePrev}
      disabled={page === 1}
      aria-label="Föregående sida"
      className={`${navBtnBase} ${page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
    >
      <ChevronLeft className="h-4 w-4" />
      <span>Föregående</span>
    </button>
  );

  const NextBtn = (
    <button
      type="button"
      onClick={handleNext}
      disabled={page === totalPages}
      aria-label="Nästa sida"
      className={`${navBtnBase} ${page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
    >
      <span>Nästa</span>
      <ChevronRight className="h-4 w-4" />
    </button>
  );

  if (compact) {
    return (
      <Pagination className="mt-3">
        <PaginationContent>
          <PaginationItem>{PrevBtn}</PaginationItem>
          <PaginationItem>
            <PaginationLink isActive className="text-white">{page}</PaginationLink>
          </PaginationItem>
          <PaginationItem>{NextBtn}</PaginationItem>
        </PaginationContent>
        <span className="ml-4 text-sm text-white">Sida {page} av {totalPages}</span>
      </Pagination>
    );
  }

  return (
    <Pagination className="mt-4">
      <PaginationContent>
        <PaginationItem>{PrevBtn}</PaginationItem>

        {page > 2 && (
          <>
            <PaginationItem>
              <PaginationLink onClick={goTo(1)} className="cursor-pointer text-white">1</PaginationLink>
            </PaginationItem>
            {page > 3 && <PaginationEllipsis className="text-white" />}
          </>
        )}

        {page > 1 && (
          <PaginationItem>
            <PaginationLink onClick={goTo(page - 1)} className="cursor-pointer text-white">{page - 1}</PaginationLink>
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationLink isActive className="text-white">{page}</PaginationLink>
        </PaginationItem>

        {page < totalPages && (
          <PaginationItem>
            <PaginationLink onClick={goTo(page + 1)} className="cursor-pointer text-white">{page + 1}</PaginationLink>
          </PaginationItem>
        )}

        {page < totalPages - 1 && (
          <>
            {page < totalPages - 2 && <PaginationEllipsis className="text-white" />}
            <PaginationItem>
              <PaginationLink onClick={goTo(totalPages)} className="cursor-pointer text-white">{totalPages}</PaginationLink>
            </PaginationItem>
          </>
        )}

        <PaginationItem>{NextBtn}</PaginationItem>
      </PaginationContent>
      <span className="ml-4 text-sm text-white">Sida {page} av {totalPages}</span>
    </Pagination>
  );
});

DashboardPagination.displayName = 'DashboardPagination';
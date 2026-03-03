import { memo } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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

  if (compact) {
    return (
      <Pagination className="mt-3">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={handlePrev} className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink isActive>{page}</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext onClick={handleNext} className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
          </PaginationItem>
        </PaginationContent>
        <span className="ml-4 text-sm text-white">Sida {page} av {totalPages}</span>
      </Pagination>
    );
  }

  return (
    <Pagination className="mt-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious onClick={handlePrev} className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
        </PaginationItem>

        {page > 2 && (
          <>
            <PaginationItem>
              <PaginationLink onClick={goTo(1)} className="cursor-pointer">1</PaginationLink>
            </PaginationItem>
            {page > 3 && <PaginationEllipsis />}
          </>
        )}

        {page > 1 && (
          <PaginationItem>
            <PaginationLink onClick={goTo(page - 1)} className="cursor-pointer">{page - 1}</PaginationLink>
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationLink isActive>{page}</PaginationLink>
        </PaginationItem>

        {page < totalPages && (
          <PaginationItem>
            <PaginationLink onClick={goTo(page + 1)} className="cursor-pointer">{page + 1}</PaginationLink>
          </PaginationItem>
        )}

        {page < totalPages - 1 && (
          <>
            {page < totalPages - 2 && <PaginationEllipsis />}
            <PaginationItem>
              <PaginationLink onClick={goTo(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <PaginationNext onClick={handleNext} className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
        </PaginationItem>
      </PaginationContent>
      <span className="ml-4 text-sm text-white">Sida {page} av {totalPages}</span>
    </Pagination>
  );
});

DashboardPagination.displayName = 'DashboardPagination';
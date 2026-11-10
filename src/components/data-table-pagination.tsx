"use client";
// The Previous/Next buttons attach onClick handlers that call the caller's
// onPageChange. A Server Component's output cannot carry a live event
// handler, so this needs the client runtime even though - per the
// acceptance criteria - it owns no state hooks of its own anywhere in this
// file: page/pageCount/onPageChange are all the caller's.

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

export interface DataTablePaginationProps {
  /** 1-indexed current page. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Presentation-only pager over `ui/pagination` (8.2.12). Every admin table
 * (appointments, patients, services) renders this the same way and owns its
 * own page/URL state above it; this component just reports a page number
 * back and renders whatever `page`/`pageCount` it was given - it never reads
 * the URL and never remembers a page across renders.
 */
export function DataTablePagination({
  page,
  pageCount,
  onPageChange,
  className,
}: DataTablePaginationProps) {
  const canGoPrevious = page > 1;
  const canGoNext = page < pageCount;

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 ps-2.5"
            aria-label="الصفحة السابقة"
            disabled={!canGoPrevious}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            <span>Previous</span>
          </Button>
        </PaginationItem>
        <PaginationItem>
          {/* Status is text, not implied by button disabled-state alone. */}
          <span className={cn("px-2 text-sm text-muted-foreground")} aria-live="polite">
            Page {page} of {pageCount}
          </span>
        </PaginationItem>
        <PaginationItem>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 pe-2.5"
            aria-label="الصفحة التالية"
            disabled={!canGoNext}
            onClick={() => onPageChange(page + 1)}
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

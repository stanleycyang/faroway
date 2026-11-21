import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  function href(page: number) {
    return page === 1 ? basePath : `${basePath}?page=${page}`;
  }

  // Build page numbers: always show first, last, current, and neighbors
  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2 mt-16"
    >
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={href(currentPage - 1)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-white border border-[#DCE5E3] hover:bg-[#EFF5F3] hover:text-slate-900 transition-all"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Prev
        </Link>
      ) : (
        <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 border border-[#DCE5E3] opacity-60 cursor-not-allowed">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Prev
        </span>
      )}

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="w-10 text-center text-slate-600 text-sm select-none"
            >
              ...
            </span>
          ) : p === currentPage ? (
            <span
              key={p}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-semibold text-white bg-primary-700 shadow-sm"
            >
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium text-slate-700 bg-white border border-[#DCE5E3] hover:bg-[#EFF5F3] hover:text-slate-900 transition-all"
            >
              {p}
            </Link>
          ),
        )}
      </div>

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={href(currentPage + 1)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-white border border-[#DCE5E3] hover:bg-[#EFF5F3] hover:text-slate-900 transition-all"
        >
          Next
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 border border-[#DCE5E3] opacity-60 cursor-not-allowed">
          Next
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

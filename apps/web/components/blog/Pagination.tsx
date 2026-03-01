import Link from "next/link";

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
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:text-slate-900 transition-all"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Prev
        </Link>
      ) : (
        <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-gray-100 border border-gray-200 cursor-not-allowed">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Prev
        </span>
      )}

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="w-10 text-center text-slate-400 text-sm select-none"
            >
              ...
            </span>
          ) : p === currentPage ? (
            <span
              key={p}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-amber-500 shadow-lg shadow-primary/25"
            >
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium text-slate-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:text-slate-900 transition-all"
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
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:text-slate-900 transition-all"
        >
          Next
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      ) : (
        <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-gray-100 border border-gray-200 cursor-not-allowed">
          Next
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </span>
      )}
    </nav>
  );
}

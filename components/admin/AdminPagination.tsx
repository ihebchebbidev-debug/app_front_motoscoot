import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isFetching?: boolean;
}

/**
 * Compact admin-table pagination: Previous / page numbers (with ellipsis) / Next.
 * Shows "X-Y of Z" so admins always know the result span at a glance.
 */
export const AdminPagination: React.FC<AdminPaginationProps> = ({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange,
  isFetching,
}) => {
  // Compute the windowed page list once per render. We always show first &
  // last, the current page ±1, and ellipsis for any gap > 1.
  const pageItems = useMemo<Array<number | 'ellipsis'>>(() => {
    if (totalPages <= 1) return [];
    const window = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    const sorted = Array.from(window).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out: Array<number | 'ellipsis'> = [];
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) out.push('ellipsis');
      out.push(n);
    });
    return out;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  const navBtn =
    'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-card text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500">
        {isFetching ? 'Chargement…' : <>Affichage <span className="text-gray-900 font-bold">{start}–{end}</span> sur <span className="text-gray-900 font-bold">{total}</span></>}
      </p>

      <nav className="flex items-center gap-1.5" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={navBtn}
          aria-label="Page précédente"
        >
          <ChevronLeft size={16} />
        </button>

        {pageItems.map((it, i) =>
          it === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-1 text-xs font-bold text-gray-400 select-none">…</span>
          ) : (
            <button
              key={it}
              type="button"
              onClick={() => onPageChange(it)}
              aria-current={it === currentPage ? 'page' : undefined}
              className={`min-w-9 h-9 px-2 rounded-lg text-xs font-bold transition-colors ${
                it === currentPage
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {it}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={navBtn}
          aria-label="Page suivante"
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
};

export default AdminPagination;

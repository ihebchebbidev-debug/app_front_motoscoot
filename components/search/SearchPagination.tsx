import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const S = {
  Pagination: "flex items-center justify-center gap-2 mt-16 md:mt-20 pb-10",
  // Augmentation de la taille à h-12/w-12 (48px) pour un confort tactile optimal
  PageBtn: (active: boolean) => `
    w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-xl font-bold transition-all 
    ${active 
      ? 'bg-primary-600 text-white shadow-lg shadow-orange-600/20 scale-110 z-10' 
      : 'bg-card border border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200 active:scale-95 shadow-sm'}
  `,
  NavBtn: "w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-card border border-gray-100 text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100",
};

/**
 * SearchPagination - Standard de Marché (Best-in-Class)
 * Priorise la clarté visuelle et la facilité de clic sur mobile.
 */
export const SearchPagination: React.FC<PaginationProps> = ({ 
  currentPage, 
  totalPages, 
  onPageChange 
}) => {
  if (totalPages <= 1) return null;

  // Logique pour n'afficher que quelques numéros (pagination intelligente)
  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <button 
          key={i} 
          onClick={() => onPageChange(i)} 
          className={S.PageBtn(currentPage === i)}
          aria-current={currentPage === i ? 'page' : undefined}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <nav className={S.Pagination} aria-label="Navigation des pages de résultats">
      <button 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1} 
        className={S.NavBtn}
        aria-label="Page précédente"
      >
        <ChevronLeft size={22} strokeWidth={2.5} />
      </button>
      
      <div className="flex items-center gap-1.5 md:gap-2">
        {renderPageNumbers()}
      </div>
      
      <button 
        onClick={() => onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages} 
        className={S.NavBtn}
        aria-label="Page suivante"
      >
        <ChevronRight size={22} strokeWidth={2.5} />
      </button>
    </nav>
  );
};
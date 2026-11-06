import React, { useState, useEffect } from 'react';
import { ArrowUpDown, X, Check, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';

export interface FilterOption {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

export interface FilterBarProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy?: 'recent' | 'oldest';
  onSortChange?: (sort: 'recent' | 'oldest') => void;
  searchPlaceholder?: string;
  showSort?: boolean;
  extraFilters?: FilterOption[];
  categoriesVariant?: 'list' | 'dropdown';
  categoryLabel?: string;
  searchWidth?: string;
  /** A real sort with any options (e.g. price, cylinder). When given, the
   *  phone sort button opens a sort panel with these options. */
  sortOptions?: { value: string; label: string }[];
  sortValue?: string;
  onSortValueChange?: (value: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  sortBy = 'recent',
  onSortChange,
  searchPlaceholder = "Rechercher...",
  showSort = true,
  extraFilters = [],
  categoriesVariant = 'list',
  categoryLabel = "Toutes les catégories",
  searchWidth = "w-64",
  sortOptions,
  sortValue,
  onSortValueChange,
}) => {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);

  // The phone sort button only exists when there is something to sort: it
  // used to show « Plus récentes » on every page, sorting nothing.
  const hasCustomSort = !!(sortOptions?.length && onSortValueChange);
  const hasSort = hasCustomSort || (showSort && !!onSortChange);
  const sortLabel = hasCustomSort
    ? sortOptions!.find((o) => o.value === sortValue)?.label ?? sortOptions![0].label
    : sortBy === 'recent' ? 'Plus récentes' : 'Plus anciennes';

  useEffect(() => {
    if (isSortMenuOpen || isSortSheetOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isSortMenuOpen, isSortSheetOpen]);

  useEffect(() => {
    if (!isSortSheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsSortSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSortSheetOpen]);

  const handleCategoryChange = (cat: string) => {
    onCategoryChange(cat);
    setIsSortMenuOpen(false);
  };

  return (
    <>
      {/* Mobile filter bar — mirrors the search/listing page:
          left = white sort pill, right = dark Filtres button. The search
          input lives inside the modal so the row stays clean and matches
          the rest of the app. */}
      <div className="md:hidden flex flex-col w-full px-6 mt-1 mb-4 relative z-40">
        <div className="flex gap-2">
          {hasSort && (
            <button
              onClick={() => (hasCustomSort ? setIsSortSheetOpen(true) : setIsSortMenuOpen(true))}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 h-12 px-4 bg-card border border-gray-100 rounded-2xl shadow-sm active:scale-[0.98] transition-all font-bold text-[15px] text-gray-900"
              aria-label={`Trier : ${sortLabel}`}
              aria-haspopup="dialog"
            >
              <span className="flex items-center gap-2 min-w-0">
                <ArrowUpDown size={16} className="text-gray-700 shrink-0" />
                <span className="truncate">{sortLabel}</span>
              </span>
              <ChevronDown size={16} className="text-gray-400 shrink-0" />
            </button>
          )}
          <button
            onClick={() => setIsSortMenuOpen(true)}
            className={`${hasSort ? 'shrink-0' : 'flex-1'} flex items-center justify-center gap-2 h-12 px-6 bg-gray-900 text-white rounded-2xl shadow-md active:scale-[0.98] transition-all font-bold text-[15px]`}
            aria-label="Filtres"
          >
            <SlidersHorizontal size={18} />
            <span>Filtres</span>
          </button>
        </div>
      </div>
      <div className="md:hidden">
        {/* Sort panel (phones): one tap chooses and closes. */}
        {isSortSheetOpen && hasCustomSort && (
          <div
            className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsSortSheetOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Trier"
              className="w-full bg-card rounded-t-[32px] px-6 pt-6 pb-10 shadow-2xl animate-fade-in-up border-t border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Trier par</h3>
                <button
                  onClick={() => setIsSortSheetOpen(false)}
                  aria-label="Fermer"
                  className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-full text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <ul className="divide-y divide-gray-100">
                {sortOptions!.map((opt) => {
                  const active = opt.value === sortValue;
                  return (
                    <li key={opt.value}>
                      <button
                        autoFocus={active}
                        aria-pressed={active}
                        onClick={() => { onSortValueChange!(opt.value); setIsSortSheetOpen(false); }}
                        className={`w-full min-h-12 flex items-center justify-between gap-3 py-3 text-left text-[16px] ${active ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}
                      >
                        {opt.label}
                        {active && <Check size={18} className="text-primary-700 shrink-0" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Hidden search input retained inside modal via categories/sort UI below. */}

        {isSortMenuOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full bg-card rounded-t-[32px] p-8 pb-12 shadow-2xl animate-fade-in-up border-t border-gray-100 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Trier et Filtrer</h3>
                <button onClick={() => setIsSortMenuOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Recherche</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary-200 focus:bg-card transition-all"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>
                {categories.length > 0 && (
                  <div>
                    <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Catégories</label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button 
                          key={cat} 
                          onClick={() => handleCategoryChange(cat)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border ${activeCategory === cat ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-card text-gray-600 border-gray-100'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {extraFilters.map(filter => (
                  <div key={filter.id}>
                    <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-4 block">{filter.label}</label>
                    <div className="flex flex-wrap gap-2">
                      {filter.options.map(opt => (
                        <button 
                          key={opt} 
                          onClick={() => filter.onChange(opt)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border ${filter.value === opt ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-card text-gray-600 border-gray-100'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {showSort && onSortChange && (
                  <div>
                    <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Ordre d'affichage</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => onSortChange('recent')}
                        className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-bold transition-all border ${sortBy === 'recent' ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-transparent'}`}
                      >
                        Plus récents {sortBy === 'recent' && <Check size={14} />}
                      </button>
                      <button 
                        onClick={() => onSortChange('oldest')}
                        className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-bold transition-all border ${sortBy === 'oldest' ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-transparent'}`}
                      >
                        Plus anciens {sortBy === 'oldest' && <Check size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => setIsSortMenuOpen(false)}
                  className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl text-sm uppercase tracking-widest shadow-xl mt-4"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barre de Filtres Secondaire Desktop - Alignée sur max-w-[1440px] */}
      <div className="hidden md:block">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32 relative z-[60]">
          <div className="bg-card rounded-2xl md:rounded-[24px] p-2 shadow-xl border border-gray-100 flex items-center w-full -mt-10 relative z-30">
              {(categories.length > 0 || categoriesVariant === 'dropdown') && (
                <>
                  {categoriesVariant === 'dropdown' ? (
                    <div className="flex items-center gap-2 px-1">
                      <select
                        value={activeCategory}
                        onChange={(e) => onCategoryChange(e.target.value)}
                        className="bg-gray-50 border border-transparent rounded-xl px-4 py-2.5 text-[12px] font-bold text-gray-900 outline-none focus:bg-card focus:border-primary-100 transition-all cursor-pointer appearance-none min-w-[200px]"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '35px' }}
                      >
                        <option value="Tout">{categoryLabel}</option>
                        {categories.filter(c => c !== 'Tout').map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 px-1">
                      {categories.map(cat => (
                        <button 
                          key={cat} 
                          onClick={() => onCategoryChange(cat)} 
                          className={`px-5 py-2.5 rounded-xl text-[12px] font-[900] uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="h-8 w-px bg-gray-100 mx-3 hidden md:block"></div>
                </>
              )}

              {extraFilters.length > 0 && (
                <div className="hidden md:flex items-center gap-2 mr-3">
                  {extraFilters.map(filter => (
                    <div key={filter.id} className="relative">
                      <select
                        value={filter.value}
                        onChange={(e) => filter.onChange(e.target.value)}
                        className="bg-gray-50 border border-transparent rounded-xl px-4 py-2.5 text-[12px] font-bold text-gray-900 outline-none focus:bg-card focus:border-primary-100 transition-all cursor-pointer appearance-none min-w-[140px]"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '35px' }}
                      >
                        {filter.options.map(opt => (
                          <option key={opt} value={opt}>{opt === 'Tout' ? filter.label : opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <div className="h-8 w-px bg-gray-100 mx-3 hidden md:block"></div>
                </div>
              )}

              <div className={`relative hidden md:block ${searchWidth} ml-auto mr-2 group flex-shrink-0`}>
                 <input 
                   type="text" 
                   placeholder={searchPlaceholder}
                   value={searchQuery}
                   onChange={(e) => onSearchChange(e.target.value)}
                   className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-[12px] font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:bg-card focus:border-primary-100 transition-all" 
                 />
                 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary-600 w-4 h-4 transition-colors" />
              </div>
          </div>
        </div>
      </div>
    </>
  );
};

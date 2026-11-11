import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, X, Check, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { ChoiceSheet } from '../search/ChoiceSheet';

/** Section title in the phone filters panel: sentence case, dark (it was
 *  12 px heavy capitals in light grey, 3:1). */
const SECTION = 'text-[15px] font-semibold text-gray-900 mb-3';

export interface FilterOption {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  /** Models each option would show (other filters kept). 0 = greyed out. */
  counts?: Record<string, number>;
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
  /** Counts for the category options (same meaning as FilterOption.counts). */
  categoryCounts?: Record<string, number>;
  /** Filters in use: shown on the phone « Filtres » button. */
  activeFilterCount?: number;
  /** Label of the phone panel's closing button (e.g. « Voir 9 modèles »). */
  applyLabel?: string;
  /** Clears every filter (link in the phone panel). */
  onReset?: () => void;
  /** Phones: the search field sits on the page, above Sort and Filters,
   *  instead of inside the Filters panel. */
  phoneSearch?: boolean;
  /** Phones. 'stacked' (default): search, then Sort + Filtres on a second row.
   *  'inline': one row (search field + sort icon + filters icon) that stays
   *  under the site header while the list scrolls (fiches-techniques brand page). */
  phoneLayout?: 'stacked' | 'inline';
  /** Name of the search field for screen readers when the placeholder is short. */
  searchLabel?: string;
  /** From 768 px: where the sort menu sits. 'end' (default): after the
   *  search (brand page). 'withFilters': right after the filter menus, the
   *  search alone on the right (brand list). */
  sortPlacement?: 'end' | 'withFilters';
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
  categoryCounts,
  activeFilterCount = 0,
  applyLabel = 'Appliquer',
  onReset,
  phoneSearch = false,
  phoneLayout = 'stacked',
  searchLabel,
  sortPlacement = 'end',
}) => {
  // « Scooter 6 » / greyed when nothing would show (the selected one stays usable).
  const countOf = (counts: Record<string, number> | undefined, opt: string) =>
    counts && opt !== 'Tout' ? counts[opt] : undefined;
  const chip = (active: boolean, empty: boolean) =>
    `min-h-11 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all border inline-flex items-center gap-1.5 ${
      active ? 'bg-primary-600 text-white border-primary-600 shadow-md'
      : empty ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
      : 'bg-card text-gray-700 border-gray-200'}`;
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);

  // The phone sort button only exists when there is something to sort: it
  // used to show « Plus récentes » on every page, sorting nothing.
  const hasCustomSort = !!(sortOptions?.length && onSortValueChange);
  const hasSort = hasCustomSort || (showSort && !!onSortChange);
  // Nothing to filter or sort, only a search (fiches-techniques brands list):
  // the phone shows the search field itself, not a « Filtres » button that
  // opened a « Trier et Filtrer » panel holding just that field.
  const onlySearch = categories.length === 0 && extraFilters.length === 0 && !hasSort;
  const sortLabel = hasCustomSort
    ? sortOptions!.find((o) => o.value === sortValue)?.label ?? sortOptions![0].label
    : sortBy === 'recent' ? 'Plus récentes' : 'Plus anciennes';

  const inline = phoneLayout === 'inline' && !onlySearch;
  const sortWithFilters = hasCustomSort && sortPlacement === 'withFilters';
  // At the end of the bar (after the search) the sort makes the bar wrap
  // under 1280 px; next to the filters everything fits on one line from 768 px.
  const sortSelect = hasCustomSort ? (
    <div className={`flex items-center gap-2 ${sortWithFilters ? '' : 'order-12 xl:order-last pl-2 xl:pl-4 pr-1'}`}>
      <ArrowUpDown size={16} className="text-gray-500 shrink-0" aria-hidden="true" />
      <select
        aria-label="Trier par"
        value={sortValue}
        onChange={(e) => onSortValueChange!(e.target.value)}
        className="bg-gray-50 border border-transparent rounded-xl pl-3 py-2.5 text-[12px] font-bold text-gray-900 outline-none focus:bg-card focus:border-primary-100 transition-all cursor-pointer appearance-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '35px' }}
      >
        {sortOptions!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  ) : null;
  const wrapBar = hasCustomSort && !sortWithFilters;
  const searchOnPage = phoneSearch || inline;
  // « Filtres, 2 actifs »: the label used to override the badge, so screen
  // readers never heard how many filters were on.
  const filtersLabel = activeFilterCount > 0 ? `Filtres, ${activeFilterCount} actif${activeFilterCount > 1 ? 's' : ''}` : 'Filtres';
  // A sort other than the first one (the default) is marked by a dot.
  const sortChanged = hasCustomSort && !!sortValue && sortValue !== sortOptions![0].value;

  // Inline bar: a hairline under it only once it is stuck under the header.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!inline || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 80),
      { rootMargin: '-57px 0px 0px 0px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inline]);

  // Choosing a chip no longer closes the panel (year and cylinder chips never
  // did): the visitor sees the count change and closes with « Voir N … ».
  const handleCategoryChange = (cat: string) => {
    onCategoryChange(cat);
  };

  return (
    <>
      {/* Phones, inline: search field + sort + filters on one row that stays
          under the site header (56 px once scrolled, + the admin bar) while
          the list scrolls, so sorting or filtering never needs a trip back
          up. It sits on the page colour, a hairline appears once stuck. */}
      {inline && (
        <>
          <div ref={sentinelRef} aria-hidden="true" className="md:hidden h-px -mb-px" />
          <div
            data-stuck={stuck ? '' : undefined}
            className={`md:hidden sticky top-[calc(3.5rem+var(--admin-bar-h,0px))] z-30 w-full px-6 py-1.5 mt-1 bg-[#F8F9F9]/90 backdrop-blur-md border-b transition-colors duration-200 ${stuck ? 'border-gray-200' : 'border-transparent'}`}
          >
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0" role="search">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-[18px] h-[18px] pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  enterKeyHint="search"
                  aria-label={searchLabel || searchPlaceholder}
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className={`w-full min-h-11 pl-10 ${searchQuery ? 'pr-11' : 'pr-3'} bg-card border border-gray-200 rounded-xl text-[16px] font-medium text-gray-900 placeholder:text-gray-500 outline-none focus:border-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 transition-colors [&::-webkit-search-cancel-button]:appearance-none`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    aria-label="Effacer la recherche"
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              {hasSort && (
                <button
                  type="button"
                  onClick={() => (hasCustomSort ? setIsSortSheetOpen(true) : setIsSortMenuOpen(true))}
                  className="relative shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 bg-card text-gray-900 active:scale-[0.97] transition-transform duration-100 ease-out"
                  aria-label={`Trier : ${sortLabel}`}
                  aria-haspopup="dialog"
                >
                  <ArrowUpDown size={20} aria-hidden="true" />
                  {sortChanged && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary-700" aria-hidden="true" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSortMenuOpen(true)}
                className="relative shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-gray-900 text-white active:scale-[0.97] transition-transform duration-100 ease-out"
                aria-label={filtersLabel}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal size={20} aria-hidden="true" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-primary-700 text-white text-[12px] font-bold leading-5 text-center tabular-nums ring-2 ring-[#F8F9F9]" aria-hidden="true">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Phone bar: the search field when the page asks for it (or when it is
          the only control), then the sort button and the dark « Filtres »
          button. Both panels are the home search bar's sheet: they rise from
          the bottom, follow the finger, close with a flick down, a tap on the
          scrim or Escape, and fade only under reduced motion. */}
      {!inline && (
      <div className="md:hidden flex flex-col gap-3 w-full px-6 mt-1 mb-4 relative z-40">
        {(onlySearch || phoneSearch) && (
          <div className="relative" role="search">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-[18px] h-[18px] pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              enterKeyHint="search"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-12 pl-11 pr-12 bg-card border border-gray-200 rounded-2xl shadow-sm text-[16px] font-medium text-gray-900 placeholder:text-gray-500 outline-none focus:border-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 transition-colors [&::-webkit-search-cancel-button]:appearance-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Effacer la recherche"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        {!onlySearch && (
        <div className="flex gap-2">
          {hasSort && (
            <button
              onClick={() => (hasCustomSort ? setIsSortSheetOpen(true) : setIsSortMenuOpen(true))}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 h-12 px-4 bg-card border border-gray-100 rounded-2xl shadow-sm active:scale-[0.97] transition-transform duration-100 ease-out font-bold text-[15px] text-gray-900"
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
            className={`${hasSort ? 'shrink-0' : 'flex-1'} flex items-center justify-center gap-2 h-12 px-6 bg-gray-900 text-white rounded-2xl shadow-md active:scale-[0.97] transition-transform duration-100 ease-out font-bold text-[15px]`}
            aria-label={filtersLabel}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span>Filtres</span>
            {activeFilterCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-white text-gray-900 text-[12px] font-bold leading-5 text-center tabular-nums" aria-label={`${activeFilterCount} actif${activeFilterCount > 1 ? 's' : ''}`}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        )}
      </div>
      )}

      {/* Sort panel (phones): one tap chooses and closes. */}
      {hasCustomSort && (
        <ChoiceSheet open={isSortSheetOpen} label="Trier par" onClose={() => setIsSortSheetOpen(false)}>
          {sortOptions!.map((opt) => {
            const active = opt.value === sortValue;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onSortValueChange!(opt.value); setIsSortSheetOpen(false); }}
                className={`w-full min-h-12 flex items-center justify-between gap-3 px-5 py-3 text-left text-[16px] active:bg-gray-100 transition-colors duration-100 ${active ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}
              >
                {opt.label}
                {active && <Check size={18} className="text-primary-700 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </ChoiceSheet>
      )}

      {/* Filters panel (phones). Titled for what it holds: « Filtrer » unless
          the old two-way sort (news, tips) sits inside. */}
      {!onlySearch && (
        <ChoiceSheet
          open={isSortMenuOpen}
          label={showSort && onSortChange ? 'Trier et filtrer' : 'Filtrer'}
          onClose={() => setIsSortMenuOpen(false)}
          listbox={false}
          headerAction={onReset && activeFilterCount > 0 ? (
            <button type="button" onClick={onReset} className="min-h-11 px-3 text-[15px] font-semibold text-primary-700">Réinitialiser</button>
          ) : undefined}
          footer={(
            <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsSortMenuOpen(false)}
                className="w-full min-h-12 bg-gray-900 text-white text-[16px] font-semibold rounded-2xl active:scale-[0.98] transition-transform duration-100 ease-out"
              >
                {applyLabel}
              </button>
            </div>
          )}
        >
          <div className="px-5 pt-2 pb-4 space-y-6">
            {!searchOnPage && (
              <div>
                <h4 className={SECTION}>Recherche</h4>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" aria-hidden="true" />
                  <input
                    type="search"
                    enterKeyHint="search"
                    aria-label={searchPlaceholder}
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-2xl text-[16px] font-medium text-gray-900 placeholder:text-gray-500 outline-none focus:border-gray-400 focus:bg-card transition-colors"
                  />
                </div>
              </div>
            )}
            {categories.length > 0 && (
              <div role="group" aria-label={categoryLabel}>
                <h4 className={SECTION}>{categoryLabel === 'Toutes les catégories' ? 'Catégories' : categoryLabel}</h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => {
                    const n = countOf(categoryCounts, cat);
                    const empty = n === 0 && activeCategory !== cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        disabled={empty}
                        aria-pressed={activeCategory === cat}
                        className={chip(activeCategory === cat, empty)}
                      >
                        {cat}
                        {n !== undefined && <span className="font-medium opacity-80 tabular-nums">{n}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {extraFilters.map(filter => (
              <div key={filter.id} role="group" aria-label={filter.label}>
                <h4 className={SECTION}>{filter.label}</h4>
                <div className="flex flex-wrap gap-2">
                  {filter.options.map(opt => {
                    const n = countOf(filter.counts, opt);
                    const empty = n === 0 && filter.value !== opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => filter.onChange(opt)}
                        disabled={empty}
                        aria-pressed={filter.value === opt}
                        className={chip(filter.value === opt, empty)}
                      >
                        {opt}
                        {n !== undefined && <span className="font-medium opacity-80 tabular-nums">{n}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {showSort && onSortChange && (
              <div role="group" aria-label="Ordre d'affichage">
                <h4 className={SECTION}>Ordre d'affichage</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={sortBy === 'recent'}
                    onClick={() => onSortChange('recent')}
                    className={`flex items-center justify-between min-h-11 px-4 py-3 rounded-xl text-[14px] font-semibold transition-colors border ${sortBy === 'recent' ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-700 border-transparent'}`}
                  >
                    Plus récents {sortBy === 'recent' && <Check size={14} />}
                  </button>
                  <button
                    type="button"
                    aria-pressed={sortBy === 'oldest'}
                    onClick={() => onSortChange('oldest')}
                    className={`flex items-center justify-between min-h-11 px-4 py-3 rounded-xl text-[14px] font-semibold transition-colors border ${sortBy === 'oldest' ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-700 border-transparent'}`}
                  >
                    Plus anciens {sortBy === 'oldest' && <Check size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </ChoiceSheet>
      )}
      {/* Barre de Filtres Secondaire Desktop - Alignée sur max-w-[1440px] */}
      <div className="hidden md:block">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32 relative z-[60]">
          {/* With a sort (fiches-techniques brand page): the sort sits in the bar
              and the search is shorter. Under 1280 px the search goes to a
              second line, so the bar never runs off the screen (tablets). */}
          <div className={`bg-card rounded-2xl md:rounded-[24px] p-2 shadow-xl border border-gray-100 flex items-center w-full -mt-10 relative z-30 ${wrapBar ? 'flex-wrap xl:flex-nowrap gap-2 xl:gap-0' : ''}`}>
              {(categories.length > 0 || categoriesVariant === 'dropdown') && (
                <>
                  {categoriesVariant === 'dropdown' ? (
                    <div className="flex items-center gap-2 px-1">
                      <select
                        aria-label={categoryLabel}
                        value={activeCategory}
                        onChange={(e) => onCategoryChange(e.target.value)}
                        className="bg-gray-50 border border-transparent rounded-xl px-4 py-2.5 text-[12px] font-bold text-gray-900 outline-none focus:bg-card focus:border-primary-100 transition-all cursor-pointer appearance-none min-w-[160px] xl:min-w-[200px]"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '35px' }}
                      >
                        <option value="Tout">{categoryLabel}</option>
                        {categories.filter(c => c !== 'Tout').map(cat => {
                          const n = countOf(categoryCounts, cat);
                          return (
                            <option key={cat} value={cat} disabled={n === 0 && activeCategory !== cat}>
                              {n !== undefined ? `${cat} (${n})` : cat}
                            </option>
                          );
                        })}
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
                  <div className={`h-8 w-px bg-gray-100 mx-3 hidden ${wrapBar ? 'xl:block' : 'md:block'}`}></div>
                </>
              )}

              {(extraFilters.length > 0 || sortWithFilters) && (
                <div className="hidden md:flex items-center gap-2 mr-3">
                  {extraFilters.map(filter => (
                    <div key={filter.id} className="relative">
                      <select
                        aria-label={filter.label}
                        value={filter.value}
                        onChange={(e) => filter.onChange(e.target.value)}
                        className="bg-gray-50 border border-transparent rounded-xl px-4 py-2.5 text-[12px] font-bold text-gray-900 outline-none focus:bg-card focus:border-primary-100 transition-all cursor-pointer appearance-none min-w-[120px] xl:min-w-[140px]"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '35px' }}
                      >
                        {filter.options.map(opt => {
                          const n = countOf(filter.counts, opt);
                          return (
                            <option key={opt} value={opt} disabled={n === 0 && filter.value !== opt}>
                              {opt === 'Tout' ? filter.label : n !== undefined ? `${opt} (${n})` : opt}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                  {sortWithFilters && sortSelect}
                  <div className={`h-8 w-px bg-gray-100 mx-3 hidden ${wrapBar ? 'xl:block' : 'md:block'}`}></div>
                </div>
              )}

              {/* Under 1280 px: filters on line 1, search + sort on line 2. */}
              {wrapBar && <div className="basis-full h-0 order-10 xl:hidden" aria-hidden="true" />}
              {wrapBar && sortSelect}

              <div className={sortWithFilters
                ? 'relative group flex-1 min-w-0 max-w-[360px] ml-auto'
                : hasCustomSort
                ? 'relative group flex-1 min-w-0 xl:max-w-[360px] xl:ml-auto order-11 xl:order-none pl-1 xl:pl-0'
                : `relative hidden md:block ${searchWidth} ml-auto mr-2 group flex-shrink-0`}>
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

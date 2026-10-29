import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SlidersHorizontal, LayoutGrid, List as ListIcon, Home, ChevronRight, ArrowLeft, SearchX, X } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { useToast } from '../context/ToastContext';
import { useListingFilters, FilterState, filtersToServerParams } from '../hooks/useListingFilters';
import { useListings, useListingFacets } from '../hooks/useListings';
import { useSearchSEO } from '../hooks/useSearchSEO';
import { usePersistedState } from '../hooks/usePersistedState';
import { ListingCard } from './search/ListingCard';
import { FilterSidebar } from './search/FilterSidebar';
import { SortDropdown } from './search/SortDropdown';
import { MobileFilters } from './search/MobileFilters';
import { SearchPagination } from './search/SearchPagination';
import { ListingCardSkeleton } from './search/ListingCardSkeleton';
import { RecentSearches } from './search/RecentSearches';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { EmptyState } from './ui/EmptyState';
import { BasePageProps } from '../types';
import { addRecentSearch } from '../utils/recentSearches';
import { getUrlFromState } from '../utils/urlUtils';
import { saveSearchBackContext } from '../utils/searchBackContext';
import SEO from './common/SEO';

const ITEMS_PER_PAGE = 12;

const S = {
  Page: "min-h-screen bg-muted font-sans pb-20",
  Container: "max-w-[1360px] mx-auto px-6 md:px-16 lg:px-24 w-full",
  Header: "flex flex-col md:flex-row md:items-end justify-between pt-4 pb-10 md:pt-6 md:pb-12 gap-6",
  Title: "text-[30px] md:text-[46px] font-bold text-gray-700 tracking-tighter mb-0 leading-[1.1] md:leading-tight",
  Count: "text-primary-600 text-[18px] font-semibold leading-normal tracking-normal font-sans",
  MainLayout: "flex flex-col lg:flex-row gap-10 items-start",
  SidebarWrapper: "hidden lg:block w-[267px] flex-shrink-0 pb-10 lg:sticky lg:top-6 max-h-[calc(100vh-3rem)] overflow-y-auto [contain:layout_style] scrollbar-thin",
  GridWrapper: "flex-1 w-full min-w-0 [transform:translate3d(0,0,0)] [backface-visibility:hidden] will-change-transform",
  ViewSwitcher: "flex items-center bg-gray-100 p-1 rounded-xl",
  ViewBtn: (active: boolean) => `p-2 rounded-lg transition-all ${active ? 'bg-card text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`,
  MobileActions: "grid grid-cols-2 gap-3 w-full md:hidden mt-6",
  ChipsBar: "flex flex-wrap items-center gap-2 mb-6 -mt-2",
  Chip: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100 text-[12px] font-bold hover:bg-primary-100 transition-colors group",
  ChipClear: "text-[12px] font-bold text-gray-500 underline underline-offset-2 hover:text-primary-600 transition-colors",
};

const SearchResults: React.FC<BasePageProps> = ({ initialFilters, onNavigate, isLoggedIn, onTriggerLogin }) => {
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  // viewMode survives navigation via localStorage so users don't have to
  // re-toggle list/grid every time they jump back into search.
  const [viewMode, setViewMode] = usePersistedState<'grid' | 'list'>('motoscoot.viewMode', 'grid');

  // Restore page from URL on mount/back-navigation.
  const initialPage = Math.max(1, parseInt((initialFilters as any)?.page, 10) || 1);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const { isFavorite, toggleFavorite, isToggling } = useFavorites();
  const { addToast } = useToast();
  const lastSignatureRef = useRef<string | null>(null);
  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Replace URL silently on filter changes — debounced so a flurry of
  // keystrokes only writes once. We use history.replaceState (not navigate)
  // so we don't pollute the browser's back/forward stack with intermediate
  // states; the user's "Back" still goes to where they came from. The full
  // navigation (with a real history entry) only happens on pagination.
  const replaceUrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleFiltersUpdate = useCallback((nextFilters: FilterState) => {
    if (replaceUrlTimerRef.current) clearTimeout(replaceUrlTimerRef.current);
    replaceUrlTimerRef.current = setTimeout(() => {
      try {
        const url = getUrlFromState('search', { ...(nextFilters as any), page: currentPageRef.current });
        window.history.replaceState(window.history.state, '', url);
        // Persist the back context so a hard navigation away (e.g., opening
        // a listing in the same tab) can still restore the exact filters +
        // page when the user comes back.
        saveSearchBackContext(url);
      } catch { /* ignore — URL build can throw on edge inputs */ }
    }, 200);
  }, []);
  useEffect(() => () => {
    if (replaceUrlTimerRef.current) clearTimeout(replaceUrlTimerRef.current);
  }, []);

  const {
    filters, searchInputValue, handleFilterChange, resetFilters, sortBy, setSortBy,
    locationStatus, handleLocationDetect, userLocation, isFiltering, filtersSignature,
    radiusKm, setRadiusKm,
  } = useListingFilters(initialFilters, { onFiltersChange: handleFiltersUpdate });

  // Surface geolocation outcomes so the user understands why the proximity
  // toggle didn't activate. We only toast on the failure transitions; the
  // toggle itself already shows "actif" on success.
  const lastLocStatus = useRef(locationStatus);
  useEffect(() => {
    if (lastLocStatus.current !== locationStatus) {
      if (locationStatus === 'denied') {
        addToast("Géolocalisation refusée. Autorisez-la dans votre navigateur pour activer la proximité.", 'error', 5000);
      } else if (locationStatus === 'error') {
        addToast("Impossible d'obtenir votre position. Vérifiez votre connexion ou réessayez.", 'error', 4000);
      } else if (locationStatus === 'success') {
        addToast('Position détectée — recherche par proximité activée.', 'success', 2500);
      }
      lastLocStatus.current = locationStatus;
    }
  }, [locationStatus, addToast]);

  // Reset to page 1 when filters/sort genuinely change (not on initial mount).
  useEffect(() => {
    if (lastSignatureRef.current !== null && lastSignatureRef.current !== filtersSignature) {
      setCurrentPage(1);
    }
    lastSignatureRef.current = filtersSignature;
  }, [filtersSignature]);

  // Build the server params for the current page + filters + sort + geo.
  const serverParams = useMemo(
    () => filtersToServerParams(filters, sortBy, userLocation, currentPage, ITEMS_PER_PAGE, radiusKm),
    [filters, sortBy, userLocation, currentPage, radiusKm],
  );

  // Facets are computed without page/limit so they reflect the whole filtered
  // inventory regardless of which page the user is on.
  const facetParams = useMemo(() => {
    const { page, limit, ...rest } = serverParams;
    return rest;
  }, [serverParams]);

  const { data: listingsResp, isLoading, isFetching } = useListings(serverParams);
  const { data: facets } = useListingFacets(facetParams);

  const listings = listingsResp?.listings ?? [];
  const totalResults = listingsResp?.pagination?.total ?? facets?.total ?? 0;
  const totalPages = listingsResp?.pagination?.totalPages
    ?? Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE));

  // SEO uses the current page's listings (good enough for the ItemList schema).
  const seoInfo = useSearchSEO(filters, listings as any, userLocation, { currentPage, totalPages });

  // Scroll to top on page change
  useEffect(() => {
    if (!isLoading) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage, isLoading]);

  // Clamp current page if total pages shrinks below it.
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const handlePageChange = useCallback((nextPage: number) => {
    setCurrentPage(nextPage);
    onNavigate?.('search', { ...(filters as any), page: nextPage });
  }, [filters, onNavigate]);

  // Save the current /annonces URL as the back context whenever filters or
  // page change. This guarantees `goBack` from a listing returns the user to
  // the exact same paginated view, even after a hard refresh.
  useEffect(() => {
    try {
      const url = getUrlFromState('search', { ...(filters as any), page: currentPage });
      saveSearchBackContext(url);
    } catch { /* ignore */ }
  }, [filters, currentPage]);

  const handleCardClick = useCallback((id: string | number, title: string) => {
    onNavigate?.('listing-details', { id, title });
  }, [onNavigate]);

  const handleFavoriteToggle = useCallback((id: string | number) => {
    const currentlyFavorite = isFavorite('listing', id);
    toggleFavorite('listing', id);
    if (!currentlyFavorite) addToast('Annonce ajoutée à vos favoris', 'success', 3000);
    else addToast('Annonce retirée de vos favoris', 'info', 2000);
  }, [toggleFavorite, isFavorite, addToast]);

  const showOverlay = isFiltering || isFetching;

  // Compute the list of "active" filters (anything narrowing the result set
  // beyond the defaults) so we can render a chip bar above the grid.
  // Exhaustive: covers every condition value (not just "Neuf"), search text,
  // seller filter, and every range/geo state.
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.search) chips.push({ key: 'search', label: `« ${filters.search} »`, onRemove: () => handleFilterChange('search', '') });
    if (filters.type) chips.push({ key: 'type', label: filters.type, onRemove: () => handleFilterChange('type', '') });
    if (filters.brand) chips.push({ key: 'brand', label: filters.brand, onRemove: () => { handleFilterChange('brand', ''); handleFilterChange('model', ''); } });
    if (filters.model) chips.push({ key: 'model', label: filters.model, onRemove: () => handleFilterChange('model', '') });
    if (filters.location) chips.push({ key: 'location', label: filters.location, onRemove: () => handleFilterChange('location', '') });
    if (filters.seller || filters.sellerId) chips.push({ key: 'seller', label: `Vendeur : ${filters.seller || 'sélectionné'}`, onRemove: () => { handleFilterChange('seller', ''); handleFilterChange('sellerId', ''); } });
    if (filters.onlyPro) chips.push({ key: 'onlyPro', label: 'Professionnel', onRemove: () => handleFilterChange('onlyPro', false) });
    // One chip per active condition so users can drop them individually.
    (filters.conditions || []).forEach((cond) => {
      chips.push({
        key: `cond-${cond}`,
        label: `État : ${cond}`,
        onRemove: () => handleFilterChange('conditions', filters.conditions.filter(c => c !== cond)),
      });
    });
    if (filters.minPrice > 0) chips.push({ key: 'minPrice', label: `Prix ≥ ${filters.minPrice.toLocaleString('fr-FR')} DT`, onRemove: () => handleFilterChange('minPrice', 0) });
    if (filters.maxPrice < 200000) chips.push({ key: 'maxPrice', label: `Prix ≤ ${filters.maxPrice.toLocaleString('fr-FR')} DT`, onRemove: () => handleFilterChange('maxPrice', 200000) });
    if (filters.minYear > 2000) chips.push({ key: 'minYear', label: `Année ≥ ${filters.minYear}`, onRemove: () => handleFilterChange('minYear', 2000) });
    if (filters.maxYear < 2026) chips.push({ key: 'maxYear', label: `Année ≤ ${filters.maxYear}`, onRemove: () => handleFilterChange('maxYear', 2026) });
    if (filters.minKm > 0) chips.push({ key: 'minKm', label: `Km ≥ ${filters.minKm.toLocaleString('fr-FR')}`, onRemove: () => handleFilterChange('minKm', 0) });
    if (filters.maxKm < 300000) chips.push({ key: 'maxKm', label: `Km ≤ ${filters.maxKm.toLocaleString('fr-FR')}`, onRemove: () => handleFilterChange('maxKm', 300000) });
    if (filters.minCC > 50) chips.push({ key: 'minCC', label: `Cyl ≥ ${filters.minCC}cc`, onRemove: () => handleFilterChange('minCC', 50) });
    if (filters.maxCC < 1650) chips.push({ key: 'maxCC', label: `Cyl ≤ ${filters.maxCC}cc`, onRemove: () => handleFilterChange('maxCC', 1650) });
    if (locationStatus === 'success') chips.push({ key: 'geo', label: `Autour de moi · ${radiusKm}km`, onRemove: () => handleLocationDetect() });
    return chips;
  }, [filters, locationStatus, radiusKm, handleFilterChange, handleLocationDetect]);

  // "Broaden suggestions" — when there are 0 results, surface single-filter
  // drops that would unlock the most ads. We rely on facet totals so the
  // suggestions match what the backend would actually return.
  const broadenSuggestions = useMemo(() => {
    if (listings.length > 0 || isLoading) return [];
    const items: { key: string; label: string; apply: () => void }[] = [];
    if (filters.brand) items.push({ key: 'brand', label: `Sans la marque "${filters.brand}"`, apply: () => { handleFilterChange('brand', ''); handleFilterChange('model', ''); } });
    if (filters.model) items.push({ key: 'model', label: `Sans le modèle "${filters.model}"`, apply: () => handleFilterChange('model', '') });
    if (filters.location) items.push({ key: 'loc', label: `Toute la Tunisie (sans "${filters.location}")`, apply: () => handleFilterChange('location', '') });
    if (filters.maxPrice < 200000) items.push({ key: 'price', label: 'Sans plafond de prix', apply: () => handleFilterChange('maxPrice', 200000) });
    if (filters.minYear > 2000) items.push({ key: 'year', label: 'Toutes les années', apply: () => handleFilterChange('minYear', 2000) });
    if (filters.onlyPro) items.push({ key: 'pro', label: 'Inclure les particuliers', apply: () => handleFilterChange('onlyPro', false) });
    if (filters.conditions.length) items.push({ key: 'cond', label: 'Tous les états', apply: () => handleFilterChange('conditions', []) });
    if (locationStatus === 'success') items.push({ key: 'geo', label: 'Désactiver la proximité', apply: () => handleLocationDetect() });
    return items.slice(0, 4);
  }, [listings.length, isLoading, filters, locationStatus, handleFilterChange, handleLocationDetect]);

  // Persist the search to local recent-search history when it returns results.
  // We debounce via the same signature ref used elsewhere so we don't log
  // every intermediate keystroke.
  useEffect(() => {
    if (isLoading || listings.length === 0) return;
    const meaningful =
      filters.search || filters.brand || filters.model || filters.type || filters.location ||
      filters.onlyPro || filters.conditions.length > 0;
    if (!meaningful) return;
    const labelParts = [
      filters.search,
      filters.brand && filters.model ? `${filters.brand} ${filters.model}` : filters.brand || filters.model,
      filters.type,
      filters.location,
    ].filter(Boolean);
    if (labelParts.length === 0) return;
    const t = setTimeout(() => {
      addRecentSearch({ label: labelParts.join(' · '), params: { ...(filters as any) } });
    }, 1500);
    return () => clearTimeout(t);
  }, [filters, listings.length, isLoading]);

  return (
    <div className={S.Page}>
      <SEO
        title={seoInfo.displayTitle}
        description={seoInfo.metaDescription}
        url={seoInfo.canonicalPath}
        schema={seoInfo.schemas}
        prevUrl={seoInfo.prevPath}
        nextUrl={seoInfo.nextPath}
        // Paginated pages (page > 1) get `noindex, follow`: keep duplicates
        // out of Google's index while letting it follow links to each listing.
        // Page 1 (and clean brand/model facets) stay indexable as the canonical
        // entry points. Each page self-canonicalizes (?page=N) per Google's
        // current pagination guidance.
        noIndex={currentPage > 1}
      />

      <div className={S.Container}>
        <header className={S.Header}>
          <div className="flex flex-col w-full">
            <h1 className={S.Title}>{seoInfo.displayTitle}</h1>
            <p className={S.Count}>{isLoading ? 'Chargement...' : `${totalResults} annonces disponibles`}</p>

            <div className="mt-6 md:mt-9">
              <nav className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400" aria-label="Fil d'ariane">
                <button onClick={() => onNavigate?.('home')} className="p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95" aria-label="Retour">
                  <ArrowLeft size={16} className="md:w-5 md:h-5" />
                </button>
                <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={() => onNavigate?.('home')}>
                  <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                </span>
                <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300" />
                <span className="text-gray-900 font-extrabold truncate max-w-[100px] md:max-w-none">Annonces</span>
              </nav>

              <div className={S.MobileActions}>
                <div className="w-full">
                  <SortDropdown sortBy={sortBy} onSortChange={setSortBy} userLocation={userLocation} />
                </div>
                <button
                  onClick={() => setIsMobileFilterOpen(true)}
                  className="flex items-center justify-center gap-2 h-11 bg-gray-900 text-white rounded-xl shadow-md active:scale-95 transition-all w-full font-bold text-sm"
                >
                  <SlidersHorizontal size={18} />
                  <span>Filtres</span>
                </button>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className={S.ViewSwitcher}>
              <button onClick={() => setViewMode('grid')} className={S.ViewBtn(viewMode === 'grid')} aria-label="Vue grille"><LayoutGrid size={20} /></button>
              <button onClick={() => setViewMode('list')} className={S.ViewBtn(viewMode === 'list')} aria-label="Vue liste"><ListIcon size={20} /></button>
            </div>
            <SortDropdown sortBy={sortBy} onSortChange={setSortBy} userLocation={userLocation} />
            <button onClick={() => setIsMobileFilterOpen(true)} className="lg:hidden flex items-center gap-2 px-5 h-11 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all"><SlidersHorizontal size={18} /> Filtres</button>
          </div>
        </header>

        <div className={S.MainLayout}>
          <aside className={S.SidebarWrapper}>
            <FilterSidebar filters={filters} searchInputValue={searchInputValue} onFilterChange={handleFilterChange} onReset={resetFilters} locationStatus={locationStatus} onLocationDetect={handleLocationDetect} radiusKm={radiusKm} onRadiusChange={setRadiusKm} userLocation={userLocation} facets={facets} />
          </aside>

          <main className={`${S.GridWrapper} transition-opacity duration-300 ${showOverlay ? 'opacity-70' : 'opacity-100'}`}>
            <ErrorBoundary>
              {activeChips.length > 0 && (
                <div className={S.ChipsBar}>
                  {activeChips.map(chip => (
                    <button key={chip.key} onClick={chip.onRemove} className={S.Chip} type="button" aria-label={`Retirer le filtre ${chip.label}`}>
                      <span className="truncate max-w-[180px]">{chip.label}</span>
                      <X size={12} strokeWidth={3} className="opacity-60 group-hover:opacity-100" />
                    </button>
                  ))}
                  {activeChips.length > 1 && (
                    <button onClick={resetFilters} className={S.ChipClear} type="button">Tout effacer</button>
                  )}
                </div>
              )}
              {/* Recent searches — only meaningful when no filters are active. */}
              {activeChips.length === 0 && (
                <RecentSearches
                  onSelect={(params) => onNavigate?.('search', params as any)}
                  className="mb-6"
                />
              )}
              {isLoading ? (
                <div className={`grid gap-8 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                  {Array.from({ length: 6 }).map((_, i) => <ListingCardSkeleton key={i} viewMode={viewMode} />)}
                </div>
              ) : listings.length === 0 ? (
                <div className="space-y-6">
                  <EmptyState
                    icon={SearchX}
                    title="Aucune annonce trouvée"
                    description="Aucune annonce ne correspond à vos critères. Essayez d'élargir votre recherche ou de modifier vos filtres."
                    action={{ label: 'Réinitialiser les filtres', onClick: resetFilters }}
                    secondaryAction={{ label: "Retour à l'accueil", onClick: () => onNavigate?.('home') }}
                  />
                  {broadenSuggestions.length > 0 && (
                    <div className="bg-card border border-gray-100 rounded-2xl p-6 shadow-sm">
                      <p className="text-[12px] font-black uppercase tracking-widest text-gray-400 mb-3">
                        Élargir la recherche
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {broadenSuggestions.map(s => (
                          <button
                            key={s.key}
                            type="button"
                            onClick={s.apply}
                            className="px-4 py-2 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 text-[13px] font-bold hover:bg-primary-100 transition-all active:scale-[0.98]"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={`grid gap-8 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                    {listings.map((listing, index) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        viewMode={viewMode}
                        favorited={isFavorite('listing', listing.id as any)}
                        onFavoriteToggle={handleFavoriteToggle}
                        onClick={handleCardClick}
                        priority={index < 4}
                        isLoggedIn={isLoggedIn}
                        onTriggerLogin={onTriggerLogin}
                        isToggling={isToggling('listing', listing.id as any)}
                      />
                    ))}
                  </div>
                  <SearchPagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
                </>
              )}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {isMobileFilterOpen && (
        <MobileFilters filters={filters} searchInputValue={searchInputValue} onFilterChange={handleFilterChange} onReset={resetFilters} onClose={() => setIsMobileFilterOpen(false)} onLocationDetect={handleLocationDetect} resultsCount={totalResults} locationStatus={locationStatus} radiusKm={radiusKm} onRadiusChange={setRadiusKm} userLocation={userLocation} facets={facets} />
      )}
    </div>
  );
};

export default SearchResults;

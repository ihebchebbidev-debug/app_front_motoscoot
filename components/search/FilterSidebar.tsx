import React, { useMemo } from 'react';
import { Filter, Search, Building2, ChevronDown, Navigation, Store, MapPin } from 'lucide-react';
import { DualRangeSlider } from './DualRangeSlider';
import { RadiusSelector } from './RadiusSelector';
import { useBrands, useModelsByBrand, useGovernorates, useVehicleCategories } from '../../hooks/useReferenceData';
import { FilterState, RadiusKm, UserCoords } from '../../hooks/useListingFilters';
import type { ListingFacets } from '../../services/listingsApi';

interface FilterSidebarProps {
  filters: FilterState;
  searchInputValue?: string;
  onFilterChange: (key: keyof FilterState, value: any) => void;
  onReset: () => void;
  locationStatus: string;
  onLocationDetect: () => void;
  radiusKm?: RadiusKm;
  onRadiusChange?: (next: RadiusKm) => void;
  /** Resolved coordinates of the user — drives the map preview. */
  userLocation?: UserCoords | null;
  /** Live facet counts — used to hide options that have zero matching ads. */
  facets?: ListingFacets;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters, searchInputValue, onFilterChange, onReset, locationStatus, onLocationDetect,
  radiusKm = 50, onRadiusChange, userLocation, facets,
}) => {
  const selectClass = "w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] font-bold text-gray-700 focus:bg-card focus:border-primary-600 outline-none cursor-pointer transition-all";

  const isNewOnly = filters.conditions.includes('Neuf');

  const handleNewToggle = (checked: boolean) => {
    onFilterChange('conditions', checked ? ['Neuf'] : []);
  };

  // Backend reference data — when a vehicle type is already chosen we ask
  // the server for brands curated for that category (intelligent filter).
  // For Accessoires we don't have a sub-type at sidebar level, so we ask
  // the backend for accessory-tagged brands by passing category=Accessoires.
  const activeType = filters.type && filters.type !== 'Accessoires' ? filters.type : undefined;
  const accessoriesMode = filters.type === 'Accessoires';
  const { data: brandsData = [] } = useBrands(accessoriesMode ? 'Accessoires' : activeType);
  const brandNames = useMemo(() => brandsData.map((b) => b.name), [brandsData]);
  const selectedBrand = filters.brand && filters.brand !== 'Toutes les marques' ? filters.brand : undefined;
  const { names: availableModels } = useModelsByBrand(selectedBrand);
  const { data: governorates = [] } = useGovernorates();
  // Admin-managed list of vehicle categories — drives the "Type" dropdown
  // so newly-added categories show up automatically without a code change.
  const { data: vehicleCategoryNames = [] } = useVehicleCategories();

  // Build maps of available options + counts from facets so we only show
  // categories that actually have at least one matching listing.
  const facetMaps = useMemo(() => {
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const m = (rows?: { key: string; count: number }[]) => {
      const map = new Map<string, number>();
      (rows || []).forEach(r => { if (r.key) map.set(norm(r.key), r.count); });
      return map;
    };
    return { brand: m(facets?.brand), type: m(facets?.type), gov: m(facets?.governorate) };
  }, [facets]);

  const findCount = (map: Map<string, number>, label: string): number | undefined => {
    const k = label.trim().toLowerCase();
    return map.get(k);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="bg-card rounded-2xl border border-gray-100 p-4 xl:p-5 shadow-sm">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-50">
          <h3 className="font-black text-[12px] text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary-600" /> Filtrer
          </h3>
          <button onClick={onReset} className="text-[12px] font-black text-gray-400 uppercase hover:text-primary-600 transition-colors">Reset</button>
        </div>

        {/* Toggle Proximité */}
        <div className="mb-4">
           <label className={`flex items-center justify-between cursor-pointer p-4 rounded-xl border transition-all ${locationStatus === 'success' ? 'bg-success-50 border-success-100' : 'bg-gray-50 border-gray-100 hover:border-primary-200'}`}>
              <div className="flex items-center gap-3">
                 {locationStatus === 'loading' ? (
                    <Navigation size={18} className="text-primary-600 animate-spin" />
                 ) : (
                    <MapPin size={18} className={
                      locationStatus === 'success' ? 'text-success-600'
                      : (locationStatus === 'denied' || locationStatus === 'error') ? 'text-red-500'
                      : 'text-gray-400'
                    } />
                 )}
                 <span className={`text-sm font-bold ${
                   locationStatus === 'success' ? 'text-success-700'
                   : (locationStatus === 'denied' || locationStatus === 'error') ? 'text-red-600'
                   : 'text-gray-500'
                 }`}>
                    {locationStatus === 'loading' ? 'Chargement...'
                      : locationStatus === 'success' ? 'Actif'
                      : locationStatus === 'denied' ? 'Accès refusé'
                      : locationStatus === 'error' ? 'Erreur — réessayer'
                      : 'Proximité'}
                 </span>
              </div>
              <div className="relative">
                 <input 
                    type="checkbox" 
                    checked={locationStatus === 'success'} 
                    onChange={onLocationDetect} 
                    className="sr-only" 
                 />
                 <div className={`w-11 h-6 rounded-full transition-colors ${locationStatus === 'success' ? 'bg-success-500' : 'bg-gray-200'}`}></div>
                 <div className={`absolute left-0.5 top-0.5 bg-card w-5 h-5 rounded-full transition-transform shadow-sm ${locationStatus === 'success' ? 'translate-x-5' : ''}`}></div>
              </div>
           </label>
           {locationStatus === 'success' && onRadiusChange && (
             <RadiusSelector value={radiusKm} onChange={onRadiusChange} size="sm" userLocation={userLocation} />
           )}
        </div>

        {/* Toggle Vendeur Pro */}
        <div className="mb-4">
           <label className={`flex items-center justify-between cursor-pointer p-4 rounded-xl border transition-all ${filters.onlyPro ? 'bg-primary-50 border-primary-100' : 'bg-gray-50 border-gray-100 hover:border-primary-200'}`}>
              <div className="flex items-center gap-3">
                 <Building2 size={18} className={filters.onlyPro ? 'text-primary-600' : 'text-gray-400'} />
                 <span className={`text-sm font-bold ${filters.onlyPro ? 'text-primary-700' : 'text-gray-500'}`}>Professionnel</span>
              </div>
              <div className="relative">
                 <input type="checkbox" checked={filters.onlyPro} onChange={(e) => onFilterChange('onlyPro', e.target.checked)} className="sr-only" />
                 <div className={`w-11 h-6 rounded-full transition-colors ${filters.onlyPro ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                 <div className={`absolute left-0.5 top-0.5 bg-card w-5 h-5 rounded-full transition-transform shadow-sm ${filters.onlyPro ? 'translate-x-5' : ''}`}></div>
              </div>
           </label>
        </div>

        {/* Toggle Articles Neufs */}
        <div className="mb-6">
           <label className={`flex items-center justify-between cursor-pointer p-4 rounded-xl border transition-all ${isNewOnly ? 'bg-primary-50 border-primary-100' : 'bg-gray-50 border-gray-100 hover:border-primary-200'}`}>
              <div className="flex items-center gap-3">
                 <Store size={18} className={isNewOnly ? 'text-primary-600' : 'text-gray-400'} />
                 <span className={`text-sm font-bold ${isNewOnly ? 'text-primary-700' : 'text-gray-500'}`}>Articles neufs</span>
              </div>
              <div className="relative">
                 <input type="checkbox" checked={isNewOnly} onChange={(e) => handleNewToggle(e.target.checked)} className="sr-only" />
                 <div className={`w-11 h-6 rounded-full transition-colors ${isNewOnly ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                 <div className={`absolute left-0.5 top-0.5 bg-card w-5 h-5 rounded-full transition-transform shadow-sm ${isNewOnly ? 'translate-x-5' : ''}`}></div>
              </div>
           </label>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input 
              type="text" 
              value={searchInputValue !== undefined ? searchInputValue : filters.search} 
              onChange={(e) => onFilterChange('search', e.target.value)} 
              placeholder="Rechercher..." 
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[14px] font-bold text-gray-700 caret-primary-600 outline-none transition-all focus:bg-card focus:border-primary-600 focus:ring-4 focus:ring-primary-50" 
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          </div>
          
          {(() => {
            // Filter the type & brand options to only those that exist in the
            // current dataset. Selected values are kept even if their count is
            // 0 so the user always sees their active selection.
            const typeAll = vehicleCategoryNames.length > 0
              ? vehicleCategoryNames
              : ['Moto', 'Scooter', 'Quad', 'Accessoires'];
            const typeOpts = facets
              ? typeAll.filter(t => facetMaps.type.has(t.toLowerCase()) || filters.type === t)
              : typeAll;
            const brandOpts = facets
              ? brandNames.filter(b => facetMaps.brand.has(b.toLowerCase()) || filters.brand === b)
              : brandNames;
            const govOpts = facets
              ? governorates.filter(g => facetMaps.gov.has(g.toLowerCase()) || filters.location === g)
              : governorates;
            return [
              { key: 'type',  label: 'Type',    options: ['Tous les types', ...typeOpts],     countMap: facetMaps.type },
              { key: 'brand', label: 'Marque',  options: ['Toutes les marques', ...brandOpts], countMap: facetMaps.brand },
              { key: 'model', label: 'Modèle',  options: ['Tous les modèles', ...availableModels], countMap: undefined as Map<string, number> | undefined },
              { key: 'location', label: 'Lieu', options: ['Toutes les villes', ...govOpts],   countMap: facetMaps.gov },
            ];
          })().map((sel) => {
            const isModel = sel.key === 'model';
            const modelDisabled = isModel && !selectedBrand;
            return (
            <div key={sel.key} className="relative">
              <select 
                value={(filters[sel.key as keyof FilterState] as string) || sel.options[0]} 
                disabled={modelDisabled}
                onChange={(e) => {
                  const val = e.target.value;
                  // Normalize "all" sentinel back to '' so filtersToServerParams
                  // strips it and the URL stays clean.
                  const normalized = val === sel.options[0] ? '' : val;
                  onFilterChange(sel.key as keyof FilterState, normalized);
                  // Réinitialiser le modèle si la marque change
                  if (sel.key === 'brand') {
                    onFilterChange('model', '');
                  }
                }} 
                className={`${selectClass} ${modelDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {modelDisabled
                  ? <option>Choisir une marque d'abord</option>
                  : sel.options.map((o, i) => {
                      const count = i === 0 || !sel.countMap ? undefined : findCount(sel.countMap, o);
                      const label = count !== undefined ? `${o} (${count})` : o;
                      return <option key={o} value={o}>{label}</option>;
                    })}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            );
          })}
        </div>

        <div className="my-6 h-px bg-gray-50"></div>

        <div className="space-y-6">
          <DualRangeSlider label="Prix" min={0} max={200000} step={500} unit="DT" valueMin={filters.minPrice} valueMax={filters.maxPrice} onChange={(min, max) => { onFilterChange('minPrice', min); onFilterChange('maxPrice', max); }} />

          {filters.type !== 'Accessoires' && (
            <>
              <DualRangeSlider label="Année" min={2000} max={2026} valueMin={filters.minYear} valueMax={filters.maxYear} onChange={(min, max) => { onFilterChange('minYear', min); onFilterChange('maxYear', max); }} />
              <DualRangeSlider label="Cylindrée" min={50} max={1650} step={50} unit="cc" valueMin={filters.minCC} valueMax={filters.maxCC} onChange={(min, max) => { onFilterChange('minCC', min); onFilterChange('maxCC', max); }} />
              <DualRangeSlider label="Kilométrage" min={0} max={300000} step={1000} unit="km" valueMin={filters.minKm} valueMax={filters.maxKm} onChange={(min, max) => { onFilterChange('minKm', min); onFilterChange('maxKm', max); }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

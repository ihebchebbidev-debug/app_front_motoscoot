import React, { useEffect, useMemo } from 'react';
import { X, Navigation, ChevronRight, Building2, Search, ChevronDown, Store } from 'lucide-react';
import { DualRangeSlider } from './DualRangeSlider';
import { RadiusSelector } from './RadiusSelector';
import { FilterState, RadiusKm, UserCoords } from '../../hooks/useListingFilters';
import { useBrands, useModelsByBrand, useGovernorates, useVehicleCategories } from '../../hooks/useReferenceData';
import type { ListingFacets } from '../../services/listingsApi';

interface MobileFiltersProps {
  filters: FilterState;
  searchInputValue?: string;
  onFilterChange: (key: keyof FilterState, value: any) => void;
  onReset: () => void;
  onClose: () => void;
  onLocationDetect: () => void;
  resultsCount: number;
  locationStatus?: string;
  radiusKm?: RadiusKm;
  onRadiusChange?: (next: RadiusKm) => void;
  userLocation?: UserCoords | null;
  facets?: ListingFacets;
}

export const MobileFilters: React.FC<MobileFiltersProps> = ({
  filters, searchInputValue, onFilterChange, onReset, onClose, onLocationDetect, resultsCount,
  locationStatus, radiusKm = 50, onRadiusChange, userLocation, facets,
}) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const isNewOnly = filters.conditions.includes('Neuf');

  const handleNewToggle = (checked: boolean) => {
    onFilterChange('conditions', checked ? ['Neuf'] : []);
  };

  // Backend reference data — same "intelligent" narrowing as the desktop
  // sidebar: brand list is scoped to the selected vehicle type when set.
  const activeType = filters.type && filters.type !== 'Accessoires' ? filters.type : undefined;
  const { data: brandsData = [] } = useBrands(activeType);
  const brandNames = useMemo(() => brandsData.map((b) => b.name), [brandsData]);
  const selectedBrand = filters.brand && filters.brand !== 'Toutes les marques' ? filters.brand : undefined;
  const { names: availableModels } = useModelsByBrand(selectedBrand);
  const { data: governorates = [] } = useGovernorates();
  const { data: vehicleCategoryNames = [] } = useVehicleCategories();

  const facetMaps = useMemo(() => {
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const m = (rows?: { key: string; count: number }[]) => {
      const map = new Map<string, number>();
      (rows || []).forEach(r => { if (r.key) map.set(norm(r.key), r.count); });
      return map;
    };
    return { brand: m(facets?.brand), type: m(facets?.type), gov: m(facets?.governorate) };
  }, [facets]);
  const findCount = (map: Map<string, number>, label: string): number | undefined =>
    map.get(label.trim().toLowerCase());

  return (
    <div className="fixed inset-0 z-[150] lg:hidden bg-card flex flex-col animate-fade-in-up" role="dialog">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-card sticky top-0 z-20">
        <div className="flex flex-col">
          <h3 className="font-extrabold text-[16px] text-foreground leading-[24px] tracking-normal">
            Filtres
          </h3>
          <button 
            onClick={onReset} 
            className="text-[12px] font-extrabold text-primary-600 uppercase tracking-widest text-left"
            style={{ letterSpacing: '0.1em' }}
          >
            Réinitialiser tout
          </button>
        </div>
        
        <button 
          onClick={onClose} 
          className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-900 rounded-full active:scale-90 transition-all"
          aria-label="Fermer les filtres"
        >
          <X size={22} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        {/* Section Autour de moi */}
        <div className="p-5 bg-primary-50 rounded-2xl border border-primary-100">
          <button
            onClick={() => { onLocationDetect(); if (locationStatus !== 'success') onClose(); }}
            className="w-full flex items-center justify-between"
          >
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center text-primary-600 shadow-sm">
                    <Navigation size={20} />
                  </div>
                  <div className="flex flex-col items-start justify-center">
                    <span className="text-base font-bold text-primary-900">
                      {locationStatus === 'success' ? 'Autour de moi : actif' : 'Autour de moi'}
                    </span>
                    {locationStatus === 'success' && (
                      <span className="text-[11px] font-semibold text-primary-700/80">Touchez pour désactiver</span>
                    )}
                  </div>
              </div>
              <ChevronRight size={18} className="text-primary-300" />
          </button>
          {locationStatus === 'success' && onRadiusChange && (
            <RadiusSelector value={radiusKm} onChange={onRadiusChange} size="md" userLocation={userLocation} />
          )}
        </div>

        {/* Toggle Vendeur Pro */}
        <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
           <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                 <Building2 size={20} className={filters.onlyPro ? 'text-primary-600' : 'text-gray-400'} />
                 <span className={`text-base font-bold transition-colors ${filters.onlyPro ? 'text-primary-700' : 'text-gray-700'}`}>Professionnel</span>
              </div>
              <div className="relative">
                 <input type="checkbox" checked={filters.onlyPro} onChange={(e) => onFilterChange('onlyPro', e.target.checked)} className="sr-only" />
                 <div className={`w-12 h-7 rounded-full transition-colors ${filters.onlyPro ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                 <div className={`absolute left-1 top-1 bg-card w-5 h-5 rounded-full transition-transform shadow-sm ${filters.onlyPro ? 'translate-x-5' : ''}`}></div>
              </div>
           </label>
        </div>

        {/* Toggle Articles Neufs */}
        <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
           <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                 <Store size={20} className={isNewOnly ? 'text-primary-600' : 'text-gray-400'} />
                 <span className={`text-base font-bold transition-colors ${isNewOnly ? 'text-primary-700' : 'text-gray-700'}`}>Articles neufs</span>
              </div>
              <div className="relative">
                 <input type="checkbox" checked={isNewOnly} onChange={(e) => handleNewToggle(e.target.checked)} className="sr-only" />
                 <div className={`w-12 h-7 rounded-full transition-colors ${isNewOnly ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                 <div className={`absolute left-1 top-1 bg-card w-5 h-5 rounded-full transition-transform shadow-sm ${isNewOnly ? 'translate-x-5' : ''}`}></div>
              </div>
           </label>
        </div>

        {/* Champs de texte et sélecteurs */}
        <div className="space-y-6">
           <div className="relative">
              <input 
                type="text" 
                value={searchInputValue !== undefined ? searchInputValue : filters.search} 
                onChange={(e) => onFilterChange('search', e.target.value)} 
                className="w-full pl-11 pr-4 py-4 rounded-xl border border-gray-100 bg-gray-50 text-base font-bold text-foreground outline-none focus:bg-card focus:border-primary-500 transition-all" 
                placeholder="Mot-clé (ex: TMAX, MT07...)" 
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
           </div>
           
           {(() => {
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
               { key: 'type',  label: 'Type de véhicule', options: ['Tous les types', ...typeOpts],     countMap: facetMaps.type },
               { key: 'brand', label: 'Marque',           options: ['Toutes les marques', ...brandOpts], countMap: facetMaps.brand },
               { key: 'model', label: 'Modèle',           options: ['Tous les modèles', ...availableModels], countMap: undefined as Map<string, number> | undefined },
               { key: 'location', label: 'Gouvernorat',   options: ['Toutes les villes', ...govOpts],    countMap: facetMaps.gov },
             ];
           })().map((sel) => {
             const isModel = sel.key === 'model';
             const modelDisabled = isModel && !selectedBrand;
             return (
             <div key={sel.key}>
                <label className="text-[12px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 block ml-1">{sel.label}</label>
                <div className="relative">
                  <select 
                    value={(filters[sel.key as keyof FilterState] as string) || sel.options[0]} 
                    disabled={modelDisabled}
                    onChange={(e) => {
                      const val = e.target.value;
                      const normalized = val === sel.options[0] ? '' : val;
                      onFilterChange(sel.key as keyof FilterState, normalized);
                      if (sel.key === 'brand') {
                        onFilterChange('model', '');
                      }
                    }} 
                    className={`w-full p-4 bg-gray-50 border border-gray-100 rounded-xl font-bold text-foreground shadow-none appearance-none focus:bg-card focus:border-primary-500 transition-all ${modelDisabled ? 'opacity-60' : ''}`}
                  >
                    {modelDisabled
                      ? <option>Choisir une marque d'abord</option>
                      : sel.options.map((o, i) => {
                          const count = i === 0 || !sel.countMap ? undefined : findCount(sel.countMap, o);
                          const label = count !== undefined ? `${o} (${count})` : o;
                          return <option key={o} value={o}>{label}</option>;
                        })}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} />
                </div>
             </div>
             );
           })}
        </div>

        <hr className="border-gray-50" />

        {/* Sliders de plage */}
        <div className="space-y-4">
          {filters.type !== 'Accessoires' && (
            <>
              <DualRangeSlider label="Année" min={2000} max={2026} valueMin={filters.minYear} valueMax={filters.maxYear} onChange={(min, max) => { onFilterChange('minYear', min); onFilterChange('maxYear', max); }} />
              <DualRangeSlider label="Kilométrage" min={0} max={300000} step={1000} unit="km" valueMin={filters.minKm} valueMax={filters.maxKm} onChange={(min, max) => { onFilterChange('minKm', min); onFilterChange('maxKm', max); }} />
              <DualRangeSlider label="Cylindrée" min={50} max={1650} step={50} unit="cc" valueMin={filters.minCC} valueMax={filters.maxCC} onChange={(min, max) => { onFilterChange('minCC', min); onFilterChange('maxCC', max); }} />
            </>
          )}

          <DualRangeSlider label="Budget (DT)" min={0} max={200000} step={500} unit="DT" valueMin={filters.minPrice} valueMax={filters.maxPrice} onChange={(min, max) => { onFilterChange('minPrice', min); onFilterChange('maxPrice', max); }} />
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 bg-card sticky bottom-0 z-20 pb-8 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button onClick={onClose} className="w-full bg-primary-600 text-white font-extrabold py-4 rounded-xl flex items-center justify-center gap-2 text-sm uppercase tracking-widest active:scale-[0.98] transition-all">
           Voir {resultsCount} annonces
        </button>
      </div>
    </div>
  );
};
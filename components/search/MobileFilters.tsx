import React, { useEffect, useMemo } from 'react';
import { Navigation, Building2, Search, ChevronDown, Store, Loader2 } from 'lucide-react';
import { DualRangeSlider } from './DualRangeSlider';
import { RadiusSelector } from './RadiusSelector';
import { ChoiceSheet } from './ChoiceSheet';
import { FilterState, RadiusKm, UserCoords } from '../../hooks/useListingFilters';
import { useBrands, useModelsByBrand, useGovernorates, useVehicleCategories } from '../../hooks/useReferenceData';
import type { ListingFacets } from '../../services/listingsApi';
import { resultsButtonLabel } from '../../utils/mobileFilters';

/**
 * Filtres de /annonces sur téléphone et tablette (moins de 1024 px).
 *
 * La feuille commune (ChoiceSheet), comme le tri, la recherche de l'accueil
 * et le dépôt : elle monte du bas, se tire vers le bas pour fermer, Échap
 * ferme, le focus reste dedans et revient au bouton « Filtres ».
 * Les filtres s'appliquent en direct ; « Voir N annonces » ferme et montre
 * les résultats. L'ordinateur garde sa colonne (FilterSidebar), inchangée.
 *
 * Ordre : ce que les acheteurs utilisent le plus d'abord (recherche, type,
 * marque, modèle, budget, gouvernorat), puis « Plus de filtres ».
 */

interface MobileFiltersProps {
  open: boolean;
  filters: FilterState;
  searchInputValue?: string;
  onFilterChange: (key: keyof FilterState, value: any) => void;
  onReset: () => void;
  onClose: () => void;
  onLocationDetect: () => void;
  resultsCount: number;
  /** La liste se recharge : le bouton du bas l'indique. */
  counting?: boolean;
  locationStatus?: string;
  radiusKm?: RadiusKm;
  onRadiusChange?: (next: RadiusKm) => void;
  userLocation?: UserCoords | null;
  facets?: ListingFacets;
  /** Le bouton « Filtres » qui a ouvert la feuille (retour du focus). */
  returnFocus?: React.RefObject<HTMLElement | null>;
}

const FIELD = 'w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-[16px] font-semibold text-gray-900 outline-none transition-colors focus:border-primary-600 focus:ring-1 focus:ring-primary-600';
const LABEL = 'block mb-1.5 text-[14px] font-semibold text-gray-700';

/** Une ligne interrupteur (Professionnel, Articles neufs). */
const SwitchRow: React.FC<{ icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ icon, label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 min-h-[56px] cursor-pointer">
    <span className="flex items-center gap-3">
      <span className={checked ? 'text-primary-600' : 'text-gray-500'} aria-hidden="true">{icon}</span>
      <span className="text-[15px] font-semibold text-gray-900">{label}</span>
    </span>
    <span className="relative shrink-0">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={`block w-12 h-7 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-gray-900 ${checked ? 'bg-primary-600' : 'bg-gray-300'}`} />
      <span className={`absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </label>
);

export const MobileFilters: React.FC<MobileFiltersProps> = ({
  open, filters, searchInputValue, onFilterChange, onReset, onClose, onLocationDetect, resultsCount, counting = false,
  locationStatus, radiusKm = 50, onRadiusChange, userLocation, facets, returnFocus,
}) => {
  // Passé 1024 px la colonne de l'ordinateur prend le relais : on referme.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => { if (mq.matches) onClose(); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open, onClose]);

  const isNewOnly = filters.conditions.includes('Neuf');

  // Mêmes listes que la colonne de l'ordinateur : marques limitées au type choisi.
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

  const typeAll = vehicleCategoryNames.length > 0 ? vehicleCategoryNames : ['Moto', 'Scooter', 'Quad', 'Accessoires'];
  const typeOpts = facets ? typeAll.filter(t => facetMaps.type.has(t.toLowerCase()) || filters.type === t) : typeAll;
  const brandOpts = facets ? brandNames.filter(b => facetMaps.brand.has(b.toLowerCase()) || filters.brand === b) : brandNames;
  const govOpts = facets ? governorates.filter(g => facetMaps.gov.has(g.toLowerCase()) || filters.location === g) : governorates;

  // L'option 0 est « tout » : elle remet le filtre à vide.
  const selects = [
    { key: 'type', label: 'Type de véhicule', options: ['Tous les types', ...typeOpts], countMap: facetMaps.type as Map<string, number> | undefined },
    { key: 'brand', label: 'Marque', options: ['Toutes les marques', ...brandOpts], countMap: facetMaps.brand as Map<string, number> | undefined },
    { key: 'model', label: 'Modèle', options: ['Tous les modèles', ...availableModels], countMap: undefined as Map<string, number> | undefined },
  ];
  const govSelect = { key: 'location', label: 'Gouvernorat', options: ['Tous les gouvernorats', ...govOpts], countMap: facetMaps.gov as Map<string, number> | undefined };

  const renderSelect = (sel: typeof govSelect) => {
    const isModel = sel.key === 'model';
    const modelDisabled = isModel && !selectedBrand;
    const id = `mf-${sel.key}`;
    return (
      <div key={sel.key}>
        <label htmlFor={id} className={LABEL}>{sel.label}</label>
        <div className="relative">
          <select
            id={id}
            value={(filters[sel.key as keyof FilterState] as string) || sel.options[0]}
            disabled={modelDisabled}
            onChange={(e) => {
              const val = e.target.value;
              onFilterChange(sel.key as keyof FilterState, val === sel.options[0] ? '' : val);
              if (sel.key === 'brand') onFilterChange('model', '');
            }}
            className={`${FIELD} pr-10 appearance-none disabled:bg-gray-50 disabled:text-gray-500`}
          >
            {modelDisabled
              ? <option>Choisissez d'abord une marque</option>
              : sel.options.map((o, i) => {
                  const count = i === 0 || !sel.countMap ? undefined : findCount(sel.countMap, o);
                  return <option key={o} value={o}>{count !== undefined ? `${o} (${count})` : o}</option>;
                })}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} aria-hidden="true" />
        </div>
      </div>
    );
  };

  const geoActive = locationStatus === 'success';
  const geoLoading = locationStatus === 'loading';
  const geoNote = locationStatus === 'denied'
    ? 'Position refusée : autorisez-la dans les réglages du navigateur.'
    : locationStatus === 'error'
      ? 'Position introuvable pour le moment. Réessayez.'
      : null;

  const footer = (
    <div className="flex gap-3 px-5 pt-3 pb-3 border-t border-gray-100 bg-card">
      <button
        type="button"
        onClick={onReset}
        className="h-12 px-4 rounded-xl border border-gray-300 text-[15px] font-semibold text-gray-900 active:scale-[0.97] transition-transform"
      >
        Tout effacer
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-live="polite"
        className="flex-1 h-12 rounded-xl bg-primary-600 text-white text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
      >
        {counting && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        {counting ? 'Recherche…' : resultsButtonLabel(resultsCount)}
      </button>
    </div>
  );

  return (
    <ChoiceSheet open={open} label="Filtres" onClose={onClose} listbox={false} tall footer={footer} returnFocus={returnFocus}>
      <div className="px-5 pt-2 pb-6 space-y-5">
        <div>
          <label htmlFor="mf-search" className={LABEL}>Recherche</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} aria-hidden="true" />
            <input
              id="mf-search"
              type="search"
              enterKeyHint="search"
              value={searchInputValue !== undefined ? searchInputValue : filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
              className={`${FIELD} pl-11`}
              placeholder="TMAX, MT-07, Booster…"
            />
          </div>
        </div>

        {selects.map(renderSelect)}

        <DualRangeSlider label="Budget (DT)" min={0} max={200000} step={500} unit="DT" valueMin={filters.minPrice} valueMax={filters.maxPrice} onChange={(min, max) => { onFilterChange('minPrice', min); onFilterChange('maxPrice', max); }} />

        {renderSelect(govSelect)}

        <section aria-labelledby="mf-more" className="pt-5 border-t border-gray-100 space-y-1">
          <h4 id="mf-more" className="text-[15px] font-bold text-gray-900 mb-2">Plus de filtres</h4>

          <div className="py-1">
            <button
              type="button"
              onClick={onLocationDetect}
              disabled={geoLoading}
              aria-pressed={geoActive}
              className="w-full min-h-[56px] flex items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-3">
                <span className={geoActive ? 'text-primary-600' : 'text-gray-500'} aria-hidden="true">
                  {geoLoading ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
                </span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold text-gray-900">Autour de moi</span>
                  <span className="text-[13px] text-gray-600">
                    {geoLoading ? 'Recherche de votre position…' : geoActive ? `Actif · ${radiusKm} km · touchez pour désactiver` : 'Annonces proches de votre position'}
                  </span>
                </span>
              </span>
              <span className={`shrink-0 relative block w-12 h-7 rounded-full transition-colors ${geoActive ? 'bg-primary-600' : 'bg-gray-300'}`} aria-hidden="true">
                <span className={`absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${geoActive ? 'translate-x-5' : ''}`} />
              </span>
            </button>
            {geoNote && <p className="mt-1 text-[13px] text-red-700" role="status">{geoNote}</p>}
            {geoActive && onRadiusChange && (
              <div className="mt-2">
                <RadiusSelector value={radiusKm} onChange={onRadiusChange} size="md" userLocation={userLocation} />
              </div>
            )}
          </div>

          <SwitchRow icon={<Building2 size={20} />} label="Vendeurs professionnels" checked={filters.onlyPro} onChange={(v) => onFilterChange('onlyPro', v)} />
          <SwitchRow icon={<Store size={20} />} label="Articles neufs" checked={isNewOnly} onChange={(v) => onFilterChange('conditions', v ? ['Neuf'] : [])} />

          {filters.type !== 'Accessoires' && (
            <div className="pt-4 space-y-4">
              <DualRangeSlider label="Année" min={2000} max={2026} valueMin={filters.minYear} valueMax={filters.maxYear} onChange={(min, max) => { onFilterChange('minYear', min); onFilterChange('maxYear', max); }} />
              <DualRangeSlider label="Kilométrage" min={0} max={300000} step={1000} unit="km" valueMin={filters.minKm} valueMax={filters.maxKm} onChange={(min, max) => { onFilterChange('minKm', min); onFilterChange('maxKm', max); }} />
              <DualRangeSlider label="Cylindrée" min={50} max={1650} step={50} unit="cc" valueMin={filters.minCC} valueMax={filters.maxCC} onChange={(min, max) => { onFilterChange('minCC', min); onFilterChange('maxCC', max); }} />
            </div>
          )}
        </section>
      </div>
    </ChoiceSheet>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Navigation, X, Search } from 'lucide-react';
import {
  useBrands,
  useModelsByBrand,
  useCityNames,
  useAccessoryTypes,
  useVehicleCategoriesRich,
} from '../../hooks/useReferenceData';
import { useAvailableSearchOptions } from '../../hooks/useAvailableSearchOptions';
import { useListingsCount } from '../../hooks/useListings';

interface SearchBarProps {
  onSearch?: (filters: any) => void;
  /** Called when the user picks the "Neuf" tab — should navigate to fiches techniques. */
  onNeufClick?: () => void;
}

type Category = 'Moto' | 'Scooter' | 'Quad' | 'Accessoires' | '';

// Predefined options for Prix max / Année min selectors.
const PRICE_OPTIONS = [2000, 5000, 10000, 15000, 20000, 30000, 50000, 100000];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 25 }, (_, i) => CURRENT_YEAR - i);

/** Compact dropdown shared by every field of the new vertical card layout. */
interface FieldProps {
  label: string;
  value: string;
  placeholder: string;
  isOpen: boolean;
  onToggle: () => void;
  onClear?: () => void;
  isCombobox?: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onFocus?: () => void;
  isDisabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ElementType;
  innerRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({
  label, value, placeholder, isOpen, onToggle, onClear, isCombobox,
  searchValue = '', onSearchChange, onFocus, isDisabled, icon: Icon,
  innerRef, children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggle(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onToggle]);

  const hasValue = !!value || (isCombobox && !!searchValue);
  const display = isCombobox ? (searchValue || value) : value;

  return (
    <div ref={innerRef} className="relative">
      <div
        className={`flex items-center gap-1.5 h-12 md:h-14 px-3 md:px-3.5 rounded-lg border transition-all ${
          isOpen
            ? 'border-primary-600 ring-2 ring-primary-600/15 md:shadow-sm'
            : 'border-gray-200 md:hover:border-gray-300'
        } ${isDisabled ? 'opacity-50 bg-gray-50' : 'bg-card'}`}
      >
        {Icon && <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <button
          type="button"
          onClick={() => { if (!isDisabled) { onToggle(); onFocus?.(); } }}
          disabled={isDisabled}
          aria-label={label}
          className="flex-1 min-w-0 text-left bg-transparent text-[14px] md:text-[14.5px] font-medium text-[#1f2937] truncate disabled:cursor-not-allowed"
        >
          {display || <span className="text-[#1f2937] font-medium">{placeholder || label}</span>}
        </button>
        {hasValue && onClear && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            aria-label={`Effacer ${label}`}
            className="p-0.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!isDisabled) onToggle(); }}
          aria-label={isOpen ? `Fermer ${label}` : `Ouvrir ${label}`}
          aria-expanded={isOpen}
          disabled={isDisabled}
          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {isOpen && !isDisabled && (
        <div
          className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={onToggle}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <div
            className="bg-card w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">{label}</h3>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Fermer"
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            {/* Optional search input for comboboxes */}
            {isCombobox && (
              <div className="px-5 pt-3 pb-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder={`Rechercher ${label.toLowerCase()}…`}
                  value={searchValue}
                  autoFocus
                  autoComplete="off"
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-gray-200 text-[14px] text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                />
              </div>
            )}
            {/* Options */}
            <div role="listbox" className="flex-1 overflow-y-auto py-2">
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ITEM = 'w-full text-left px-4 py-2.5 text-[14px] font-medium transition-colors';
const ACTIVE = 'bg-primary-50 text-primary-600';
const DEFAULT = 'text-gray-600 hover:bg-gray-50';

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onNeufClick }) => {
  const [tab, setTab] = useState<'occasion' | 'neuf'>('occasion');
  const [type, setType] = useState<Category>('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [accessoryCategory, setAccessoryCategory] = useState('');
  const [location, setLocation] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minYear, setMinYear] = useState<string>('');

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [accessorySearch, setAccessorySearch] = useState('');

  const refs = {
    type: useRef<HTMLDivElement>(null),
    brand: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
    price: useRef<HTMLDivElement>(null),
    year: useRef<HTMLDivElement>(null),
    location: useRef<HTMLDivElement>(null),
  };

  // Reset cascade on category switch (keeps filters coherent).
  useEffect(() => {
    setBrand(''); setBrandSearch('');
    setModel(''); setModelSearch('');
    setAccessoryCategory(''); setAccessorySearch('');
  }, [type]);

  useEffect(() => {
    if (type === 'Accessoires') {
      setBrand(''); setBrandSearch('');
      setModel(''); setModelSearch('');
    }
  }, [accessoryCategory, type]);

  useEffect(() => {
    function handleOutside(event: Event) {
      const target = event.target as Node;
      const inside = Object.values(refs).some((r) => r.current?.contains(target));
      if (!inside) setOpenMenu(null);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  const handleLocationRequest = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => { setIsLocating(false); setLocation('Ma position'); setOpenMenu(null); },
      () => { setIsLocating(false); setLocation(''); setOpenMenu(null); },
    );
  };

  const handleSearchClick = () => {
    onSearch?.({
      type,
      search: type === 'Accessoires' ? accessoryCategory : '',
      brand,
      model,
      location: location === 'Ma position' ? '' : location,
      aroundMe: location === 'Ma position',
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minYear: minYear ? Number(minYear) : undefined,
    });
  };

  // Reference data
  const activeBrandCategory = type && type !== 'Accessoires' ? type : undefined;
  const activeAccessoryType = type === 'Accessoires' && accessoryCategory ? accessoryCategory : undefined;
  const { data: brandsData = [] } = useBrands(activeBrandCategory, activeAccessoryType);
  const { names: modelNames } = useModelsByBrand(brand || undefined, activeAccessoryType);
  const { data: cityRows = [], names: cityNames } = useCityNames();
  const { data: accessoryTypesData = [] } = useAccessoryTypes();
  const { data: vehicleCategories = [] } = useVehicleCategoriesRich();
  const { data: liveCount } = useListingsCount();

  const {
    brandCounts,
    availableGovernorates,
    availableModels: liveModels,
  } = useAvailableSearchOptions(brand || undefined, activeBrandCategory);

  const brandNames = useMemo(() => brandsData.map((b) => b.name), [brandsData]);
  const accessoryTypeNames = useMemo(() => accessoryTypesData.map((a) => a.name), [accessoryTypesData]);

  // Vehicle categories — admin-driven, with hardcoded fallback for first paint.
  const typeOptions = useMemo(() => {
    if (vehicleCategories.length) return vehicleCategories;
    return ['Moto', 'Scooter', 'Quad', 'Accessoires'].map((n) => ({ name: n } as any));
  }, [vehicleCategories]);

  const filteredBrandNames = useMemo(() => {
    if (type === 'Accessoires') return brandNames;
    if (!brandCounts.size) return brandNames;
    return brandNames.filter((b) => brandCounts.has(b.toLowerCase()));
  }, [brandNames, brandCounts, type]);
  const brandCountFor = (name: string) => brandCounts.get(name.toLowerCase());

  const availableModels = useMemo(() => {
    if (type === 'Accessoires') return modelNames;
    if (brand && liveModels.length) return liveModels;
    return modelNames;
  }, [type, brand, liveModels, modelNames]);

  const filteredCityNames = useMemo(() => {
    if (!availableGovernorates.size) return cityNames;
    return cityRows
      .filter((c: any) => availableGovernorates.has((c.governorate || '').toLowerCase()))
      .map((c: any) => c.name);
  }, [cityRows, cityNames, availableGovernorates]);

  const handleTab = (next: 'occasion' | 'neuf') => {
    if (next === 'neuf') { onNeufClick?.(); return; }
    setTab(next);
  };

  return (
    <div className="w-full max-w-md md:max-w-none bg-card rounded-2xl shadow-2xl p-4 md:p-5 relative z-20 md:ring-1 md:ring-black/5">
      {/* Tabs Occasion / Neuf — narrower & left-aligned on desktop */}
      <div className="flex border-b border-gray-200 mb-4 md:mb-4 md:max-w-[260px]" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'occasion'}
          onClick={() => handleTab('occasion')}
          className={`flex-1 pb-3 text-[15px] font-bold transition-colors relative ${
            tab === 'occasion' ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Occasion
          {tab === 'occasion' && (
            <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'neuf'}
          onClick={() => handleTab('neuf')}
          className="flex-1 pb-3 text-[15px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
        >
          Neuf
        </button>
      </div>

      {/* Fields wrapper — stacked on mobile, single horizontal row on desktop.
          md:contents flattens inner wrappers so each Field becomes a direct
          grid item, giving us one clean toolbar row at md+. */}
      <div className="md:grid md:grid-cols-[1.5fr_1.05fr_1.05fr_0.9fr_0.9fr_1.4fr_auto] md:gap-2.5 md:items-stretch">
      {/* Que cherchez-vous ? — full-width category select */}
      <div className="mb-2 md:mb-0 md:contents">
        <Field
          innerRef={refs.type}
          label="Que cherchez-vous ?"
          placeholder="Catégorie"
          value={type}
          isOpen={openMenu === 'type'}
          onToggle={() => setOpenMenu(openMenu === 'type' ? null : 'type')}
          onClear={type ? () => { setType('' as Category); setOpenMenu(null); } : undefined}
        >
          {typeOptions.map((cat: any) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => { setType(cat.name as Category); setOpenMenu(null); }}
              className={`${ITEM} ${type === cat.name ? ACTIVE : DEFAULT}`}
            >
              {cat.name}
            </button>
          ))}
        </Field>
      </div>

      {/* Marque + Modèle (or Articles + Marque for Accessoires) */}
      <div className="grid grid-cols-2 gap-2 mb-2 md:gap-0 md:mb-0 md:contents">
        <Field
          innerRef={refs.brand}
          label={type === 'Accessoires' ? 'Articles' : 'Marque'}
          placeholder={type === 'Accessoires' ? 'Articles' : 'Marque'}
          value={type === 'Accessoires' ? accessoryCategory : brand}
          isOpen={openMenu === 'brand'}
          onToggle={() => setOpenMenu(openMenu === 'brand' ? null : 'brand')}
          isCombobox
          searchValue={type === 'Accessoires' ? accessorySearch : brandSearch}
          onSearchChange={(v) => {
            if (type === 'Accessoires') { setAccessorySearch(v); setOpenMenu('brand'); }
            else { setBrandSearch(v); setOpenMenu('brand'); }
          }}
          onFocus={() => {
            setOpenMenu('brand');
            if (type === 'Accessoires') setAccessorySearch(''); else setBrandSearch('');
          }}
          onClear={
            (type === 'Accessoires' ? !!accessoryCategory || !!accessorySearch : !!brand || !!brandSearch)
              ? () => {
                  if (type === 'Accessoires') { setAccessoryCategory(''); setAccessorySearch(''); }
                  else { setBrand(''); setBrandSearch(''); setModel(''); setModelSearch(''); }
                  setOpenMenu(null);
                }
              : undefined
          }
        >
          {type === 'Accessoires' ? (
            accessoryTypeNames
              .filter((a) => a.toLowerCase().includes(accessorySearch.toLowerCase()))
              .map((acc) => (
                <button
                  key={acc}
                  onClick={() => { setAccessoryCategory(acc); setAccessorySearch(acc); setBrand(''); setBrandSearch(''); setModel(''); setModelSearch(''); setOpenMenu(null); }}
                  className={`${ITEM} ${accessoryCategory === acc ? ACTIVE : DEFAULT}`}
                >{acc}</button>
              ))
          ) : (() => {
            const matches = filteredBrandNames.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()));
            if (!matches.length) {
              return (
                <div className="px-4 py-3 text-[13px] text-gray-400 italic">
                  Aucune marque disponible{type ? ` pour ${type}` : ''}
                </div>
              );
            }
            return matches.map((b) => {
              const count = brandCountFor(b);
              return (
                <button
                  key={b}
                  onClick={() => { setBrand(b); setBrandSearch(b); setOpenMenu(null); setModel(''); setModelSearch(''); }}
                  className={`${ITEM} ${brand === b ? ACTIVE : DEFAULT} flex items-center justify-between gap-2`}
                >
                  <span className="truncate">{b}</span>
                  {typeof count === 'number' && (
                    <span className="text-[11px] font-semibold text-gray-400 tabular-nums">{count}</span>
                  )}
                </button>
              );
            });
          })()}
        </Field>

        <Field
          innerRef={refs.model}
          label={type === 'Accessoires' ? 'Marque' : 'Modèle'}
          placeholder={type === 'Accessoires' ? (accessoryCategory ? 'Marque' : '—') : 'Modèle'}
          value={type === 'Accessoires' ? brand : model}
          isOpen={openMenu === 'model'}
          onToggle={() => setOpenMenu(openMenu === 'model' ? null : 'model')}
          isCombobox
          isDisabled={type === 'Accessoires' ? !accessoryCategory : false}
          searchValue={type === 'Accessoires' ? brandSearch : modelSearch}
          onSearchChange={(v) => {
            if (type === 'Accessoires') { setBrandSearch(v); setOpenMenu('model'); }
            else { setModelSearch(v); setOpenMenu('model'); }
          }}
          onFocus={() => {
            setOpenMenu('model');
            if (type === 'Accessoires') setBrandSearch(''); else setModelSearch('');
          }}
          onClear={
            (type === 'Accessoires' ? !!brand || !!brandSearch : !!model || !!modelSearch)
              ? () => {
                  if (type === 'Accessoires') { setBrand(''); setBrandSearch(''); }
                  else { setModel(''); setModelSearch(''); }
                  setOpenMenu(null);
                }
              : undefined
          }
        >
          {type === 'Accessoires' ? (
            filteredBrandNames
              .filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()))
              .map((b) => (
                <button key={b} onClick={() => { setBrand(b); setBrandSearch(b); setOpenMenu(null); }} className={`${ITEM} ${brand === b ? ACTIVE : DEFAULT}`}>{b}</button>
              ))
          ) : (() => {
            const matches = availableModels.filter((m) => m.toLowerCase().includes(modelSearch.toLowerCase()));
            if (!matches.length) {
              return (
                <div className="px-4 py-3 text-[13px] text-gray-400 italic">
                  {brand ? `Aucun modèle disponible pour ${brand}` : 'Choisissez d’abord une marque'}
                </div>
              );
            }
            return matches.map((m) => (
              <button key={m} onClick={() => { setModel(m); setModelSearch(m); setOpenMenu(null); }} className={`${ITEM} ${model === m ? ACTIVE : DEFAULT}`}>{m}</button>
            ));
          })()}
        </Field>
      </div>

      {/* Prix max + Année min */}
      <div className="grid grid-cols-2 gap-2 mb-2 md:gap-0 md:mb-0 md:contents">
        <Field
          innerRef={refs.price}
          label="Prix max"
          placeholder="Prix max"
          value={maxPrice ? `${Number(maxPrice).toLocaleString('fr-FR')} TND` : ''}
          isOpen={openMenu === 'price'}
          onToggle={() => setOpenMenu(openMenu === 'price' ? null : 'price')}
          onClear={maxPrice ? () => { setMaxPrice(''); setOpenMenu(null); } : undefined}
        >
          {PRICE_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setMaxPrice(String(p)); setOpenMenu(null); }}
              className={`${ITEM} ${maxPrice === String(p) ? ACTIVE : DEFAULT}`}
            >
              {p.toLocaleString('fr-FR')} TND
            </button>
          ))}
        </Field>
        <Field
          innerRef={refs.year}
          label="Année min."
          placeholder="Année"
          value={minYear}
          isOpen={openMenu === 'year'}
          onToggle={() => setOpenMenu(openMenu === 'year' ? null : 'year')}
          onClear={minYear ? () => { setMinYear(''); setOpenMenu(null); } : undefined}
        >
          {YEAR_OPTIONS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => { setMinYear(String(y)); setOpenMenu(null); }}
              className={`${ITEM} ${minYear === String(y) ? ACTIVE : DEFAULT}`}
            >
              {y}
            </button>
          ))}
        </Field>
      </div>

      {/* Où ça ? — full width */}
      <Field
        innerRef={refs.location}
        label="Où ça ?"
        placeholder="Où ça ? (Ville, région...)"
        value={location}
        isOpen={openMenu === 'location'}
        onToggle={() => setOpenMenu(openMenu === 'location' ? null : 'location')}
        onClear={location ? () => { setLocation(''); setOpenMenu(null); } : undefined}
      >
        <button
          onClick={handleLocationRequest}
          disabled={isLocating}
          className={`${ITEM} text-primary-600 flex items-center gap-2 hover:bg-primary-50`}
        >
          <Navigation size={14} className="fill-current" />
          {isLocating ? 'Localisation…' : 'Autour de moi'}
        </button>
        <div className="mx-4 my-1 border-t border-gray-100" />
        {filteredCityNames.length === 0 ? (
          <div className="px-4 py-3 text-[13px] text-gray-400 italic">Aucune ville disponible</div>
        ) : (
          filteredCityNames.map((city) => (
            <button
              key={city}
              onClick={() => { setLocation(city); setOpenMenu(null); }}
              className={`${ITEM} ${location === city ? ACTIVE : DEFAULT}`}
            >{city}</button>
          ))
        )}
      </Field>

      {/* Search button — full width on mobile, inline last grid cell on desktop */}
      <button
        type="button"
        onClick={handleSearchClick}
        className="w-full mt-3 md:mt-0 md:h-14 md:py-0 md:px-7 md:rounded-lg md:whitespace-nowrap bg-[#1f2937] hover:bg-[#111827] active:scale-[0.98] text-white font-bold py-4 rounded-lg transition-all text-[14px] uppercase tracking-wider flex items-center justify-center gap-2"
      >
        <Search size={16} strokeWidth={2.5} />
        <span className="md:hidden">Rechercher{liveCount && liveCount > 0 ? ` (${liveCount.toLocaleString('fr-FR')})` : ''}</span>
        <span className="hidden md:inline">Rechercher</span>
      </button>
      </div>
    </div>
  );
};

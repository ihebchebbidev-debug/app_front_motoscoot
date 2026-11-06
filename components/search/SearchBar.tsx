import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChoiceSheet } from './ChoiceSheet';
import { ChevronDown, Navigation, X, Search } from 'lucide-react';
import {
  useBrands,
  useModelsByBrand,
  useCityNames,
  useAccessoryTypes,
  useVehicleCategoriesRich,
} from '../../hooks/useReferenceData';
import { useAvailableSearchOptions } from '../../hooks/useAvailableSearchOptions';
import { useListingsTotal } from '../../hooks/useListings';
import { filtersFromSearch, filtersToServerParams } from '../../hooks/useListingFilters';

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
  /** Why the field is inactive (tooltip and screen readers). */
  disabledHint?: string;
  fullWidth?: boolean;
  icon?: React.ElementType;
  innerRef?: React.Ref<HTMLDivElement>;
  /** Grid placement (tablet two-row layout). */
  className?: string;
  children?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({
  label, value, placeholder, isOpen, onToggle, onClear, isCombobox,
  searchValue = '', onSearchChange, onFocus, isDisabled, disabledHint, icon: Icon,
  innerRef, className = '', children,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const hasValue = !!value || (isCombobox && !!searchValue);
  const display = isCombobox ? (searchValue || value) : value;

  return (
    <div ref={innerRef} className={`relative min-w-0 ${className}`}>
      <div
        ref={boxRef}
        // A disabled button shows no tooltip: the frame carries the hint.
        title={isDisabled ? disabledHint : undefined}
        className={`flex items-center gap-1.5 h-12 md:h-14 px-3 max-[359px]:px-2.5 md:px-3.5 rounded-lg border transition-all ${
          isOpen
            ? 'border-primary-600 ring-2 ring-primary-600/15 md:shadow-sm'
            : 'border-gray-300 md:hover:border-gray-400'
        } ${isDisabled ? 'opacity-50 bg-gray-50 cursor-not-allowed' : 'bg-card'} has-[button:focus-visible]:outline has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-gray-900`}
      >
        {Icon && <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />}
        <button
          type="button"
          onClick={() => { if (!isDisabled) { onToggle(); onFocus?.(); } }}
          disabled={isDisabled}
          aria-label={label}
          aria-description={isDisabled ? disabledHint : undefined}
          title={isDisabled ? undefined : display || undefined}
          className="flex-1 min-w-0 text-left bg-transparent text-[14px] md:text-[14.5px] font-medium text-gray-900 truncate disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none"
        >
          {display || <span className="text-gray-500 font-normal">{placeholder || label}</span>}
        </button>
        {hasValue && onClear && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            aria-label={`Effacer ${label}`}
            className="p-0.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        )}
        {/* Once a value is chosen the clear cross takes the arrow's place
            (the field itself still opens the list): room for the value. */}
        {!(hasValue && onClear) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!isDisabled) onToggle(); }}
            aria-label={isOpen ? `Fermer ${label}` : `Ouvrir ${label}`}
            aria-expanded={isOpen}
            disabled={isDisabled}
            className="p-0.5 text-gray-500 hover:text-gray-900 disabled:pointer-events-none"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {/* Rendered at the page level (portal): inside the search card
          (relative z-20) the list sat under the header and the cookie banner.
          Phones: a sheet from the bottom; from 768 px: a menu under the field. */}
      <ChoiceSheet
        open={isOpen && !isDisabled}
        anchor={boxRef}
        label={label}
        onClose={onToggle}
        search={isCombobox ? { value: searchValue, placeholder: `Rechercher ${label.toLowerCase()}…`, onChange: (v) => onSearchChange?.(v) } : undefined}
      >
        {children}
      </ChoiceSheet>
    </div>
  );
};

const ITEM = 'w-full text-left px-4 py-2.5 text-[14px] font-medium transition-colors';
const ACTIVE = 'bg-primary-50 text-primary-700 font-semibold';
const DEFAULT = 'text-gray-900 hover:bg-gray-50';

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
      // The open sheet lives in document.body (portal): a tap inside it is not "outside".
      if ((target as Element).closest?.('[data-searchbar-sheet]')) return;
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

  const searchFilters = {
    type,
    search: type === 'Accessoires' ? accessoryCategory : '',
    brand,
    model,
    location: location === 'Ma position' ? '' : location,
    aroundMe: location === 'Ma position',
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minYear: minYear ? Number(minYear) : undefined,
  };

  const handleSearchClick = () => {
    onSearch?.(searchFilters);
  };

  // The button's number = what the results page will show for these choices
  // (same filter mapping). « Autour de moi » depends on the visitor's
  // position, known only on the results page: no number then.
  const countParams = useMemo(
    () => (searchFilters.aroundMe ? null : filtersToServerParams(filtersFromSearch(searchFilters as any), ['recent'], null, 1, 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, accessoryCategory, brand, model, location, maxPrice, minYear],
  );
  const { data: matchCount } = useListingsTotal(countParams);

  // Reference data
  const activeBrandCategory = type && type !== 'Accessoires' ? type : undefined;
  const activeAccessoryType = type === 'Accessoires' && accessoryCategory ? accessoryCategory : undefined;
  const { data: brandsData = [] } = useBrands(activeBrandCategory, activeAccessoryType);
  // Models are asked for a chosen brand only: without one, « Modèle » is
  // inactive (it used to list the whole catalogue, 138 models of every brand
  // and category, nearly none with a listing).
  const { names: modelNames } = useModelsByBrand(brand || undefined, activeAccessoryType, !!brand || !!activeAccessoryType);
  const { data: cityRows = [], names: cityNames } = useCityNames();
  const { data: accessoryTypesData = [] } = useAccessoryTypes();
  const { data: vehicleCategories = [] } = useVehicleCategoriesRich();

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
          className={`flex-1 pb-3 text-[15px] font-semibold transition-colors relative ${
            tab === 'occasion' ? 'text-primary-700' : 'text-gray-600 hover:text-gray-900'
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
          className="flex-1 pb-3 text-[15px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          Neuf
        </button>
      </div>

      {/* Fields wrapper — stacked on phones; 12-column grid on tablets
          (3 rows at md, 2 rows at lg) where the one-row toolbar did not fit
          and pushed « Rechercher » out of the card; one row from xl (1280 px).
          On that row (flex) short fields keep their natural width; the model
          field takes the room left and is the one cut with an ellipsis when
          a name is too long (full text in the tooltip); « Où ça ? » grows too
          and caps at 260 px. Nothing can push « Rechercher » out of the card.
          md:contents flattens inner wrappers so each Field becomes a direct
          grid item, giving us one clean toolbar row at md+. */}
      <div className="md:grid md:grid-cols-12 md:gap-2.5 xl:flex xl:gap-2 md:items-stretch">
      {/* Que cherchez-vous ? — full-width category select */}
      <div className="mb-2 md:mb-0 md:contents">
        <Field
          innerRef={refs.type}
          className="md:col-span-4 xl:flex-none"
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
          className="md:col-span-4 xl:flex-none xl:max-w-[176px]"
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
                <div className="px-4 py-3 text-[14px] text-gray-600">
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
                    <span className="text-[12px] font-medium text-gray-500 tabular-nums">{count}</span>
                  )}
                </button>
              );
            });
          })()}
        </Field>

        <Field
          innerRef={refs.model}
          className="md:col-span-4 xl:flex-[1_1_auto] xl:min-w-[110px]"
          label={type === 'Accessoires' ? 'Marque' : 'Modèle'}
          placeholder={type === 'Accessoires' ? (accessoryCategory ? 'Marque' : '—') : 'Modèle'}
          value={type === 'Accessoires' ? brand : model}
          isOpen={openMenu === 'model'}
          onToggle={() => setOpenMenu(openMenu === 'model' ? null : 'model')}
          isCombobox
          // Needs a brand first (accessories: an article first).
          isDisabled={type === 'Accessoires' ? !accessoryCategory : !brand}
          disabledHint={type === 'Accessoires' ? 'Choisissez d’abord un article' : 'Choisissez d’abord une marque'}
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
                <div className="px-4 py-3 text-[14px] text-gray-600">
                  {`Aucun modèle disponible pour ${brand}`}
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
          className="md:col-span-4 lg:col-span-3 xl:flex-none"
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
          className="md:col-span-3 lg:col-span-2 xl:flex-none"
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
        className="md:col-span-5 lg:col-span-4 xl:flex-[1_0_auto] xl:max-w-[260px]"
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
          className={`${ITEM} text-primary-700 flex items-center gap-2 hover:bg-primary-50`}
        >
          <Navigation size={14} className="fill-current" />
          {isLocating ? 'Localisation…' : 'Autour de moi'}
        </button>
        <div className="mx-4 my-1 border-t border-gray-100" />
        {filteredCityNames.length === 0 ? (
          <div className="px-4 py-3 text-[14px] text-gray-600">Aucune ville disponible</div>
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
        className="w-full xl:w-auto mt-3 md:mt-0 md:col-span-12 lg:col-span-3 xl:flex-none md:h-14 md:py-0 md:px-7 md:rounded-lg md:whitespace-nowrap bg-gray-900 hover:bg-black active:scale-[0.98] text-white font-semibold py-4 rounded-lg transition-all text-[15px] flex items-center justify-center gap-2"
      >
        <Search size={16} strokeWidth={2.5} />
        {/* The result count at every width (it used to be phones and tablets
            only). Tabular figures: the button does not twitch as it changes. */}
        <span className="tabular-nums">Rechercher{typeof matchCount === 'number' && countParams ? ` (${matchCount.toLocaleString('fr-FR')})` : ''}</span>
      </button>
      </div>
    </div>
  );
};

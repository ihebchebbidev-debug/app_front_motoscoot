import React, { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ChoiceSheet } from '../search/ChoiceSheet';
import { Input } from '../ui/Input';
import { FIELD_TYPE, useTypeTone } from '../ui/TypeScale';
import { useListingFacets } from '../../hooks/useListings';
import type { BrandRef } from '../../services/miscApi';
import { BRAND_LIST_LIMIT, cleanBrandName, knownBrand, matchBrands, popularBrands, tidyBrands } from '../../utils/brandPicker';

/**
 * « Marque » of the listing form. A field that opens the shared choice sheet
 * (phones: a sheet from the bottom; from 768 px: a menu under the field):
 * the brands most sold in the category as logo tiles, then every brand A → Z,
 * with a search that forgives case, accents, spaces and hyphens.
 * A brand missing from the catalogue can still be typed by hand.
 */

interface BrandPickerProps {
  label: string;
  value: string;
  onChange: (brand: string) => void;
  onBlur?: () => void;
  brands: BrandRef[];
  /** Listing category (Moto, Scooter…): ranks the popular brands. */
  category?: string;
  error?: string;
}

// Controls, not content: pressed at once (no double-tap wait), no text
// selection or iOS callout on a long press.
const TAP = 'touch-manipulation select-none [-webkit-touch-callout:none]';
const ROW = `${TAP} w-full min-h-[44px] flex items-center gap-3 text-left px-4 py-2 text-[15px] font-medium transition-colors active:bg-gray-100`;
const ROW_ON = 'bg-primary-50 text-primary-700 font-semibold';
const ROW_OFF = 'text-gray-900 hover:bg-gray-50';

const Logo: React.FC<{ brand?: BrandRef; size: number }> = ({ brand, size }) => {
  // A logo file that is gone (404) falls back to the initial, never a broken image.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [brand?.logo_url]);
  if (brand?.logo_url && !failed) {
    return (
      <img
        src={brand.logo_url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className="object-contain shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-md bg-gray-100 text-gray-500 font-bold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {Array.from((brand?.name || '?').trim())[0]?.toUpperCase() || '?'}
    </span>
  );
};

/** The typed letters in bold when they appear as written in the name. */
const Highlight: React.FC<{ name: string; query: string }> = ({ name, query }) => {
  const q = query.trim();
  const i = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{name}</>;
  return <>{name.slice(0, i)}<strong className="font-extrabold">{name.slice(i, i + q.length)}</strong>{name.slice(i + q.length)}</>;
};

export const BrandPicker = forwardRef<HTMLButtonElement, BrandPickerProps>(({ label, value, onChange, onBlur, brands, category, error }, ref) => {
  const type = FIELD_TYPE[useTypeTone()];
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState(false);

  const catalogue = useMemo(() => tidyBrands(brands), [brands]);
  const names = useMemo(() => catalogue.map((b) => b.name), [catalogue]);
  const byName = useMemo(() => new Map(catalogue.map((b) => [b.name, b])), [catalogue]);

  // Live listings per brand in the category: the popular tiles.
  const { data: facets } = useListingFacets(category ? { type: category } : undefined);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of facets?.brand || []) if (b?.key) m.set(b.key.toLowerCase(), b.count);
    return m;
  }, [facets]);
  const popular = useMemo(() => popularBrands(names, counts), [names, counts]);
  const matches = useMemo(() => matchBrands(names, query), [names, query]);

  // A brand typed by hand (or restored from a draft) that the catalogue does not know.
  const typedByHand = manual || (!!value && names.length > 0 && !knownBrand(names, value));

  // Click outside the field and its menu closes the menu (the sheet has its scrim).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const t = e.target as Element;
      if (t.closest?.('[data-searchbar-sheet]') || wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const close = () => { setOpen(false); setQuery(''); onBlur?.(); };
  const pick = (name: string) => {
    onChange(name);
    setManual(false);
    close();
    // Back on the field, so the keyboard carries on to « Modèle ».
    requestAnimationFrame(() => buttonRef.current?.focus());
  };
  const typeByHand = (typed = '') => {
    setManual(true);
    onChange(cleanBrandName(typed));
    setOpen(false);
    setQuery('');
  };
  const onEnter = () => {
    const known = knownBrand(names, query);
    if (known) return pick(known);
    if (matches.length === 1) return pick(matches[0]);
    if (!matches.length && query.trim()) typeByHand(query);
  };

  if (typedByHand) {
    return (
      <div className="space-y-2 w-full">
        <Input
          label={label}
          aria-label={label}
          placeholder="Nom de la marque"
          value={value}
          autoFocus={manual && !value}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => { onChange(cleanBrandName(e.target.value)); onBlur?.(); }}
          error={error}
        />
        <button
          type="button"
          onClick={() => { setManual(false); onChange(''); setOpen(true); }}
          className="ml-1 min-h-[44px] text-[14px] font-semibold text-primary-700 underline underline-offset-4 decoration-primary-300 hover:decoration-primary-700"
        >
          Choisir dans la liste des marques
        </button>
      </div>
    );
  }

  const current = value ? byName.get(value) : undefined;
  const showPopular = !query.trim() && popular.length > 0;

  return (
    <div className="space-y-2 w-full group">
      <label htmlFor={id} className={`block ${type.label} ml-1 transition-colors group-focus-within:text-primary-700`}>
        {label}
      </label>
      <div ref={wrapRef} className="relative">
        <button
          id={id}
          ref={(el) => {
            buttonRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={!!error || undefined}
          onClick={() => (open ? close() : setOpen(true))}
          className={`
            ${TAP} w-full flex items-center gap-3 pl-5 pr-12 py-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none transition-all ${type.value} text-left text-gray-900
            focus-visible:bg-card focus-visible:border-primary-600 focus-visible:ring-4 focus-visible:ring-primary-50
            ${open ? 'bg-card border-primary-600 ring-4 ring-primary-50' : ''}
            ${error ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-50' : ''}
          `}
        >
          {value && <Logo brand={current ?? { id: 0, name: value }} size={24} />}
          <span className={`truncate ${value ? '' : 'text-gray-500 font-normal'}`}>{value || 'Choisir une marque'}</span>
        </button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <ChevronDown size={20} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {error && <p className={`${type.error} text-red-600 ml-1 animate-scale-in`}>{error}</p>}

      <ChoiceSheet
        open={open}
        anchor={wrapRef}
        label={label}
        onClose={close}
        tall
        search={{ value: query, placeholder: 'Rechercher une marque…', onChange: setQuery, onEnter }}
      >
        {showPopular && (
          <div className="px-3 pt-1 pb-3">
            <p className="px-1 pb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-gray-500">Les plus vendues</p>
            <div className="grid grid-cols-4 max-[359px]:grid-cols-3 gap-2">
              {popular.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={value === name}
                  onClick={() => pick(name)}
                  className={`${TAP} min-h-[72px] flex flex-col items-center justify-center gap-1.5 px-1 py-2 rounded-xl border transition-[transform,border-color,background-color] duration-100 ease-out active:scale-[0.97] motion-reduce:active:scale-100 ${
                    value === name ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-400 active:bg-gray-50'
                  }`}
                >
                  <Logo brand={byName.get(name)} size={36} />
                  <span title={name} className="max-w-full truncate text-[12px] font-semibold text-gray-800">{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {showPopular && (
          <p className="px-4 pt-2 pb-1 border-t border-gray-100 text-[12px] font-bold uppercase tracking-[0.08em] text-gray-500">Toutes les marques</p>
        )}
        {matches.slice(0, BRAND_LIST_LIMIT).map((name) => (
          <button
            key={name}
            type="button"
            role="option"
            aria-selected={value === name}
            onClick={() => pick(name)}
            className={`${ROW} ${value === name ? ROW_ON : ROW_OFF}`}
          >
            <Logo brand={byName.get(name)} size={28} />
            <span title={name} className="truncate"><Highlight name={name} query={query} /></span>
          </button>
        ))}
        {matches.length > BRAND_LIST_LIMIT && (
          <p className="px-4 py-3 text-[14px] text-gray-600">
            {matches.length - BRAND_LIST_LIMIT} autres marques : tapez quelques lettres pour les trouver.
          </p>
        )}
        {!matches.length && (
          <p className="px-4 py-3 text-[14px] text-gray-600">
            {query.trim() ? <>Aucune marque « {query.trim()} » dans la liste.</> : 'Aucune marque pour cette catégorie.'}
          </p>
        )}
        <div className="mt-1 border-t border-gray-100 px-2 pt-1">
          <button
            type="button"
            onClick={() => typeByHand(matches.length ? '' : query)}
            className={`${ROW} rounded-lg text-primary-700 hover:bg-primary-50`}
          >
            {!matches.length && query.trim()
              ? <>Utiliser « {cleanBrandName(query)} » comme marque</>
              : 'Ma marque n’est pas dans la liste'}
          </button>
        </div>
      </ChoiceSheet>
    </div>
  );
});

BrandPicker.displayName = 'BrandPicker';

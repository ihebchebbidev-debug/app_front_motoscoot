import React, { forwardRef, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ChoiceSheet } from '../search/ChoiceSheet';
import { Input } from '../ui/Input';
import { FIELD_TYPE, useTypeTone } from '../ui/TypeScale';
import { BACK_TO_LIST, Highlight, ROW, ROW_OFF, ROW_ON, TAP, useCloseOutside } from './pickerParts';
import { BRAND_LIST_LIMIT, knownBrand, matchBrands } from '../../utils/brandPicker';

/**
 * « Modèle » of the listing form, the same field as « Marque »: it opens the
 * shared choice sheet (phones: a sheet from the bottom, above the keyboard;
 * from 768 px: a menu under the field) with every model of the chosen brand
 * at once, a forgiving search, and « Mon modèle n'est pas dans la liste ».
 * Before a brand is chosen it waits for it; a brand with no model in the
 * catalogue gets a plain text field.
 */

interface ModelPickerProps {
  label: string;
  value: string;
  onChange: (model: string) => void;
  onBlur?: () => void;
  /** The chosen brand (empty: the field waits for it). */
  brand?: string;
  /** Catalogue models of the brand. */
  models: string[];
  /** The catalogue is still loading. */
  loading?: boolean;
  /** « Ex : TMAX 560 », by category (utils/depositOptions.ts). */
  example: string;
  error?: string;
}

/** A model name typed by hand: single spaces, trimmed, 100 characters (listings.model). */
export const cleanModelName = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, 100);

export const ModelPicker = forwardRef<HTMLElement, ModelPickerProps>(({ label, value, onChange, onBlur, brand, models, loading, example, error }, ref) => {
  const type = FIELD_TYPE[useTypeTone()];
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState(false);

  const names = useMemo(() => Array.from(new Set(models.map((m) => m.replace(/\s+/g, ' ').trim()).filter(Boolean))), [models]);
  const matches = useMemo(() => matchBrands(names, query), [names, query]);

  useCloseOutside(open, wrapRef, () => setOpen(false));

  const setRef = (el: HTMLElement | null) => {
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const close = () => { setOpen(false); setQuery(''); onBlur?.(); };
  const pick = (name: string) => {
    onChange(name);
    setManual(false);
    close();
    requestAnimationFrame(() => buttonRef.current?.focus());
  };
  const typeByHand = (typed = '') => {
    setManual(true);
    onChange(cleanModelName(typed));
    setOpen(false);
    setQuery('');
  };
  const onEnter = () => {
    const known = knownBrand(names, query);
    if (known) return pick(known);
    if (matches.length === 1) return pick(matches[0]);
    if (!matches.length && query.trim()) typeByHand(query);
  };

  // Typed by hand: chosen so, restored from a draft with a name the catalogue
  // does not hold, or a brand whose catalogue has no model at all.
  const noCatalogue = !!brand && !loading && names.length === 0;
  const typedByHand = !!brand && (manual || noCatalogue || (!!value && names.length > 0 && !knownBrand(names, value)));

  if (typedByHand) {
    return (
      <div className="space-y-2 w-full">
        <Input
          ref={setRef as React.Ref<HTMLInputElement>}
          label={label}
          placeholder={example}
          value={value}
          autoFocus={manual && !value}
          maxLength={100}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => { onChange(cleanModelName(e.target.value)); onBlur?.(); }}
          error={error}
        />
        {names.length > 0 && (
          <button type="button" onClick={() => { setManual(false); onChange(''); setOpen(true); }} className={BACK_TO_LIST}>
            Choisir dans les modèles {brand}
          </button>
        )}
      </div>
    );
  }

  const waiting = !brand;

  return (
    <div className="space-y-2 w-full group">
      <label htmlFor={id} className={`block ${type.label} ml-1 transition-colors group-focus-within:text-primary-700`}>
        {label}
      </label>
      <div ref={wrapRef} className="relative">
        <button
          id={id}
          ref={(el) => { buttonRef.current = el; setRef(el); }}
          type="button"
          disabled={waiting}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={!!error || undefined}
          onClick={() => (open ? close() : setOpen(true))}
          className={`
            ${TAP} w-full flex items-center gap-3 pl-5 pr-12 py-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none transition-all ${type.value} text-left text-gray-900
            focus-visible:bg-card focus-visible:border-primary-600 focus-visible:ring-4 focus-visible:ring-primary-50
            disabled:cursor-not-allowed disabled:bg-gray-100
            ${open ? 'bg-card border-primary-600 ring-4 ring-primary-50' : ''}
            ${error ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-50' : ''}
          `}
        >
          <span className={`truncate ${value ? '' : 'text-gray-500 font-normal'}`}>
            {value || (waiting ? 'Choisissez d’abord la marque' : example)}
          </span>
        </button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <ChevronDown size={20} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {error && <p className={`${type.error} text-red-600 ml-1 animate-scale-in`}>{error}</p>}

      <ChoiceSheet
        open={open}
        anchor={wrapRef}
        label={brand ? `Modèles ${brand}` : label}
        onClose={close}
        tall
        search={{ value: query, placeholder: 'Rechercher un modèle…', onChange: setQuery, onEnter }}
      >
        {loading && !names.length && <p className="px-4 py-3 text-[14px] text-gray-600">Chargement des modèles…</p>}
        {matches.slice(0, BRAND_LIST_LIMIT).map((name) => (
          <button
            key={name}
            type="button"
            role="option"
            aria-selected={value === name}
            onClick={() => pick(name)}
            className={`${ROW} ${value === name ? ROW_ON : ROW_OFF}`}
          >
            <span title={name} className="truncate"><Highlight name={name} query={query} /></span>
          </button>
        ))}
        {matches.length > BRAND_LIST_LIMIT && (
          <p className="px-4 py-3 text-[14px] text-gray-600">
            {matches.length - BRAND_LIST_LIMIT} autres modèles : tapez quelques lettres pour les trouver.
          </p>
        )}
        {!matches.length && !loading && query.trim() && (
          <p className="px-4 py-3 text-[14px] text-gray-600">Aucun modèle « {query.trim()} » dans la liste.</p>
        )}
        <div className="mt-1 border-t border-gray-100 px-2 pt-1">
          <button
            type="button"
            onClick={() => typeByHand(matches.length ? '' : query)}
            className={`${ROW} rounded-lg text-primary-700 hover:bg-primary-50`}
          >
            {!matches.length && query.trim()
              ? <>Utiliser « {cleanModelName(query)} » comme modèle</>
              : 'Mon modèle n’est pas dans la liste'}
          </button>
        </div>
      </ChoiceSheet>
    </div>
  );
});

ModelPicker.displayName = 'ModelPicker';

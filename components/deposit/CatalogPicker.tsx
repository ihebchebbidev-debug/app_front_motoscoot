import React, { forwardRef, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ChoiceSheet } from '../search/ChoiceSheet';
import { Input } from '../ui/Input';
import { FIELD_TYPE, useTypeTone } from '../ui/TypeScale';
import { BACK_TO_LIST, Highlight, ROW, ROW_OFF, ROW_ON, TAP, useCloseOutside } from './pickerParts';
import { BRAND_LIST_LIMIT, knownBrand, matchBrands } from '../../utils/brandPicker';

/**
 * A choice from a catalogue (« Marque », « Modèle »): a field that opens the
 * shared choice sheet (phones: a sheet from the bottom, above the keyboard;
 * from 768 px: a menu under the field) with the whole list at once, a search
 * that forgives case, accents, spaces and hyphens (Enter picks the match), and
 * a way out for a name the catalogue lacks: « … n'est pas dans la liste » turns
 * the field into a text field, with a link back to the list.
 *
 * The brand and the model only add what is theirs (BrandPicker, ModelPicker):
 * logos and best sellers, or waiting for the brand.
 */

export interface CatalogWords {
  /** Trigger text when nothing is chosen. */
  placeholder: string;
  /** Sheet search field. */
  search: string;
  /** Last row: « Ma marque n'est pas dans la liste ». */
  missing: string;
  /** Last row once a search found nothing: « Utiliser « X » comme marque ». */
  use: (typed: string) => string;
  /** Under the text field: « Choisir dans la liste des marques ». */
  backToList: string;
  /** No match for the search: « Aucune marque « X » dans la liste. » */
  noMatch: (typed: string) => string;
  /** The catalogue is empty (null: say nothing). */
  empty: string | null;
  /** More than the rows drawn: « 800 autres marques : tapez… ». */
  more: (count: number) => string;
  /** Text field placeholder once typed by hand. */
  typedPlaceholder: string;
}

export interface CatalogPickerProps {
  label: string;
  value: string;
  onChange: (name: string) => void;
  onBlur?: () => void;
  error?: string;
  /** The catalogue, already tidied by the caller. */
  names: string[];
  words: CatalogWords;
  /** Title of the sheet (default: the label). */
  sheetTitle?: string;
  /** A name typed by hand, tidied (spaces, length). */
  clean: (typed: string) => string;
  /** Longest name typed by hand. */
  maxLength: number;
  /** The catalogue is still loading. */
  loading?: boolean;
  /** Not available yet (the model waits for the brand): this text, field inactive. */
  waiting?: string;
  /** No catalogue at all for this choice: the text field straight away. */
  freeTextOnly?: boolean;
  /** Before each name in the list and in the field (a logo). */
  leading?: (name: string, place: 'row' | 'field') => React.ReactNode;
  /** Above the list when nothing is typed (best sellers); `pick` chooses a name. */
  header?: (pick: (name: string) => void, value: string) => React.ReactNode;
  /** Title above the list when there is a header (« Toutes les marques »). */
  listTitle?: string;
  /** Text field: capitals as the name is typed. */
  autoCapitalize?: 'none' | 'words';
}

export const CatalogPicker = forwardRef<HTMLElement, CatalogPickerProps>(({
  label, value, onChange, onBlur, error, names, words, sheetTitle, clean, maxLength,
  loading, waiting, freeTextOnly, leading, header, listTitle, autoCapitalize = 'none',
}, ref) => {
  const type = FIELD_TYPE[useTypeTone()];
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState(false);

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
    // Back on the field, so the keyboard carries on to the next one.
    requestAnimationFrame(() => buttonRef.current?.focus());
  };
  const typeByHand = (typed = '') => {
    setManual(true);
    onChange(clean(typed));
    setOpen(false);
    setQuery('');
  };
  const onEnter = () => {
    const known = knownBrand(names, query);
    if (known) return pick(known);
    if (matches.length === 1) return pick(matches[0]);
    if (!matches.length && query.trim()) typeByHand(query);
  };

  // Typed by hand: chosen so, a name the catalogue does not hold (a draft),
  // or no catalogue at all for this choice.
  const typedByHand = !waiting && (manual || !!freeTextOnly || (!!value && names.length > 0 && !knownBrand(names, value)));

  if (typedByHand) {
    return (
      <div className="space-y-2 w-full">
        <Input
          ref={setRef as React.Ref<HTMLInputElement>}
          label={label}
          placeholder={words.typedPlaceholder}
          value={value}
          autoFocus={manual && !value}
          maxLength={maxLength}
          autoComplete="off"
          autoCapitalize={autoCapitalize}
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => { onChange(clean(e.target.value)); onBlur?.(); }}
          error={error}
        />
        {names.length > 0 && (
          <button type="button" onClick={() => { setManual(false); onChange(''); setOpen(true); }} className={BACK_TO_LIST}>
            {words.backToList}
          </button>
        )}
      </div>
    );
  }

  const showHeader = !!header && !query.trim();

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
          disabled={!!waiting}
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
          {value && leading?.(value, 'field')}
          <span className={`truncate ${value ? '' : 'text-gray-500 font-normal'}`}>{value || waiting || words.placeholder}</span>
        </button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <ChevronDown size={20} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {error && <p className={`${type.error} text-red-600 ml-1 animate-scale-in`}>{error}</p>}

      <ChoiceSheet
        open={open}
        anchor={wrapRef}
        label={sheetTitle ?? label}
        onClose={close}
        tall
        search={{ value: query, placeholder: words.search, onChange: setQuery, onEnter }}
      >
        {showHeader && header!(pick, value)}
        {showHeader && listTitle && (
          <p className="px-4 pt-2 pb-1 border-t border-gray-100 text-[12px] font-bold uppercase tracking-[0.08em] text-gray-500">{listTitle}</p>
        )}
        {loading && !names.length && <p className="px-4 py-3 text-[14px] text-gray-600">Chargement…</p>}
        {matches.slice(0, BRAND_LIST_LIMIT).map((name) => (
          <button
            key={name}
            type="button"
            role="option"
            aria-selected={value === name}
            onClick={() => pick(name)}
            className={`${ROW} ${value === name ? ROW_ON : ROW_OFF}`}
          >
            {leading?.(name, 'row')}
            <span title={name} className="truncate"><Highlight name={name} query={query} /></span>
          </button>
        ))}
        {matches.length > BRAND_LIST_LIMIT && (
          <p className="px-4 py-3 text-[14px] text-gray-600">{words.more(matches.length - BRAND_LIST_LIMIT)}</p>
        )}
        {!matches.length && !loading && (query.trim() || words.empty) && (
          <p className="px-4 py-3 text-[14px] text-gray-600">{query.trim() ? words.noMatch(query.trim()) : words.empty}</p>
        )}
        <div className="mt-1 border-t border-gray-100 px-2 pt-1">
          <button
            type="button"
            onClick={() => typeByHand(matches.length ? '' : query)}
            className={`${ROW} rounded-lg text-primary-700 hover:bg-primary-50`}
          >
            {!matches.length && query.trim() ? words.use(clean(query)) : words.missing}
          </button>
        </div>
      </ChoiceSheet>
    </div>
  );
});

CatalogPicker.displayName = 'CatalogPicker';
